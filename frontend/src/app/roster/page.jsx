'use client';
import React, { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { LensSwitcher } from '@/components/matrix/LensSwitcher';
import { RosterGrid } from '@/components/matrix/RosterGrid';
import { DisruptionDrawer } from '@/components/simulator/DisruptionDrawer';
import { RuleViolationAlert } from '@/components/conflicts/RuleViolationAlert';
import { ConflictInspector } from '@/components/conflicts/ConflictInspector';
export default function RosterPage() {
    const { monthKey, fetchRosterData, loading, rosterVersion, clientValidation, unsatisfiableCore, openCopilot, } = useRosterStore();
    const [auditOpen, setAuditOpen] = useState(false);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    useEffect(() => {
        fetchRosterData(monthKey);
    }, [monthKey, fetchRosterData]);
    return (<div className="space-y-4">
      <LensSwitcher onOpenAudit={() => setAuditOpen(true)}/>

      <RuleViolationAlert validation={clientValidation} onInspect={() => setInspectorOpen((prev) => !prev)}/>

      {(inspectorOpen || (unsatisfiableCore && unsatisfiableCore.length > 0)) && (<ConflictInspector unsatisfiableCore={unsatisfiableCore} validation={clientValidation} onAskCopilot={() => openCopilot()}/>)}

      {loading && !rosterVersion ? (<div className="bg-white border border-zinc-200 rounded-lg p-12 text-center text-xs font-mono text-zinc-500">
          Loading schedule matrix...
        </div>) : (<RosterGrid />)}

      <DisruptionDrawer />

      {auditOpen && rosterVersion && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-lg bg-white border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-700"/>
                <h3 className="text-sm font-semibold text-zinc-950">
                  Audit Trail ({rosterVersion.monthKey})
                </h3>
              </div>
              <button onClick={() => setAuditOpen(false)} className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto space-y-2.5">
              {(rosterVersion.auditLogs || []).length === 0 ? (<p className="text-xs text-zinc-500">No audit entries recorded yet.</p>) : ([...(rosterVersion.auditLogs || [])].reverse().map((log, i) => (<div key={i} className="p-3 rounded-md bg-zinc-50 border border-zinc-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 text-white">
                        {log.action}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-zinc-900">{log.details}</p>
                    <p className="text-[11px] text-zinc-500">Actor: {log.actor}</p>
                  </div>)))}
            </div>
          </div>
        </div>)}
    </div>);
}
