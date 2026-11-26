/**
 * Deterministic Roster Constraint Validator
 * Fast, synchronous validation for manual edits before persisting to database
 */

import { prisma } from './prisma';
import {
  ShiftCode,
  ValidationResult,
  RuleViolation,
  CoverageGap,
  ViolationType,
  ProcessType,
  OperatingCalendar,
} from '@/types/roster';

interface ShiftEdit {
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  shiftCode: ShiftCode;
  brandProcessRuleId?: string | null;
  notes?: string | null;
}

interface RosterContext {
  rosterVersionId: string;
  existingShifts: Map<string, ShiftCode>; // key: "employeeId:date"
  existingRules: Map<string, string | null>; // key: "employeeId:date"
  employees: Map<string, { id: string; name: string; processSkills: string[] }>;
  brandProcessRules: Map<
    string,
    {
      id: string;
      brandName: string;
      process: ProcessType;
      minHeadcount: number;
      operatingCalendar: OperatingCalendar;
    }
  >;
  leaves: Set<string>; // key: "employeeId:date"
  holidays: Set<string>; // key: "YYYY-MM-DD"
  monthKey: string;
}

/**
 * Load roster context from database
 */
async function loadRosterContext(rosterVersionId: string): Promise<RosterContext> {
  const rosterVersion = await prisma.rosterVersion.findUniqueOrThrow({
    where: { id: rosterVersionId },
    include: {
      shiftEntries: true,
    },
  });

  const existingShifts = new Map<string, ShiftCode>();
  const existingRules = new Map<string, string | null>();
  for (const entry of rosterVersion.shiftEntries) {
    existingShifts.set(`${entry.employeeId}:${entry.date}`, entry.shiftCode as ShiftCode);
    existingRules.set(`${entry.employeeId}:${entry.date}`, entry.brandProcessRuleId);
  }

  const dbEmployees = await prisma.employee.findMany({
    where: { isActive: true },
  });
  const employees = new Map(
    dbEmployees.map((e) => [
      e.id,
      { id: e.id, name: e.name, processSkills: e.processSkillTags },
    ])
  );

  const dbRules = await prisma.brandProcessRule.findMany({
    where: { isActive: true },
    include: { brand: true },
  });
  const brandProcessRules = new Map(
    dbRules.map((r) => [
      r.id,
      {
        id: r.id,
        brandName: r.brand.name,
        process: r.process as ProcessType,
        minHeadcount: r.minHeadcount,
        operatingCalendar: r.operatingCalendar as OperatingCalendar,
      },
    ])
  );

  const [year, month] = rosterVersion.monthKey.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const dbLeaves = await prisma.leaveRequest.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
    },
  });
  const leaves = new Set(dbLeaves.map((l) => `${l.employeeId}:${l.date.toISOString().split('T')[0]}`));

  const dbHolidays = await prisma.holidayCalendar.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  const holidays = new Set(dbHolidays.map((h) => h.date.toISOString().split('T')[0]));

  return {
    rosterVersionId,
    existingShifts,
    existingRules,
    employees,
    brandProcessRules,
    leaves,
    holidays,
    monthKey: rosterVersion.monthKey,
  };
}

/**
 * Check if a date is Sunday (UTC-safe)
 */
