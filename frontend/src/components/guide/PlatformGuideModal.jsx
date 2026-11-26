'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Flame, Grid3X3, LayoutDashboard, RefreshCw, Settings, ShieldAlert, X, } from 'lucide-react';
const STEPS = [
    {
        id: 1,
        title: 'Overview & SPOF Risk Radar',
        subtitle: 'Understand workforce capacity, 80/20 brand structure, and single-point-of-failure risks.',
        routeLabel: 'Go to Overview',
        routeHref: '/dashboard',
        icon: LayoutDashboard,
        bullets: [
            {
                heading: 'Pods & 80/20 Brands',
                detail: 'Staff and brands are grouped into operational Pods. Most brands have 1 dedicated specialist (~80%), while multi-resource brands require multiple processes.',
            },
            {
                heading: 'SPOF Radar (Bus Factor = 1)',
                detail: 'Flags brands that have no secondary or float backup assigned. If that sole specialist takes leave, the brand loses coverage.',
            },
            {
                heading: 'Quick Add Staff & Brands',
                detail: 'Use "New Employee" and "New Brand" buttons on Overview, Schedule Matrix, or Configuration anytime to expand your roster.',
            },
        ],
        tip: 'Use "Conflict Brief" in the top bar anytime to get a plain-English summary of risks and recommended fixes.',
    },
    {
        id: 2,
        title: 'Generate & Lock Monthly Schedules',
        subtitle: 'Let the OR-Tools CP-SAT engine build an optimal conflict-free monthly schedule in under 1 second.',
        routeLabel: 'Open Schedule Matrix',
        routeHref: '/roster',
        icon: RefreshCw,
        bullets: [
            {
                heading: 'Click "Generate Roster" (Top Right)',
                detail: 'Solves all P0 rules (brand headcount, approved leaves AL/CO, public holidays PH, 1.0 FTE cap) and P1 rest rules (min 4 rest days, max 6 consecutive workdays).',
            },
            {
                heading: 'Month Switcher & Export',
                detail: 'Switch months with the top calendar dropdown and download the full matrix anytime using "Export" (.xlsx) or "CSV".',
            },
            {
                heading: 'Publish & Lock Sign-Off',
                detail: 'Once verified, click "Publish & Lock" to freeze the roster against accidental edits and log Pod Lead sign-off in the Audit Trail.',
            },
        ],
        tip: 'If constraints cannot be satisfied (e.g., overlapping leaves with 0 backups), the solver explains the exact conflict instead of saving a broken roster.',
    },
    {
        id: 3,
        title: 'Navigating the 5-Lens Schedule Matrix',
        subtitle: 'Switch views instantly without page reloads depending on what you need to inspect.',
        routeLabel: 'Open Schedule Matrix',
        routeHref: '/roster',
        icon: Grid3X3,
        bullets: [
            {
                heading: '5 Stakeholder Lenses',
                detail: 'Company-Wide (all staff), Pod-Wise (single pod), Brand-Wise (coverage per brand/day), Process-Wise (CS/ACC/NDR/RETENTION ratios), and Employee-Wise (streak & rest stats).',
            },
            {
                heading: 'Color Code Guide',
                detail: 'Green (W / BK) = Working or Backup Cover. Red (AL / CO) = Absent / Approved Leave. White (WO) = Weekly Off. Gray (PH) = Public Holiday.',
            },
            {
                heading: 'Inline Manual Overrides + Daily Headcount',
                detail: 'Click any shift cell to stage an edit with instant rule checking, Undo/Redo, and watch the highlighted DAILY HEADCOUNT bar at the bottom.',
            },
        ],
        tip: 'If the bottom DAILY HEADCOUNT bar turns red on any date, active working staff fell below required brand demand.',
    },
    {
        id: 4,
        title: 'Disruption Simulator & Configuration',
        subtitle: 'Test "What-If" unplanned absences and manage rules, allocations, leaves, and holidays.',
        routeLabel: 'Open Configuration',
        routeHref: '/configuration',
        icon: Settings,
        bullets: [
            {
                heading: 'Simulate Unplanned Leave',
                detail: 'Click any green working cell in the Schedule Matrix and select "Simulate Unplanned Leave" to freeze past dates, rank certified backups, and preview before/after diffs.',
            },
            {
                heading: 'Allocations & Float Backups',
                detail: 'In Configuration → Allocations, assign SECONDARY_BACKUP float specialists to resolve SPOF alerts highlighted on the Overview.',
            },
            {
                heading: 'Leaves & Public Holidays',
                detail: 'Add AL/CO leave locks or Public Holidays in Configuration → Leaves & Holidays, then re-run "Generate Roster" to reflect them.',
            },
        ],
        tip: 'You can reopen this walkthrough anytime by clicking "Guide" in the top navigation bar.',
    },
];
export function PlatformGuideModal({ open, onClose, }) {
    const router = useRouter();
    const [stepIdx, setStepIdx] = useState(0);
    if (!open)
        return null;
    const step = STEPS[stepIdx];
    const Icon = step.icon;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-white border border-zinc-300 shadow-2xl overflow-hidden">
        {/* Top Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-zinc-300 shrink-0"/>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Platform Navigation Guide</h2>
              <p className="text-[11px] font-mono text-zinc-400">
                Step {stepIdx + 1} of {STEPS.length}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer" aria-label="Close guide">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Stepper Pills */}
        <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-50 border-b border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {STEPS.map((s, idx) => {
            const active = idx === stepIdx;
            const visited = idx < stepIdx;
            return (<button key={s.id} type="button" onClick={() => setStepIdx(idx)} className={`px-2.5 py-1.5 sm:py-2 rounded-md border text-left transition-colors cursor-pointer ${active
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : visited
                        ? 'bg-white text-zinc-900 border-zinc-300'
                        : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'}`}>
                <div className="font-mono text-[10px] opacity-75">0{s.id}</div>
                <div className="text-[11px] font-semibold truncate">{s.title.split('&')[0]}</div>
              </button>);
        })}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-zinc-900"/>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-zinc-950">{step.title}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{step.subtitle}</p>
              </div>
            </div>

            <button type="button" onClick={() => {
            onClose();
            router.push(step.routeHref);
        }} className="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 cursor-pointer">
              {step.routeLabel}
            </button>
          </div>

          <div className="space-y-2.5">
            {step.bullets.map((b, i) => (<div key={i} className="p-3.5 rounded-md bg-zinc-50 border border-zinc-200 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-zinc-900 shrink-0 mt-0.5"/>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-zinc-950">{b.heading}</div>
                  <p className="text-zinc-600 leading-relaxed">{b.detail}</p>
                </div>
              </div>))}
          </div>

          {/* Visual Legend on Step 3 */}
          {step.id === 3 && (<div className="p-3 rounded-md bg-white border border-zinc-200 flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="text-zinc-500 mr-1">CELL KEY:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">W Working</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400">
                BK Backup
              </span>
              <span className="px-2 py-0.5 rounded bg-red-600 text-white">AL/CO Absent</span>
              <span className="px-2 py-0.5 rounded bg-white text-zinc-500 border border-zinc-200">
                WO Weekly Off
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300">
                PH Holiday
              </span>
            </div>)}

          {/* Tip Box */}
          <div className="p-3 rounded-md bg-zinc-950 text-zinc-100 text-xs flex items-start gap-2.5">
            {step.id === 4 ? (<Flame className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5"/>) : (<ShieldAlert className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5"/>)}
            <span>
              <strong className="text-white">Tip:</strong> {step.tip}
            </span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button type="button" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 disabled:opacity-40 text-xs font-medium text-zinc-800 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5"/>
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 hover:text-zinc-950 cursor-pointer">
              Skip Guide
            </button>
            {stepIdx < STEPS.length - 1 ? (<button type="button" onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white cursor-pointer">
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5"/>
              </button>) : (<button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white cursor-pointer">
                <span>Finish &amp; Start</span>
              </button>)}
          </div>
        </div>
      </div>
    </div>);
}
