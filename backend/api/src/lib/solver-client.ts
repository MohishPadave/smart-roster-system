/**
 * Solver Service Client
 * Loads data from Prisma and calls Python solver endpoints
 */

import { prisma } from './prisma';
import {
  EmployeeInput,
  BrandProcessRuleInput,
  EmployeeAllocationInput,
  LeaveRequestInput,
  HolidayInput,
  SolveRequest,
  SolveResponse,
  ReoptimizeRequest,
  ReoptimizeResponse,
  SpofAuditRequest,
  SpofAuditResponse,
  RoleType,
  ProcessType,
  OperatingCalendar,
  AssignmentType,
  ShiftAssignmentDTO,
  ShiftCode,
} from '@/types/roster';

const SOLVER_URL = process.env.SOLVER_URL || 'http://127.0.0.1:8001';

/**
 * Load all active entities from Prisma for solver requests
 */
export async function loadSolverData(monthKey: string) {
  // Load employees
  const dbEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { pod: true },
  });

  const employees: EmployeeInput[] = dbEmployees.map((e) => ({
    id: e.id,
    name: e.name,
    pod_id: e.podId,
    role_type: e.roleType as RoleType,
    preferred_weekly_off: e.preferredWeeklyOff,
    max_daily_capacity: e.maxDailyCapacity,
    process_skill_tags: e.processSkillTags.map((p) => p as ProcessType),
    is_active: e.isActive,
  }));

  // Load brand process rules
  const dbRules = await prisma.brandProcessRule.findMany({
    where: { isActive: true },
    include: { brand: { include: { pod: true } } },
  });

  const brandProcessRules: BrandProcessRuleInput[] = dbRules.map((r) => ({
    id: r.id,
    brand_id: r.brandId,
    brand_name: r.brand.name,
    pod_id: r.brand.podId,
    process: r.process as ProcessType,
    operating_calendar: r.operatingCalendar as OperatingCalendar,
    min_headcount: r.minHeadcount,
    is_active: r.isActive,
  }));

  // Load allocations
  const dbAllocations = await prisma.employeeAllocation.findMany({
    where: {
      employee: { isActive: true },
      brandProcessRule: { isActive: true },
    },
  });

  const allocations: EmployeeAllocationInput[] = dbAllocations.map((a) => ({
    employee_id: a.employeeId,
    brand_process_rule_id: a.brandProcessRuleId,
    assignment_type: a.assignmentType as AssignmentType,
    allocation_weight: a.allocationWeight,
  }));

  // Load leaves for the month (UTC boundaries for @db.Date)
  const [year, month] = monthKey.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const dbLeaves = await prisma.leaveRequest.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
    },
  });

  const leaves: LeaveRequestInput[] = dbLeaves.map((l) => ({
    employee_id: l.employeeId,
    date: l.date.toISOString().split('T')[0],
  }));

  // Load holidays for the month
  const dbHolidays = await prisma.holidayCalendar.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
  });

  const holidays: HolidayInput[] = dbHolidays.map((h) => ({
    date: h.date.toISOString().split('T')[0],
    is_public_holiday: h.isPublicHoliday,
  }));

  return { employees, brandProcessRules, allocations, leaves, holidays };
}

/**
 * Call solver /solve endpoint
 */
export async function callSolve(
  request: SolveRequest
): Promise<SolveResponse> {
  const response = await fetch(`${SOLVER_URL}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Solver /solve failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Call solver /reoptimize endpoint
 */
export async function callReoptimize(
  request: ReoptimizeRequest
): Promise<ReoptimizeResponse> {
  const response = await fetch(`${SOLVER_URL}/reoptimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Solver /reoptimize failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Call solver /audit/spof endpoint
 */
export async function callSpofAudit(
  request: SpofAuditRequest
): Promise<SpofAuditResponse> {
  const response = await fetch(`${SOLVER_URL}/audit/spof`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Solver /audit/spof failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check solver health
 */
export async function checkSolverHealth(): Promise<{ healthy: boolean; version?: string }> {
  try {
    const response = await fetch(`${SOLVER_URL}/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return { healthy: false };
    }

    const data = await response.json();
    return { healthy: true, version: data.version };
  } catch (error) {
    return { healthy: false };
  }
}

/**
 * Load current roster from RosterVersion for reoptimization
 */
export async function loadCurrentRoster(
  rosterVersionId: string
): Promise<ShiftAssignmentDTO[]> {
  const shiftEntries = await prisma.shiftEntry.findMany({
    where: { rosterVersionId },
  });

  return shiftEntries.map((entry) => ({
    employee_id: entry.employeeId,
    date: entry.date,
    shift_code: entry.shiftCode as ShiftCode,
    brand_process_rule_id: entry.brandProcessRuleId,
    notes: entry.notes,
  }));
}
