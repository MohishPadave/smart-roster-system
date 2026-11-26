'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, Lock, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { ConflictInspector } from '@/components/conflicts/ConflictInspector';
export function CommandDeck() {
    const { monthKey, rosterVersion, pods, employees, brands, processRules, allocations, generating, generateRoster, fetchRosterData, openCopilot, unsatisfiableCore, clientValidation, openAddEmployee, openAddBrand, } = useRosterStore();
    const [dashboard, setDashboard] = useState(null);
    const [loadingDash, setLoadingDash] = useState(true);
    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoadingDash(true);
            await fetchRosterData(monthKey);
            try {
                const res = await fetch(`/api/dashboard/spof?monthKey=${encodeURIComponent(monthKey)}`);
                if (res.ok && active) {
                    setDashboard(await res.json());
                }
            }
            finally {
                if (active)
                    setLoadingDash(false);
            }
        };
        load();
    }, [monthKey, fetchRosterData]);
    const kpis = dashboard?.kpis;
    const spofItems = dashboard?.spofAudit ?? [];
    const totalEmp = kpis?.activeEmployees ?? employees.length;
    const dedicated = kpis?.roleBreakdown.DEDICATED ?? 0;
    const shared = kpis?.roleBreakdown.SHARED ?? 0;
    const floatBackup = kpis?.roleBreakdown.FLOAT_BACKUP ?? 0;
    const singleBrands = kpis?.singleResourceBrands ?? 0;
    const multiBrands = kpis?.multiResourceBrands ?? 0;
    const totalBrands = Math.max(1, singleBrands + multiBrands);
    const singlePct = Math.round((singleBrands / totalBrands) * 100);
    const workingShiftsCount = rosterVersion?.shiftEntries.filter((s) => s.shiftCode === 'W' || s.shiftCode === 'BK').length ?? 0;
    const backupShiftsCount = rosterVersion?.shiftEntries.filter((s) => s.shiftCode === 'BK').length ?? 0;
    return (<div className="space-y-8">
      {/* Editorial Header Strip */}
      <section className="bg-white border border-zinc-200 rounded-lg p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              <span>Operations Cycle {monthKey}</span>
              {rosterVersion && (<>
                  <span>/</span>
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${rosterVersion.status === 'PUBLISHED'
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-800 border border-zinc-300'}`}>
                    {rosterVersion.status === 'PUBLISHED' ? 'PUBLISHED (LOCKED)' : 'DRAFT'}
                  </span>
                </>)}
            </div>
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-zinc-950">
              Workforce Scheduling &amp; Coverage Overview
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Constraint optimization across {totalEmp} active specialists,{' '}
              {kpis?.activeBrands ?? brands.length} D2C brands, and {kpis?.totalPods ?? pods.length} pods.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openAddEmployee} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 transition-colors cursor-pointer">
              <UserPlus className="w-3.5 h-3.5 text-zinc-600"/>
              <span>New Employee</span>
            </button>
            <button type="button" onClick={openAddBrand} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 transition-colors cursor-pointer">
              <Building2 className="w-3.5 h-3.5 text-zinc-600"/>
              <span>New Brand</span>
            </button>
            <button onClick={() => generateRoster(monthKey)} disabled={generating} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`}/>
              <span>{generating ? 'Solving...' : rosterVersion ? 'Re-Solve Schedule' : 'Generate Schedule'}</span>
            </button>
            <Link href="/roster" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 transition-colors">
              <span>Open Matrix</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500"/>
            </Link>
          </div>
        </div>

        {/* Solver Telemetry Strip */}
        {rosterVersion && (<div className="mt-6 pt-5 border-t border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Solve Time</div>
              <div className="mt-1 text-lg font-mono font-semibold text-zinc-950 tabular-nums">
                {rosterVersion.solverDurationMs ?? 0} ms
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Objective Score</div>
              <div className="mt-1 text-lg font-mono font-semibold text-zinc-950 tabular-nums">
                {rosterVersion.objectiveScore ?? 'Feasible'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Assigned Shifts</div>
              <div className="mt-1 text-lg font-mono font-semibold text-zinc-950 tabular-nums">
                {workingShiftsCount}{' '}
                <span className="text-xs font-normal text-zinc-500">({backupShiftsCount} backup)</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Rule Integrity</div>
              <div className="mt-1 text-lg font-mono font-semibold text-zinc-950 tabular-nums flex items-center gap-1.5">
                {rosterVersion.status === 'PUBLISHED' && <Lock className="w-3.5 h-3.5 text-zinc-700"/>}
                <span>
                  {clientValidation?.valid === false
                ? `${clientValidation.p0Count} P0 / ${clientValidation.p1Count} P1`
                : '0 Violations'}
                </span>
              </div>
            </div>
          </div>)}
      </section>

      {/* Solver Conflict Inspector */}
      {(unsatisfiableCore?.length || (clientValidation && !clientValidation.valid)) && (<ConflictInspector unsatisfiableCore={unsatisfiableCore} validation={clientValidation} onAskCopilot={() => openCopilot()}/>)}

      {/* 4 Monochrome Metric Tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-zinc-200 rounded-lg bg-white divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        {/* Metric 1 */}
        <div className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Workforce Supply
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono text-zinc-950 tabular-nums">{totalEmp}</span>
              <span className="text-xs text-zinc-500">active staff</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden flex">
              <div className="bg-zinc-950" style={{ width: `${totalEmp ? (dedicated / totalEmp) * 100 : 0}%` }}/>
              <div className="bg-zinc-500" style={{ width: `${totalEmp ? (shared / totalEmp) * 100 : 0}%` }}/>
              <div className="bg-zinc-300" style={{ width: `${totalEmp ? (floatBackup / totalEmp) * 100 : 0}%` }}/>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600">
              <span>{dedicated} DED</span>
              <span>{shared} SHR</span>
              <span>{floatBackup} FLT</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              80/20 Brand Topology
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono text-zinc-950 tabular-nums">
                {kpis?.activeBrands ?? brands.length}
              </span>
              <span className="text-xs text-zinc-500">D2C brands</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-950" style={{ width: `${singlePct}%` }}/>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600">
              <span>{singleBrands} Single ({singlePct}%)</span>
              <span>{multiBrands} Multi ({100 - singlePct}%)</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Demand &amp; Locks
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono text-zinc-950 tabular-nums">
                {kpis?.totalProcessRules ?? processRules.length}
              </span>
              <span className="text-xs text-zinc-500">process rules</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-[11px] font-mono">
            <div>
              <div className="text-zinc-400">Allocs</div>
              <div className="text-zinc-900 font-semibold">{kpis?.totalAllocations ?? allocations.length}</div>
            </div>
            <div>
              <div className="text-zinc-400">Leaves</div>
              <div className="text-zinc-900 font-semibold">{kpis?.approvedLeaves ?? 0}</div>
            </div>
            <div>
              <div className="text-zinc-400">Holidays</div>
              <div className="text-zinc-900 font-semibold">{kpis?.holidaysCount ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              SPOF Bus-Factor Audit
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-semibold font-mono tabular-nums ${spofItems.length > 0 ? 'text-red-600' : 'text-zinc-950'}`}>
                {loadingDash ? '—' : spofItems.length}
              </span>
              <span className="text-xs text-zinc-500">unbacked rules</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-[11px]">
            <span className="text-zinc-500">
              {spofItems.length > 0 ? 'Zero backup redundancy' : 'All rules backed up'}
            </span>
            <button onClick={() => openCopilot({ spofItems })} className="font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-600 cursor-pointer">
              Review Brief
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: SPOF Risk Table */}
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-zinc-700"/>
                <span>Single-Point-of-Failure (SPOF) Radar</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Single-resource brand-process rules operating without a secondary or float backup.
              </p>
            </div>
            <button onClick={() => openCopilot({ spofItems })} className="px-3 py-1.5 rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-xs font-medium text-zinc-800 cursor-pointer">
              Synthesize Mitigation
            </button>
          </div>

          {spofItems.length === 0 ? (<div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-5 h-5 text-zinc-900 mx-auto"/>
              <div className="text-sm font-medium text-zinc-900">No Single-Point-of-Failure Risks</div>
              <p className="text-xs text-zinc-500">All active brand-process rules have backup coverage.</p>
            </div>) : (<div className="divide-y divide-zinc-200">
              {spofItems.map((item, idx) => (<div key={`${item.brand_id}-${item.process}-${idx}`} className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${item.risk_level === 'HIGH'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-zinc-100 text-zinc-800 border border-zinc-300'}`}>
                        {item.risk_level} • BUS FACTOR 1
                      </span>
                      <span className="text-sm font-semibold text-zinc-950">{item.brand_name}</span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {item.process}
                      </span>
                    </div>
                    <Link href="/configuration" className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600">
                      Assign Backup
                    </Link>
                  </div>

                  <p className="text-xs text-zinc-600">{item.description}</p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono text-zinc-400 mr-1">DATES:</span>
                    {item.affected_dates.slice(0, 8).map((d) => (<span key={d} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-700 border border-zinc-200">
                        {d.slice(5)}
                      </span>))}
                    {item.affected_dates.length > 8 && (<span className="font-mono text-[10px] text-zinc-500">
                        +{item.affected_dates.length - 8} more
                      </span>)}
                  </div>
                </div>))}
            </div>)}
        </div>

        {/* Right: Pods + Constraint Rules */}
        <div className="lg:col-span-5 space-y-6">
          {/* Pods Table */}
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-950">Pod Structure &amp; Float Pool</h2>
              <Link href="/roster" className="text-xs text-zinc-600 hover:text-zinc-950 underline underline-offset-4">
                View Matrix
              </Link>
            </div>
            <div className="divide-y divide-zinc-200">
              {pods.map((pod) => {
            const podEmps = employees.filter((e) => e.podId === pod.id);
            const podBrands = brands.filter((b) => b.podId === pod.id);
            const podFloats = podEmps.filter((e) => e.roleType === 'FLOAT_BACKUP').length;
            return (<div key={pod.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-zinc-950 flex items-center gap-2">
                        <span>{pod.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                          {podFloats} float
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Lead: <span className="text-zinc-800">{pod.podLead?.name || 'Unassigned'}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums">
                      <div className="text-zinc-950 font-semibold">{podEmps.length} staff</div>
                      <div className="text-[11px] text-zinc-500">{podBrands.length} brands</div>
                    </div>
                  </div>);
        })}
            </div>
          </div>

          {/* Constraint Hierarchy */}
          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-950">Constraint Priority Matrix</h2>
            </div>
            <div className="divide-y divide-zinc-100 px-5 py-1 text-xs">
              {[
            { badge: 'HARD P0', hard: true, label: 'Brand & Process Coverage (>= minHeadcount)' },
            { badge: 'HARD P0', hard: true, label: 'Leave & Public Holiday Lock (AL / CO / PH)' },
            { badge: 'HARD P0', hard: true, label: 'Single-Assignment Daily Cap (<= 1.0 FTE)' },
            { badge: 'HARD P1', hard: true, label: 'Mandatory Weekly Offs (>= 4/cycle, <= 6 streak)' },
            { badge: 'SOFT W=10', hard: false, label: 'Primary Brand Continuity' },
            { badge: 'SOFT W=6', hard: false, label: 'Preferred Weekly-Off Day Honor' },
            { badge: 'SOFT W=4', hard: false, label: 'Equitable Sunday-Off Distribution' },
        ].map((rule, i) => (<div key={i} className="flex items-center justify-between py-2.5 gap-3">
                  <span className="text-zinc-700">{rule.label}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 ${rule.hard
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
                    {rule.badge}
                  </span>
                </div>))}
            </div>
          </div>
        </div>
      </section>
    </div>);
}
