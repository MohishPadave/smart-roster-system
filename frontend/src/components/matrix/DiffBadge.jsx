'use client';
import React from 'react';
import { ArrowRight } from 'lucide-react';
const SHIFT_COLORS = {
    W: 'bg-emerald-600 text-white border-emerald-700',
    BK: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    WO: 'bg-white text-zinc-500 border-zinc-200',
    PH: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    AL: 'bg-red-600 text-white border-red-700',
    CO: 'bg-red-600 text-white border-red-700',
};
export function DiffBadge({ before, after, }) {
    const b = before || '—';
    return (<span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
      <span className={`px-1.5 py-0.5 rounded border ${SHIFT_COLORS[b] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
        {b}
      </span>
      <ArrowRight className="w-3 h-3 text-zinc-400"/>
      <span className={`px-1.5 py-0.5 rounded border font-semibold ${SHIFT_COLORS[after] || 'bg-zinc-950 text-white border-zinc-950'}`}>
        {after}
      </span>
    </span>);
}
