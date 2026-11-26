'use client';
import React from 'react';
import { Award, UserCheck } from 'lucide-react';
export function BackupCandidateCard({ candidate, rank, }) {
    const pct = Math.min(100, Math.max(10, Math.round((candidate.score / 15) * 100)));
    return (<div className="p-3.5 rounded-md bg-white border border-zinc-200 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`w-6 h-6 rounded font-mono text-xs font-semibold flex items-center justify-center ${rank === 1
            ? 'bg-zinc-950 text-white'
            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
            #{rank}
          </span>
          <div>
            <div className="text-xs font-semibold text-zinc-950 flex items-center gap-1.5">
              <span>{candidate.employee_name}</span>
              {rank === 1 && <Award className="w-3.5 h-3.5 text-zinc-700"/>}
            </div>
            <p className="text-[11px] text-zinc-500">{candidate.reason}</p>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-xs font-semibold text-zinc-950 tabular-nums">
            {candidate.score.toFixed(1)} pts
          </div>
          <div className="text-[10px] text-zinc-500 flex items-center justify-end gap-1">
            <UserCheck className="w-3 h-3"/>
            <span>Certified</span>
          </div>
        </div>
      </div>

      <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div className="h-full bg-zinc-950 rounded-full" style={{ width: `${pct}%` }}/>
      </div>
    </div>);
}
