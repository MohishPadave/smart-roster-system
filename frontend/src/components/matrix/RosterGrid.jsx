'use client';
import React, { useMemo } from 'react';
import { flexRender, getCoreRowModel, useReactTable, } from '@tanstack/react-table';
import { AlertTriangle, Flame, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { getMonthDates, isUtcSunday } from '@/lib/client-validator';
import { OperatingCalendar, ProcessType, ShiftCode } from '@/types/roster';
import { ShiftCell } from './ShiftCell';
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function shortDayHeader(dateStr) {
    const dt = new Date(`${dateStr}T12:00:00Z`);
    return {
        dayNum: dateStr.slice(8, 10),
        dow: WEEKDAYS[dt.getUTCDay()],
        isSun: dt.getUTCDay() === 0,
    };
}
export function RosterGrid() {
    const { monthKey, lens, rosterVersion, pods, employees, brands, processRules, allocations, holidays, selectedPodId, selectedBrandId, selectedProcess, searchQuery, pendingEdits, stageEdit, runSimulation, generateRoster, generating, } = useRosterStore();
    const dates = useMemo(() => getMonthDates(monthKey), [monthKey]);
    const holidaySet = useMemo(() => new Set(holidays.filter((h) => h.isPublicHoliday).map((h) => h.date.slice(0, 10))), [holidays]);
    const podMap = useMemo(() => new Map(pods.map((p) => [p.id, p])), [pods]);
    const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
    const ruleMap = useMemo(() => new Map(processRules.map((r) => [r.id, r])), [processRules]);
    const mergedShifts = useMemo(() => {
        const map = new Map();
        if (rosterVersion) {
            for (const s of rosterVersion.shiftEntries) {
                map.set(`${s.employeeId}:${s.date}`, {
                    employeeId: s.employeeId,
                    date: s.date,
                    shiftCode: s.shiftCode,
                    brandProcessRuleId: s.brandProcessRuleId,
                    notes: s.notes,
                });
            }
        }
        for (const [k, edit] of Object.entries(pendingEdits)) {
            map.set(k, edit);
        }
        return map;
    }, [rosterVersion, pendingEdits]);
    const filteredEmployees = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return employees.filter((e) => {
            if (!e.isActive)
                return false;
            if (selectedPodId !== 'ALL' && e.podId !== selectedPodId)
                return false;
            if (selectedProcess !== 'ALL' && !e.processSkillTags.includes(selectedProcess))
                return false;
            if (selectedBrandId !== 'ALL') {
                const brandRulesForBrand = new Set(processRules.filter((r) => r.brandId === selectedBrandId).map((r) => r.id));
                const hasAlloc = allocations.some((a) => a.employeeId === e.id && brandRulesForBrand.has(a.brandProcessRuleId));
                if (!hasAlloc)
                    return false;
            }
            if (q) {
                const podName = podMap.get(e.podId)?.name.toLowerCase() || '';
                if (!e.name.toLowerCase().includes(q) && !podName.includes(q))
                    return false;
            }
            return true;
        });
    }, [employees, selectedPodId, selectedProcess, selectedBrandId, searchQuery, processRules, allocations, podMap]);
    const filteredRules = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return processRules.filter((r) => {
            if (!r.isActive)
                return false;
            const brand = brandMap.get(r.brandId) || r.brand;
            if (selectedPodId !== 'ALL' && brand?.podId !== selectedPodId)
                return false;
            if (selectedBrandId !== 'ALL' && r.brandId !== selectedBrandId)
                return false;
            if (selectedProcess !== 'ALL' && r.process !== selectedProcess)
                return false;
            if (q && !(brand?.name.toLowerCase().includes(q) || r.process.toLowerCase().includes(q))) {
                return false;
            }
            return true;
        });
    }, [processRules, brandMap, selectedPodId, selectedBrandId, selectedProcess, searchQuery]);
    const isPublished = rosterVersion?.status === 'PUBLISHED';
    const matrixColumns = useMemo(() => {
        const baseCols = [
            {
                id: 'specialist',
                header: () => <span>Specialist / Pod</span>,
                cell: ({ row }) => {
                    const emp = row.original;
                    const pod = podMap.get(emp.podId);
                    const isLead = pod?.podLeadId === emp.id;
                    return (<div className="min-w-[126px] sm:min-w-[165px] lg:min-w-[195px] pr-1.5 sm:pr-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-semibold text-zinc-950 truncate max-w-[92px] sm:max-w-[135px]">{emp.name}</span>
                {isLead && (<span className="text-[8px] sm:text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-950 text-white shrink-0">
                    LEAD
                  </span>)}
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 text-[9px] sm:text-[10px] font-mono text-zinc-500">
                <span>{pod?.name.replace('Pod ', '')}</span>
                <span>/</span>
                <span>
                  {emp.roleType === 'FLOAT_BACKUP' ? 'FLOAT' : emp.roleType === 'SHARED' ? 'SHR' : 'DED'}
                </span>
              </div>
            </div>);
                },
            },
            {
                id: 'util',
                header: () => <span>Util</span>,
                cell: ({ row }) => {
                    const emp = row.original;
                    let work = 0;
                    let rest = 0;
                    for (const d of dates) {
                        const c = mergedShifts.get(`${emp.id}:${d}`)?.shiftCode;
                        if (c === ShiftCode.W || c === ShiftCode.BK)
                            work++;
                        else if (c === ShiftCode.WO || c === ShiftCode.PH)
                            rest++;
                    }
                    const pct = Math.round((work / Math.max(1, dates.length)) * 100);
                    return (<div className="font-mono text-[10px] text-center min-w-[36px] sm:min-w-[44px]">
              <div className="text-zinc-900 font-semibold tabular-nums">{pct}%</div>
              <div className="text-zinc-500 tabular-nums">{rest}R</div>
            </div>);
                },
            },
        ];
        const dayCols = dates.map((d) => {
            const h = shortDayHeader(d);
            const isPh = holidaySet.has(d);
            return {
                id: `day-${d}`,
                header: () => (<div className={`text-center font-mono leading-tight px-0.5 ${isPh ? 'text-zinc-950 underline' : h.isSun ? 'text-zinc-900' : 'text-zinc-500'}`}>
            <div className="text-[11px] font-semibold">{h.dayNum}</div>
            <div className="text-[9px]">{isPh ? 'PH' : h.dow}</div>
          </div>),
                cell: ({ row }) => {
                    const emp = row.original;
                    const key = `${emp.id}:${d}`;
                    const entry = mergedShifts.get(key);
                    const code = (entry?.shiftCode || ShiftCode.WO);
                    const rule = entry?.brandProcessRuleId ? ruleMap.get(entry.brandProcessRuleId) : null;
                    const brandName = rule ? (brandMap.get(rule.brandId)?.name || rule.brand?.name || '') : '';
                    return (<ShiftCell employeeId={emp.id} employeeName={emp.name} date={d} shiftCode={code} brandProcessRuleId={entry?.brandProcessRuleId ?? null} brandLabel={brandName.slice(0, 6)} isPending={Boolean(pendingEdits[key])} isLocked={isPublished} rules={processRules} onStageEdit={stageEdit} onSimulateDisruption={(date, empId) => runSimulation(date, [empId])}/>);
                },
            };
        });
        return [...baseCols, ...dayCols];
    }, [dates, holidaySet, podMap, mergedShifts, ruleMap, brandMap, pendingEdits, isPublished, processRules, stageEdit, runSimulation]);
    const table = useReactTable({
        data: filteredEmployees,
        columns: matrixColumns,
        getCoreRowModel: getCoreRowModel(),
    });
    if (!rosterVersion) {
        return (<div className="bg-white border border-zinc-200 rounded-lg p-12 text-center space-y-4">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-zinc-950">No Roster Generated for {monthKey}</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Run the CP-SAT solver to generate the monthly schedule across all pods, brands, and employees.
          </p>
        </div>
        <button onClick={() => generateRoster(monthKey)} disabled={generating} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`}/>
          <span>{generating ? 'Solving...' : `Generate ${monthKey} Roster`}</span>
        </button>
      </div>);
    }
    // ========== LENS 3: BRAND-WISE (DEMAND VIEW) ==========
    if (lens === 'BRAND') {
        const empMap = new Map(employees.map((e) => [e.id, e]));
        return (<div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="lg:hidden px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
          <span>Brand × Process Matrix</span>
          <span>Swipe horizontally →</span>
        </div>
        <div className="overflow-x-auto max-h-[68vh] sm:max-h-[72vh]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="sticky left-0 z-20 bg-zinc-50 px-2.5 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500 min-w-[148px] sm:min-w-[195px] lg:min-w-[230px] border-r border-zinc-200">
                  Brand × Process (Demand)
                </th>
                {dates.map((d) => {
                const h = shortDayHeader(d);
                const isPh = holidaySet.has(d);
                return (<th key={d} className={`px-1.5 py-2 text-center font-mono min-w-[48px] ${isPh ? 'bg-zinc-200/60 text-zinc-950' : h.isSun ? 'bg-zinc-100 text-zinc-800' : 'text-zinc-500'}`}>
                      <div className="text-[11px] font-semibold">{h.dayNum}</div>
                      <div className="text-[9px]">{isPh ? 'PH' : h.dow}</div>
                    </th>);
            })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredRules.map((rule) => {
                const brand = brandMap.get(rule.brandId) || rule.brand;
                const pod = brand ? podMap.get(brand.podId) : null;
                return (<tr key={rule.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="sticky left-0 z-10 bg-white px-2.5 sm:px-4 py-2 sm:py-2.5 border-r border-zinc-200">
                      <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2">
                        <span className="text-[11px] sm:text-xs font-semibold text-zinc-950">{brand?.name}</span>
                        <span className="font-mono text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {rule.process}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[9px] sm:text-[10px] font-mono text-zinc-500">
                        <span>{pod?.name?.replace('Pod ', '')}</span>
                        <span>/</span>
                        <span>{rule.operatingCalendar}</span>
                        <span>/</span>
                        <span className="text-zinc-800">Min {rule.minHeadcount}</span>
                      </div>
                    </td>
                    {dates.map((d) => {
                        const isPh = holidaySet.has(d);
                        const isSun = isUtcSunday(d);
                        const offCal = (rule.operatingCalendar === OperatingCalendar.EXCL_PH && isPh) ||
                            (rule.operatingCalendar === OperatingCalendar.EXCL_SUN_PH && (isSun || isPh));
                        if (offCal) {
                            return (<td key={d} className="p-1 text-center">
                            <span className="inline-block w-10 py-1.5 rounded text-[9px] font-mono text-zinc-400 bg-zinc-50">
                              OFF
                            </span>
                          </td>);
                        }
                        const assigned = [];
                        for (const e of employees) {
                            const sh = mergedShifts.get(`${e.id}:${d}`);
                            if (sh && sh.brandProcessRuleId === rule.id && (sh.shiftCode === 'W' || sh.shiftCode === 'BK')) {
                                assigned.push({ empId: e.id, name: empMap.get(e.id)?.name || e.id, code: sh.shiftCode });
                            }
                        }
                        const met = assigned.length >= rule.minHeadcount;
                        return (<td key={d} className="p-1 text-center">
                          {met ? (<button type="button" onClick={() => runSimulation(d, [assigned[0].empId])} title={`${assigned.map((a) => `${a.name} (${a.code})`).join(', ')} — Click to simulate disruption`} className={`w-10 h-8 rounded border text-[10px] font-mono font-semibold flex flex-col items-center justify-center cursor-pointer transition-colors ${assigned.some((a) => a.code === 'BK')
                                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200'
                                    : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'}`}>
                              <span>{assigned[0].name.split(' ')[0].slice(0, 5)}</span>
                              <span className="text-[8px] opacity-85">
                                {assigned[0].code} {assigned.length > 1 ? `+${assigned.length - 1}` : ''}
                              </span>
                            </button>) : (<span className="inline-flex w-10 h-8 items-center justify-center rounded bg-red-600 border border-red-700 text-[10px] font-mono font-bold text-white">
                              GAP
                            </span>)}
                        </td>);
                    })}
                  </tr>);
            })}
            </tbody>
          </table>
        </div>
      </div>);
    }
    // ========== LENS 4: PROCESS-WISE ==========
    if (lens === 'PROCESS') {
        const processes = Object.values(ProcessType).filter((p) => selectedProcess === 'ALL' || selectedProcess === p);
        return (<div className="space-y-4">
        {processes.map((proc) => {
                const procRules = filteredRules.filter((r) => r.process === proc);
                const procStaff = filteredEmployees.filter((e) => e.processSkillTags.includes(proc));
                return (<div key={proc} className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-zinc-950 text-white">
                    {proc}
                  </span>
                  <span className="text-xs font-medium text-zinc-700">
                    {procRules.length} Brand Rules / {procStaff.length} Certified Staff
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="grid grid-flow-col auto-cols-max gap-1.5 pb-1">
                  {dates.map((d) => {
                        const h = shortDayHeader(d);
                        const isPh = holidaySet.has(d);
                        let required = 0;
                        for (const r of procRules) {
                            const offCal = (r.operatingCalendar === OperatingCalendar.EXCL_PH && isPh) ||
                                (r.operatingCalendar === OperatingCalendar.EXCL_SUN_PH && (h.isSun || isPh));
                            if (!offCal)
                                required += r.minHeadcount;
                        }
                        let actual = 0;
                        for (const e of procStaff) {
                            const sh = mergedShifts.get(`${e.id}:${d}`);
                            if (sh && sh.brandProcessRuleId && (sh.shiftCode === 'W' || sh.shiftCode === 'BK')) {
                                if (ruleMap.get(sh.brandProcessRuleId)?.process === proc)
                                    actual++;
                            }
                        }
                        const ok = actual >= required;
                        return (<div key={d} className={`w-12 p-2 rounded border text-center font-mono ${ok
                                ? 'bg-zinc-50 border-zinc-200'
                                : 'bg-red-50 border-red-300'}`}>
                        <div className="text-[10px] text-zinc-500">
                          {h.dayNum} {h.dow}
                        </div>
                        <div className={`text-xs font-semibold mt-1 ${ok ? 'text-zinc-950' : 'text-red-700'}`}>
                          {actual}/{required}
                        </div>
                      </div>);
                    })}
                </div>
              </div>
            </div>);
            })}
      </div>);
    }
    // ========== LENS 5: EMPLOYEE-WISE (SUPPLY VIEW) ==========
    if (lens === 'EMPLOYEE') {
        return (<div className="space-y-3">
        {filteredEmployees.map((emp) => {
                const pod = podMap.get(emp.podId);
                let wCount = 0;
                let bkCount = 0;
                let restCount = 0;
                let sunOffCount = 0;
                let maxStreak = 0;
                let curStreak = 0;
                for (const d of dates) {
                    const c = mergedShifts.get(`${emp.id}:${d}`)?.shiftCode || ShiftCode.WO;
                    if (c === ShiftCode.W) {
                        wCount++;
                        curStreak++;
                        maxStreak = Math.max(maxStreak, curStreak);
                    }
                    else if (c === ShiftCode.BK) {
                        bkCount++;
                        curStreak++;
                        maxStreak = Math.max(maxStreak, curStreak);
                    }
                    else {
                        curStreak = 0;
                        if (c === ShiftCode.WO || c === ShiftCode.PH) {
                            restCount++;
                            if (isUtcSunday(d))
                                sunOffCount++;
                        }
                    }
                }
                return (<div key={emp.id} className="bg-white border border-zinc-200 rounded-lg p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                    {emp.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-950 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>{emp.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {pod?.name}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {emp.roleType}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      Skills: {emp.processSkillTags.join(', ')} • Preferred Off: {WEEKDAYS[emp.preferredWeeklyOff]}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-emerald-600 text-white">{wCount} W</span>
                  <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-900 border border-emerald-400">{bkCount} BK</span>
                  <span className="px-2 py-1 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {restCount} Rest ({sunOffCount} Sun)
                  </span>
                  <span className={`px-2 py-1 rounded border ${maxStreak <= 6
                        ? 'bg-white text-zinc-700 border-zinc-200'
                        : 'bg-red-50 text-red-700 border-red-300'}`}>
                    Streak: {maxStreak}d
                  </span>
                  <button type="button" onClick={() => {
                        const firstWork = dates.find((d) => {
                            const c = mergedShifts.get(`${emp.id}:${d}`)?.shiftCode;
                            return c === ShiftCode.W || c === ShiftCode.BK;
                        });
                        if (firstWork)
                            runSimulation(firstWork, [emp.id]);
                    }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 bg-white hover:bg-red-50 text-red-700 cursor-pointer">
                    <Flame className="w-3.5 h-3.5"/>
                    <span>Chaos Test</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-1 overflow-x-auto pb-1">
                {dates.map((d) => {
                        const key = `${emp.id}:${d}`;
                        const entry = mergedShifts.get(key);
                        const code = (entry?.shiftCode || ShiftCode.WO);
                        const rule = entry?.brandProcessRuleId ? ruleMap.get(entry.brandProcessRuleId) : null;
                        const brandName = rule ? (brandMap.get(rule.brandId)?.name || '') : '';
                        return (<div key={d} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-zinc-400">{d.slice(8)}</span>
                      <ShiftCell employeeId={emp.id} employeeName={emp.name} date={d} shiftCode={code} brandProcessRuleId={entry?.brandProcessRuleId ?? null} brandLabel={brandName.slice(0, 6)} isPending={Boolean(pendingEdits[key])} isLocked={isPublished} rules={processRules} onStageEdit={stageEdit} onSimulateDisruption={(date, empId) => runSimulation(date, [empId])}/>
                    </div>);
                    })}
              </div>
            </div>);
            })}
      </div>);
    }
    // ========== LENS 1 & 2: COMPANY-WIDE & POD-WISE ==========
    return (<div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="lg:hidden px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
        <span>Tap any cell to edit or simulate</span>
        <span>Swipe horizontally →</span>
      </div>
      <div className="overflow-x-auto max-h-[68vh] sm:max-h-[72vh]">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-30 bg-zinc-50 border-b border-zinc-200">
            {table.getHeaderGroups().map((hg) => (<tr key={hg.id}>
                {hg.headers.map((header, idx) => (<th key={header.id} className={`py-2 sm:py-2.5 px-1 sm:px-1.5 text-[10px] sm:text-[11px] font-mono uppercase text-zinc-500 ${idx === 0
                    ? 'sticky left-0 z-40 bg-zinc-50 pl-2.5 sm:pl-4 border-r border-zinc-200'
                    : idx === 1
                        ? 'bg-zinc-50 border-r border-zinc-200'
                        : ''}`}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>))}
              </tr>))}
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {table.getRowModel().rows.map((row) => (<tr key={row.id} className="hover:bg-zinc-50/80 transition-colors group">
                {row.getVisibleCells().map((cell, idx) => (<td key={cell.id} className={`py-1.5 px-1 ${idx === 0
                    ? 'sticky left-0 z-20 bg-white group-hover:bg-zinc-50 pl-2.5 sm:pl-4 border-r border-zinc-200'
                    : idx === 1
                        ? 'border-r border-zinc-200'
                        : ''}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>))}
              </tr>))}
          </tbody>
          <tfoot className="sticky bottom-0 z-30 bg-zinc-950 border-t-2 border-zinc-950 text-white">
            <tr>
              <td colSpan={2} className="sticky left-0 z-40 bg-zinc-950 px-2.5 sm:px-4 py-2.5 sm:py-3 border-r border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                  <span className="px-1.5 sm:px-2 py-0.5 rounded bg-white text-zinc-950 font-mono text-[9px] sm:text-[11px] font-bold tracking-wider uppercase w-fit">
                    DAILY HEADCOUNT
                  </span>
                  <span className="font-mono text-[9px] sm:text-[10px] text-zinc-400">
                    Active / Req
                  </span>
                </div>
              </td>
              {dates.map((d) => {
            const isPh = holidaySet.has(d);
            const isSun = isUtcSunday(d);
            let activeStaff = 0;
            for (const emp of filteredEmployees) {
                const c = mergedShifts.get(`${emp.id}:${d}`)?.shiftCode;
                if (c === ShiftCode.W || c === ShiftCode.BK)
                    activeStaff++;
            }
            let demand = 0;
            for (const r of filteredRules) {
                const offCal = (r.operatingCalendar === OperatingCalendar.EXCL_PH && isPh) ||
                    (r.operatingCalendar === OperatingCalendar.EXCL_SUN_PH && (isSun || isPh));
                if (!offCal)
                    demand += r.minHeadcount;
            }
            const healthy = activeStaff >= demand;
            return (<td key={d} className="py-2.5 px-1 text-center font-mono text-[10px]">
                    <div title={`${d}: ${activeStaff} working / ${demand} required`} className={`inline-flex items-center gap-0.5 px-1.5 py-1 rounded font-bold ${healthy
                    ? 'text-emerald-300 bg-emerald-950/90 border border-emerald-600/60'
                    : 'text-white bg-red-600 border border-red-500'}`}>
                      {healthy ? <ShieldCheck className="w-2.5 h-2.5"/> : <AlertTriangle className="w-2.5 h-2.5"/>}
                      <span>{activeStaff}</span>
                    </div>
                  </td>);
        })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>);
}
