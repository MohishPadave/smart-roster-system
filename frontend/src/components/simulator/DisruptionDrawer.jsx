'use client';
import React from 'react';
import { CheckCircle2, Flame, Loader2, X } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { BackupCandidateCard } from './BackupCandidateCard';
import { CascadePreview } from './CascadePreview';
export function DisruptionDrawer() {
    const { simulatorOpen, simulating, committing, simulationResult, closeSimulator, commitSimulation, processRules, rosterVersion, } = useRosterStore();
    if (!simulatorOpen)
        return null;
    const ruleNames = new Map(processRules.map((r) => [r.id, `${r.brand?.name || 'Brand'} (${r.process})`]));
    const isPublished = rosterVersion?.status === 'PUBLISHED';
    return (<div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <div className="w-full max-w-xl bg-white border-l border-zinc-200 h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-950 text-white flex items-center justify-center">
              <Flame className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-950">Disruption Simulator</h2>
              <p className="text-[11px] text-zinc-500">
                Minimal-perturbation backup resolution
              </p>
            </div>
          </div>
          <button onClick={closeSimulator} className="p-1.5 rounded text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/60 cursor-pointer">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fafafa]">
          {simulating ? (<div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-6 h-6 text-zinc-900 animate-spin"/>
              <p className="text-xs font-mono">Reoptimizing schedule...</p>
            </div>) : simulationResult ? (<>
              <div className="p-4 rounded-md bg-white border border-zinc-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-red-700 font-semibold">
                    Simulated Unplanned Leave
                  </div>
                  <div className="text-sm font-semibold text-zinc-950 mt-0.5">
                    {simulationResult.disruptedEmployeeNames.join(', ')}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-0.5">
                    Date: {simulationResult.disruptionDate}
                  </div>
                </div>
                <div className="text-right font-mono text-xs space-y-0.5">
                  <div className="text-zinc-950 font-semibold">
                    {simulationResult.solver_duration_ms} ms
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {simulationResult.perturbation_count} change(s)
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Ranked Backup Candidates ({simulationResult.backup_candidates.length})
                </h3>
                {simulationResult.backup_candidates.length === 0 ? (<p className="text-xs text-zinc-500 p-3 rounded-md bg-white border border-zinc-200">
                    No backup swap required.
                  </p>) : (<div className="space-y-2">
                    {simulationResult.backup_candidates.map((cand, idx) => (<BackupCandidateCard key={cand.employee_id} candidate={cand} rank={idx + 1}/>))}
                  </div>)}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Impact Preview
                </h3>
                <CascadePreview diffItems={simulationResult.cascade_diff} ruleNames={ruleNames}/>
              </div>
            </>) : (<div className="py-12 text-center text-xs text-zinc-500">
              Select an active shift cell and choose &ldquo;Simulate Unplanned Leave&rdquo;.
            </div>)}
        </div>

        {simulationResult && (<div className="px-5 py-3.5 border-t border-zinc-200 bg-white flex items-center justify-between gap-3">
            <button onClick={closeSimulator} className="px-3.5 py-2 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 cursor-pointer">
              Cancel
            </button>
            <button onClick={() => commitSimulation()} disabled={committing || isPublished} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-xs font-medium text-white cursor-pointer">
              <CheckCircle2 className="w-3.5 h-3.5"/>
              <span>
                {isPublished
                ? 'Unlock Roster to Commit'
                : committing
                    ? 'Applying...'
                    : 'Commit Schedule'}
              </span>
            </button>
          </div>)}
      </div>
    </div>);
}
