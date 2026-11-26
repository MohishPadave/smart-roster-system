'use client';
import React from 'react';
import { GitCompare } from 'lucide-react';
import { DiffBadge } from '@/components/matrix/DiffBadge';
export function CascadePreview({ diffItems, ruleNames, }) {
    if (diffItems.length === 0) {
        return (<div className="p-4 rounded-md bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 text-center">
        No shift modifications required.
      </div>);
    }
    return (<div className="rounded-md border border-zinc-200 overflow-hidden bg-white">
      <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-900 flex items-center gap-2">
          <GitCompare className="w-3.5 h-3.5 text-zinc-600"/>
          <span>Cascade Diff ({diffItems.length} changes)</span>
        </span>
        <span className="font-mono text-[10px] text-zinc-500">Minimal-Perturbation</span>
      </div>
      <div className="divide-y divide-zinc-200 max-h-64 overflow-y-auto">
        {diffItems.map((item, idx) => (<div key={`${item.employee_id}-${item.date}-${idx}`} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-semibold text-zinc-950">{item.employee_name}</div>
              <div className="font-mono text-[10px] text-zinc-500">
                {item.date}
                {item.after_brand ? ` • ${ruleNames.get(item.after_brand) || item.after_brand}` : ''}
              </div>
            </div>
            <DiffBadge before={item.before_shift} after={item.after_shift}/>
          </div>))}
      </div>
    </div>);
}
