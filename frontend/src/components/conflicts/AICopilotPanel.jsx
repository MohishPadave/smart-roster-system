'use client';
import React from 'react';
import { ArrowRight, CheckCircle2, FileText, Loader2, RefreshCw, X } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { ConflictInspector } from './ConflictInspector';
export function AICopilotPanel() {
    const { copilotOpen, copilotLoading, copilotExplanation, closeCopilot, openCopilot, unsatisfiableCore, clientValidation, spofItems, } = useRosterStore();
    if (!copilotOpen)
        return null;
    return (<div className="fixed inset-0 z-50 flex justify-end bg-black/35">
      <div className="w-full max-w-xl bg-white border-l border-zinc-200 h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-zinc-950 text-white flex items-center justify-center">
              <FileText className="w-4 h-4"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <span>Conflict &amp; Resolution Brief</span>
                {copilotExplanation && (<span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-800 uppercase">
                    {copilotExplanation.provider}
                  </span>)}
              </h2>
              <p className="text-[11px] text-zinc-500">
                Constraint infeasibility synthesis &amp; SPOF remediation
              </p>
            </div>
          </div>
          <button onClick={closeCopilot} className="p-1.5 rounded text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/60 cursor-pointer">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fafafa]">
          {copilotLoading ? (<div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 className="w-6 h-6 text-zinc-900 animate-spin"/>
              <p className="text-xs font-mono">Analyzing constraints &amp; SPOF topology...</p>
            </div>) : copilotExplanation ? (<>
              <div className="p-4 rounded-md bg-white border border-zinc-200 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Summary
                </div>
                <p className="text-sm text-zinc-950 leading-relaxed font-medium">
                  {copilotExplanation.summary}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Root Causes
                </h3>
                <div className="space-y-2">
                  {copilotExplanation.rootCauses.map((cause, idx) => (<div key={idx} className="flex items-start gap-2.5 p-3 rounded-md bg-white border border-zinc-200 text-xs text-zinc-800">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 text-white mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{cause}</span>
                    </div>))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Recommended Actions
                </h3>
                <div className="space-y-2">
                  {copilotExplanation.recommendedActions.map((action, idx) => (<div key={idx} className="flex items-start gap-2.5 p-3 rounded-md bg-white border border-zinc-300 text-xs text-zinc-900">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-700 shrink-0 mt-0.5"/>
                      <span className="leading-relaxed">{action}</span>
                    </div>))}
                </div>
              </div>
            </>) : null}

          <div className="space-y-2">
            <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
              Active Constraint Telemetry
            </h3>
            <ConflictInspector unsatisfiableCore={unsatisfiableCore} validation={clientValidation} onAskCopilot={() => openCopilot()}/>
            {spofItems.length > 0 && (<div className="p-3.5 rounded-md bg-white border border-zinc-200 space-y-2">
                <div className="text-[11px] font-mono font-semibold text-zinc-900">
                  {spofItems.length} SPOF Alert(s)
                </div>
                {spofItems.map((item, idx) => (<div key={idx} className="text-xs text-zinc-700 flex items-center justify-between border-t border-zinc-100 pt-2">
                    <span>
                      <strong className="text-zinc-950">{item.brand_name}</strong> ({item.process})
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                      {item.affected_dates.length} dates
                    </span>
                  </div>))}
              </div>)}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-200 bg-white flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-700"/>
            <span>Structured diagnostics</span>
          </span>
          <button onClick={() => openCopilot()} disabled={copilotLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5"/>
            <span>Re-Analyze</span>
          </button>
        </div>
      </div>
    </div>);
}
