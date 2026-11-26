'use client';
import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
export function RuleViolationAlert({ validation, onInspect, }) {
    if (!validation || validation.valid)
        return null;
    return (<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-red-700 shrink-0"/>
        <div>
          <div className="font-semibold text-red-900 flex items-center gap-2">
            <span>Constraint Guardrail Triggered</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white">
              {validation.p0Count} P0
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-white">
              {validation.p1Count} P1
            </span>
          </div>
          <p className="text-[11px] text-red-800 mt-0.5">
            {validation.coverageGaps.length > 0
            ? `${validation.coverageGaps.length} brand coverage gap(s)`
            : `${validation.violations[0]?.description || 'Rule violation detected'}`}
          </p>
        </div>
      </div>
      {onInspect && (<button onClick={onInspect} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-red-100 border border-red-300 text-red-800 font-medium cursor-pointer">
          <AlertTriangle className="w-3.5 h-3.5"/>
          <span>Inspect</span>
        </button>)}
    </div>);
}