function isSunday(dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00Z`);
  return date.getUTCDay() === 0;
}

/**
 * Validate a set of proposed shift edits
 */
export async function validateRosterEdits(
  rosterVersionId: string,
  edits: ShiftEdit[]
): Promise<ValidationResult> {
  const ctx = await loadRosterContext(rosterVersionId);
  const violations: RuleViolation[] = [];
  const coverageGaps: CoverageGap[] = [];

  // Apply edits to a temporary roster snapshot
  const tempRoster = new Map(ctx.existingShifts);
  for (const edit of edits) {
    tempRoster.set(`${edit.employeeId}:${edit.date}`, edit.shiftCode);
  }

  // ========== P0 Validations ==========

  // P0.1: Leave & Holiday Lock
  for (const edit of edits) {
    const employee = ctx.employees.get(edit.employeeId);
    if (!employee) continue;

    const isLeaveDay = ctx.leaves.has(`${edit.employeeId}:${edit.date}`);
    const isHolidayDay = ctx.holidays.has(edit.date);

    if (isLeaveDay && (edit.shiftCode === ShiftCode.W || edit.shiftCode === ShiftCode.BK)) {
      violations.push({
        type: ViolationType.P0_LEAVE_LOCK,
        severity: 'P0',
        employeeId: edit.employeeId,
        employeeName: employee.name,
        date: edit.date,
        description: `Cannot schedule ${edit.shiftCode} on approved leave day (AL/CO)`,
      });
    }

    // Holiday lock only applies if the brand's operating calendar excludes holidays
    if (
      isHolidayDay &&
      (edit.shiftCode === ShiftCode.W || edit.shiftCode === ShiftCode.BK) &&
      edit.brandProcessRuleId
    ) {
      const rule = ctx.brandProcessRules.get(edit.brandProcessRuleId);
      if (
        rule &&
        (rule.operatingCalendar === OperatingCalendar.EXCL_PH ||
          rule.operatingCalendar === OperatingCalendar.EXCL_SUN_PH)
      ) {
        violations.push({
          type: ViolationType.P0_LEAVE_LOCK,
          severity: 'P0',
          employeeId: edit.employeeId,
          employeeName: employee.name,
          date: edit.date,
          description: `Cannot schedule work on public holiday (brand ${rule.brandName} has ${rule.operatingCalendar} calendar)`,
          affectedBrandProcessRuleId: rule.id,
          affectedBrandName: rule.brandName,
        });
      }
    }
  }

  // P0.2: Single-Assignment Cap (max 1.0 FTE per day)
  const dailyCapacity = new Map<string, number>(); // key: "employeeId:date"
  for (const [key, shiftCode] of tempRoster.entries()) {
    if (shiftCode === ShiftCode.W || shiftCode === ShiftCode.BK) {
      const current = dailyCapacity.get(key) || 0;
      dailyCapacity.set(key, current + 1.0);
    }
  }

  for (const [key, capacity] of dailyCapacity.entries()) {
    if (capacity > 1.0) {
      const [employeeId, date] = key.split(':');
      const employee = ctx.employees.get(employeeId);
      if (employee) {
        violations.push({
          type: ViolationType.P0_SINGLE_ASSIGNMENT_CAP,
          severity: 'P0',
          employeeId,
          employeeName: employee.name,
          date,
          description: `Daily capacity exceeds 1.0 FTE (assigned ${capacity.toFixed(1)} FTE)`,
        });
      }
    }
  }

  // P0.3: Brand & Process Coverage (count both W and BK shifts)
  const coverageByDateAndRule = new Map<string, Set<string>>(); // key: "date:ruleId", value: Set of employeeIds
  const editMap = new Map(edits.map((e) => [`${e.employeeId}:${e.date}`, e]));

  for (const [key, shiftCode] of tempRoster.entries()) {
    if (shiftCode !== ShiftCode.W && shiftCode !== ShiftCode.BK) continue;

    const [employeeId, date] = key.split(':');
    const edit = editMap.get(key);
    const brandProcessRuleId = edit
      ? (edit.brandProcessRuleId ?? ctx.existingRules.get(key) ?? null)
      : (ctx.existingRules.get(key) ?? null);

    if (brandProcessRuleId) {
      const coverageKey = `${date}:${brandProcessRuleId}`;
      if (!coverageByDateAndRule.has(coverageKey)) {
        coverageByDateAndRule.set(coverageKey, new Set());
      }
      coverageByDateAndRule.get(coverageKey)!.add(employeeId);
    }
  }

  // Check all dates in the month for all active rules
  const [year, month] = ctx.monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (const [ruleId, rule] of ctx.brandProcessRules.entries()) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Skip if the rule's operating calendar excludes this day
      const isHoliday = ctx.holidays.has(date);
      const isSun = isSunday(date);

      if (rule.operatingCalendar === OperatingCalendar.EXCL_PH && isHoliday) continue;
      if (rule.operatingCalendar === OperatingCalendar.EXCL_SUN_PH && (isSun || isHoliday)) continue;

      const coverageKey = `${date}:${ruleId}`;
      const assignedCount = coverageByDateAndRule.get(coverageKey)?.size || 0;

      if (assignedCount < rule.minHeadcount) {
        coverageGaps.push({
          brandProcessRuleId: ruleId,
          brandName: rule.brandName,
          process: rule.process,
          date,
          requiredHeadcount: rule.minHeadcount,
          actualHeadcount: assignedCount,
          gap: rule.minHeadcount - assignedCount,
        });
      }
    }
  }

  // ========== P1 Validations ==========

  // P1: Mandatory Weekly Offs (>= 4 WO per 30-day cycle, max 6 consecutive workdays)
  for (const [employeeId, employee] of ctx.employees.entries()) {
    const employeeShifts: { date: string; shiftCode: ShiftCode }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const shiftCode = tempRoster.get(`${employeeId}:${date}`) || ShiftCode.WO;
      employeeShifts.push({ date, shiftCode });
    }

    // Count statutory rest days (WO + non-working PH; AL/CO leaves do not count as weekly offs)
    const woCount = employeeShifts.filter(
      (s) => s.shiftCode === ShiftCode.WO || s.shiftCode === ShiftCode.PH
    ).length;
    if (woCount < 4) {
      violations.push({
        type: ViolationType.P1_WEEKLY_OFF,
        severity: 'P1',
        employeeId,
        employeeName: employee.name,
        date: `${ctx.monthKey}-01`,
        description: `Insufficient weekly offs/holiday rest days: ${woCount}/4 required (30-day cycle)`,
      });
    }

    // Check consecutive workdays
    let consecutiveWorkDays = 0;
    for (const shift of employeeShifts) {
      if (shift.shiftCode === ShiftCode.W || shift.shiftCode === ShiftCode.BK) {
        consecutiveWorkDays++;
        if (consecutiveWorkDays > 6) {
          violations.push({
            type: ViolationType.P1_WEEKLY_OFF,
            severity: 'P1',
            employeeId,
            employeeName: employee.name,
            date: shift.date,
            description: `More than 6 consecutive workdays without a weekly off`,
          });
          break;
        }
      } else {
        consecutiveWorkDays = 0;
      }
    }
  }

  const affectedEmployees = new Set(violations.map((v) => v.employeeId));
  const affectedDates = new Set(violations.map((v) => v.date));

  return {
    valid: violations.length === 0 && coverageGaps.length === 0,
    violations,
    coverageGaps,
    affectedSummary: {
      totalViolations: violations.length,
      p0Violations: violations.filter((v) => v.severity === 'P0').length,
      p1Violations: violations.filter((v) => v.severity === 'P1').length,
      affectedEmployees: Array.from(affectedEmployees),
      affectedDates: Array.from(affectedDates),
    },
  };
}
