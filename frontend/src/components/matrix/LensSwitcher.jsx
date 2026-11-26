'use client';
import React, { useState } from 'react';
import { Building2, Download, History, Layers, Lock, Redo2, RotateCcw, Save, Search, Tag, Undo2, Unlock, UserCheck, UserPlus, Users, } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { ProcessType } from '@/types/roster';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ConfirmAlertModal } from '@/components/ui/ConfirmAlertModal';
const LENSES = [
    { id: 'COMPANY', label: 'Company-Wide', icon: Users },
    { id: 'POD', label: 'Pod-Wise', icon: Layers },
    { id: 'BRAND', label: 'Brand-Wise', icon: Building2 },
    { id: 'PROCESS', label: 'Process-Wise', icon: Tag },
    { id: 'EMPLOYEE', label: 'Employee-Wise', icon: UserCheck },
];
export function LensSwitcher({ onOpenAudit }) {
    const { monthKey, lens, setLens, pods, brands, selectedPodId, setSelectedPodId, selectedBrandId, setSelectedBrandId, selectedProcess, setSelectedProcess, searchQuery, setSearchQuery, pendingEdits, undoStack, redoStack, undoEdit, redoEdit, discardEdits, commitEdits, committing, rosterVersion, togglePublish, clientValidation, openAddEmployee, openAddBrand, showToast, } = useRosterStore();
    const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);
    const pendingCount = Object.keys(pendingEdits).length;
    const isPublished = rosterVersion?.status === 'PUBLISHED';
    const handleExportCsv = async () => {
        setExportingCsv(true);
        try {
            const res = await fetch(`/api/roster/export?monthKey=${encodeURIComponent(monthKey)}&format=csv`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                showToast('error', err.error || `Generate a roster for ${monthKey} before exporting.`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `roster-${monthKey}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast('success', `Downloaded roster-${monthKey}.csv`);
        }
        catch {
            showToast('error', 'Failed to export CSV');
        }
        finally {
            setExportingCsv(false);
        }
    };
    return (<>
      <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3.5">
        {/* Row 1: 5 Stakeholder Lenses + Quick Add + Publish/Export */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-md border border-zinc-200">
            {LENSES.map((item) => {
            const active = lens === item.id;
            const Icon = item.icon;
            return (<button key={item.id} type="button" onClick={() => setLens(item.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/70'}`}>
                  <Icon className="w-3.5 h-3.5"/>
                  <span>{item.label}</span>
                </button>);
        })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openAddEmployee} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 cursor-pointer">
              <UserPlus className="w-3.5 h-3.5 text-zinc-600"/>
              <span>Employee</span>
            </button>

            <button type="button" onClick={openAddBrand} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 cursor-pointer">
              <Building2 className="w-3.5 h-3.5 text-zinc-600"/>
              <span>Brand</span>
            </button>

            {rosterVersion && (<>
                <button type="button" onClick={onOpenAudit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 cursor-pointer">
                  <History className="w-3.5 h-3.5 text-zinc-500"/>
                  <span>Audit ({rosterVersion.auditLogs?.length ?? 0})</span>
                </button>

                <button type="button" disabled={committing} onClick={() => togglePublish(isPublished ? 'UNLOCK' : 'PUBLISH', 'Pod Lead', isPublished ? 'Unlocked for schedule adjustments' : 'Signed off & published')} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${isPublished
                ? 'bg-zinc-950 border-zinc-950 text-white hover:bg-zinc-800'
                : 'bg-white border-zinc-300 text-zinc-900 hover:bg-zinc-50'}`}>
                  {isPublished ? <Unlock className="w-3.5 h-3.5"/> : <Lock className="w-3.5 h-3.5"/>}
                  <span>{isPublished ? 'Published (Unlock)' : 'Publish & Lock'}</span>
                </button>
              </>)}

            <button type="button" disabled={exportingCsv} onClick={handleExportCsv} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 text-xs font-mono text-zinc-700 cursor-pointer">
              <Download className="w-3.5 h-3.5 text-zinc-500"/>
              <span>{exportingCsv ? '...' : 'CSV'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Custom Filter Dropdowns + Undo/Redo/Commit OR Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter staff or brand..." className="pl-8 pr-3 py-1.5 rounded-md bg-white border border-zinc-300 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 w-44"/>
            </div>

            <CustomSelect size="sm" className="w-36" value={selectedPodId} onChange={setSelectedPodId} options={[
            { value: 'ALL', label: `All Pods (${pods.length})` },
            ...pods.map((p) => ({ value: p.id, label: p.name })),
        ]}/>

            <CustomSelect size="sm" className="w-44" value={selectedBrandId} onChange={setSelectedBrandId} options={[
            { value: 'ALL', label: `All Brands (${brands.length})` },
            ...brands.map((b) => ({ value: b.id, label: b.name })),
        ]}/>

            <CustomSelect size="sm" className="w-36" value={selectedProcess} onChange={setSelectedProcess} options={[
            { value: 'ALL', label: 'All Processes' },
            ...Object.values(ProcessType).map((proc) => ({ value: proc, label: proc })),
        ]}/>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 ? (<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-300">
                <span className="font-mono text-[11px] font-semibold text-zinc-900 mr-1">
                  {pendingCount} staged
                </span>
                <button type="button" onClick={undoEdit} disabled={undoStack.length === 0} className="p-1 rounded hover:bg-zinc-200 disabled:opacity-35 text-zinc-700 cursor-pointer" title="Undo">
                  <Undo2 className="w-3.5 h-3.5"/>
                </button>
                <button type="button" onClick={redoEdit} disabled={redoStack.length === 0} className="p-1 rounded hover:bg-zinc-200 disabled:opacity-35 text-zinc-700 cursor-pointer" title="Redo">
                  <Redo2 className="w-3.5 h-3.5"/>
                </button>
                <button type="button" onClick={discardEdits} className="p-1 rounded hover:bg-zinc-200 text-zinc-600 hover:text-red-700 cursor-pointer" title="Discard changes">
                  <RotateCcw className="w-3.5 h-3.5"/>
                </button>
                <button type="button" onClick={() => commitEdits('Operations Lead', false)} disabled={committing || clientValidation?.valid === false} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 text-white font-medium text-[11px] cursor-pointer">
                  <Save className="w-3 h-3"/>
                  <span>{committing ? 'Saving...' : 'Commit'}</span>
                </button>
                {clientValidation?.valid === false && (<button type="button" onClick={() => setOverrideConfirmOpen(true)} disabled={committing} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium text-[11px] cursor-pointer">
                    <span>Force Override</span>
                  </button>)}
              </div>) : (<div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white border border-emerald-700">
                  W Working
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-400">
                  BK Backup
                </span>
                <span className="px-2 py-0.5 rounded bg-white text-zinc-500 border border-zinc-200">
                  WO Off
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-300">
                  PH Holiday
                </span>
                <span className="px-2 py-0.5 rounded bg-red-600 text-white border border-red-700">
                  AL/CO Absent
                </span>
              </div>)}
          </div>
        </div>
      </div>

      <ConfirmAlertModal open={overrideConfirmOpen} title="Confirm Rule Override" message={`Staged edits introduce ${clientValidation?.p0Count ?? 0} P0 and ${clientValidation?.p1Count ?? 0} P1 rule violations. Force-saving will record an override entry in the roster audit log.`} confirmLabel="Force Save Overrides" onConfirm={() => {
            setOverrideConfirmOpen(false);
            commitEdits('Operations Lead', true);
        }} onCancel={() => setOverrideConfirmOpen(false)}/>
    </>);
}
