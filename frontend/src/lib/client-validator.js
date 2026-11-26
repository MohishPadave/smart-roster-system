import { OperatingCalendar, ShiftCode, ViolationType, } from '@/types/roster';
export function getMonthDates(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const res = [];
    for (let d = 1; d <= days; d++) {
        res.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return res;
}
export function isUtcSunday(dateStr) {
    return new Date(`${dateStr}T12:00:00Z`).getUTCDay() === 0;
}
/**
 * Zero-latency deterministic client-side constraint checker for manual shift edits.
 */
export function runClientValidation(params) {
    const { monthKey, baseShifts, pendingEdits, employees, rules, leaves, holidays } = params;
    const dates = getMonthDates(monthKey);
    const empMap = new Map(employees.filter((e) => e.isActive).map((e) => [e.id, e]));
    const ruleMap = new Map(rules.filter((r) => r.isActive).map((r) => [r.id, r]));
    const leaveSet = new Set(leaves
        .filter((l) => l.status === 'APPROVED')
        .map((l) => `${l.employeeId}:${l.date.slice(0, 10)}`));
    const holidaySet = new Set(holidays.filter((h) => h.isPublicHoliday).map((h) => h.date.slice(0, 10)));
    // Merge base + pending edits
    const shiftMap = new Map();
    for (const s of baseShifts) {
        shiftMap.set(`${s.employeeId}:${s.date}`, s);
    }
    for (const [k, edit] of Object.entries(pendingEdits)) {
        shiftMap.set(k, edit);
    }
    const violations = [];
    const coverageGaps = [];
    // 1. P0 Leave & Holiday Lock on pending edits (and current roster)
    for (const edit of Object.values(pendingEdits)) {
        const emp = empMap.get(edit.employeeId);
        if (!emp)
            continue;
        const isWorking = edit.shiftCode === ShiftCode.W || edit.shiftCode === ShiftCode.BK;
        if (isWorking && leaveSet.has(`${edit.employeeId}:${edit.date}`)) {
            violations.push({
                type: ViolationType.P0_LEAVE_LOCK,
                severity: 'P0',
                employeeId: emp.id,
                employeeName: emp.name,
                date: edit.date,
                description: `Cannot assign ${edit.shiftCode} on approved leave date`,
            });
        }
        if (isWorking && holidaySet.has(edit.date) && edit.brandProcessRuleId) {
            const rule = ruleMap.get(edit.brandProcessRuleId);
            if (rule &&
                (rule.operatingCalendar === OperatingCalendar.EXCL_PH ||
                    rule.operatingCalendar === OperatingCalendar.EXCL_SUN_PH)) {
                violations.push({
                    type: ViolationType.P0_LEAVE_LOCK,
                    severity: 'P0',
                    employeeId: emp.id,
                    employeeName: emp.name,
                    date: edit.date,
                    description: `${rule.brand?.name || 'Brand'} (${rule.operatingCalendar}) does not operate on Public Holidays`,
                    affectedBrandProcessRuleId: rule.id,
                    affectedBrandName: rule.brand?.name,
                    affectedProcess: rule.process,
                });
            }
        }
    }
    // 2. P0 Brand & Process Coverage (count W + BK)
    const coverageMap = new Map();
    for (const entry of shiftMap.values()) {
        if ((entry.shiftCode === ShiftCode.W || entry.shiftCode === ShiftCode.BK) && entry.brandProcessRuleId) {
            const covKey = `${entry.date}:${entry.brandProcessRuleId}`;
            if (!coverageMap.has(covKey))
                coverageMap.set(covKey, new Set());
            coverageMap.get(covKey).add(entry.employeeId);
        }
    }
    for (const rule of ruleMap.values()) {
        for (const date of dates) {
            const isHol = holidaySet.has(date);
            const isSun = isUtcSunday(date);
            if (rule.operatingCalendar === OperatingCalendar.EXCL_PH && isHol)
                continue;
            if (rule.operatingCalendar === OperatingCalendar.EXCL_SUN_PH && (isSun || isHol))
                continue;
            const actual = coverageMap.get(`${date}:${rule.id}`)?.size || 0;
            if (actual < rule.minHeadcount) {
                coverageGaps.push({
                    brandProcessRuleId: rule.id,
                    brandName: rule.brand?.name || 'Unknown Brand',
                    process: rule.process,
                    date,
                    requiredHeadcount: rule.minHeadcount,
                    actualHeadcount: actual,
                    gap: rule.minHeadcount - actual,
                });
            }
        }
    }
    // 3. P1 Mandatory Weekly Offs (>= 4 WO/PH rest days, max 6 consecutive workdays)
    if (shiftMap.size > 0) {
        for (const emp of empMap.values()) {
            let restDays = 0;
            let streak = 0;
            let streakBroken = false;
            for (const date of dates) {
                const entry = shiftMap.get(`${emp.id}:${date}`);
                const code = entry?.shiftCode ?? ShiftCode.WO;
                if (code === ShiftCode.WO || code === ShiftCode.PH)
                    restDays++;
                if (code === ShiftCode.W || code === ShiftCode.BK) {
                    streak++;
                    if (streak > 6 && !streakBroken) {
                        streakBroken = true;
                        violations.push({
                            type: ViolationType.P1_WEEKLY_OFF,
                            severity: 'P1',
                            employeeId: emp.id,
                            employeeName: emp.name,
                            date,
                            description: `Exceeds 6 consecutive workdays (${streak} days without rest)`,
                        });
                    }
                }
                else {
                    streak = 0;
                }
            }
            if (restDays < 4) {
                violations.push({
                    type: ViolationType.P1_WEEKLY_OFF,
                    severity: 'P1',
                    employeeId: emp.id,
                    employeeName: emp.name,
                    date: dates[0],
                    description: `Only ${restDays}/4 statutory rest days (WO/PH) in cycle`,
                });
            }
        }
    }
    const p0Count = violations.filter((v) => v.severity === 'P0').length + coverageGaps.length;
    const p1Count = violations.filter((v) => v.severity === 'P1').length;
    return {
        valid: p0Count === 0 && p1Count === 0,
        violations,
        coverageGaps,
        p0Count,
        p1Count,
    };
}
