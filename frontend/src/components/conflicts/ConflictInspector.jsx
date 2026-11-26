'use client';
import React from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Wrench } from 'lucide-react';
export function ConflictInspector({ unsatisfiableCore, validation, onAskCopilot, }) {
    const hasCore = unsatisfiableCore && unsatisfiableCore.length > 0;
    const hasValidationIssues = validation && !validation.valid;
    if (!hasCore && !hasValidationIssues) {
        return (<div className="p-4 rounded-md bg-white border border-zinc-200 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-zinc-900 shrink-0"/>
        <p className="text-xs text-zinc-700">
          All P0 coverage, leave lock, 1.0 FTE capacity, and P1 rest constraints are satisfied.
        </p>
      </div>);
    }
    return (<div className="space-y-3">
      {hasCore && (<div className="p-4 rounded-md bg-white border border-red-300 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-700 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4"/>
              <span>Unsatisfiable Core Diagnostics</span>
            </div>
            <button onClick={onAskCopilot} className="text-[11px] px-2.5 py-1 rounded bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer">
              Explain
            </button>
          </div>
          {unsatisfiableCore.map((item, idx) => (<div key={idx} className="p-3 rounded bg-zinc-50 border border-zinc-200 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                  {item.constraint_type}
                </span>
                <span className="font-medium text-zinc-900">{item.description}</span>
              </div>
              <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
                <Wrench className="w-3 h-3 shrink-0"/>
                <span>{item.remediation_hint}</span>
              </p>
            </div>))}
        </div>)}

      {hasValidationIssues && (<div className="p-4 rounded-md bg-white border border-zinc-300 space-y-2 max-h-64 overflow-y-auto">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-950 uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-red-600"/>
            <span>
              Rule Violations ({validation.violations.length}) &amp; Coverage Gaps ({validation.coverageGaps.length})
            </span>
          </div>
          {validation.coverageGaps.slice(0, 12).map((gap, i) => (<div key={`gap-${i}`} className="flex items-center justify-between text-xs px-3 py-2 rounded bg-red-50 border border-red-200">
              <div>
                <span className="font-semibold text-zinc-950">{gap.brandName}</span>
                <span className="text-zinc-400 mx-1.5">/</span>
                <span className="font-mono text-[11px] text-zinc-700">{gap.process}</span>
                <span className="text-zinc-400 mx-1.5">/</span>
                <span className="font-mono text-[11px] text-zinc-700">{gap.date}</span>
              </div>
              <span className="font-mono text-[11px] text-red-700 font-semibold">
                {gap.actualHeadcount}/{gap.requiredHeadcount} FTE
              </span>
            </div>))}
          {validation.violations.slice(0, 12).map((v, i) => (<div key={`vio-${i}`} className="flex items-center justify-between text-xs px-3 py-2 rounded bg-zinc-50 border border-zinc-200">
              <div>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded mr-2 ${v.severity === 'P0' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'}`}>
                  {v.severity}
                </span>
                <span className="font-semibold text-zinc-950">{v.employeeName}</span>
                <span className="text-zinc-500 mx-1.5">({v.date})</span>
                <span className="text-zinc-700">{v.description}</span>
              </div>
            </div>))}
        </div>)}
    </div>);
}
