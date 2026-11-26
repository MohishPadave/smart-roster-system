'use client';
import React, { useEffect, useState } from 'react';
import { Building2, UserPlus, X } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { OperatingCalendar, ProcessType, RoleType } from '@/types/roster';
import { CustomSelect } from '@/components/ui/CustomSelect';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function QuickCreateModals({ onCreated }) {
    const { pods, processRules, addEmployeeModalOpen, addBrandModalOpen, closeEntityModals, fetchRosterData, monthKey, showToast, } = useRosterStore();
    const [empForm, setEmpForm] = useState({
        name: '',
        email: '',
        podId: '',
        roleType: RoleType.DEDICATED,
        preferredWeeklyOff: '0',
        skills: [ProcessType.CS],
        initialRuleId: '',
        assignmentType: 'PRIMARY',
    });
    const [brandForm, setBrandForm] = useState({
        name: '',
        podId: '',
        accountTier: 'Standard',
        process: ProcessType.CS,
        operatingCalendar: OperatingCalendar.EXCL_PH,
        minHeadcount: 1,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (pods.length > 0) {
            setEmpForm((prev) => ({ ...prev, podId: prev.podId || pods[0].id }));
            setBrandForm((prev) => ({ ...prev, podId: prev.podId || pods[0].id }));
        }
    }, [pods]);
    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/entities/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: empForm.name,
                    email: empForm.email,
                    podId: empForm.podId,
                    roleType: empForm.roleType,
                    preferredWeeklyOff: Number(empForm.preferredWeeklyOff),
                    processSkillTags: empForm.skills,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Failed to add employee');
                setSubmitting(false);
                return;
            }
            // Optional initial brand allocation
            if (empForm.initialRuleId) {
                await fetch('/api/entities/allocations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employeeId: json.employee.id,
                        brandProcessRuleId: empForm.initialRuleId,
                        assignmentType: empForm.assignmentType,
                        allocationWeight: empForm.assignmentType === 'PRIMARY' ? 1.0 : 0.3,
                    }),
                });
            }
            showToast('success', `Added employee ${empForm.name}`);
            setEmpForm((prev) => ({ ...prev, name: '', email: '', initialRuleId: '' }));
            setSubmitting(false);
            closeEntityModals();
            await fetchRosterData(monthKey);
            onCreated?.();
        }
        catch {
            setError('Network error while creating employee');
            setSubmitting(false);
        }
    };
    const handleCreateBrand = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const brandRes = await fetch('/api/entities/brands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: brandForm.name,
                    podId: brandForm.podId,
                    accountTier: brandForm.accountTier,
                }),
            });
            const brandJson = await brandRes.json();
            if (!brandRes.ok) {
                setError(brandJson.error || 'Failed to create brand');
                setSubmitting(false);
                return;
            }
            const ruleRes = await fetch('/api/entities/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    brandId: brandJson.brand.id,
                    process: brandForm.process,
                    operatingCalendar: brandForm.operatingCalendar,
                    minHeadcount: brandForm.minHeadcount,
                }),
            });
            if (!ruleRes.ok) {
                const ruleJson = await ruleRes.json().catch(() => ({}));
                setError(ruleJson.error || 'Brand created, but process rule failed');
                setSubmitting(false);
                return;
            }
            showToast('success', `Added brand ${brandForm.name} (${brandForm.process})`);
            setBrandForm((prev) => ({ ...prev, name: '' }));
            setSubmitting(false);
            closeEntityModals();
            await fetchRosterData(monthKey);
            onCreated?.();
        }
        catch {
            setError('Network error while creating brand');
            setSubmitting(false);
        }
    };
    const podOptions = pods.map((p) => ({ value: p.id, label: p.name }));
    const ruleOptions = [
        { value: '', label: 'None (assign later)' },
        ...processRules.map((r) => ({
            value: r.id,
            label: `${r.brand?.name || 'Brand'} — ${r.process}`,
            sublabel: r.operatingCalendar,
        })),
    ];
    return (<>
      {/* Add Employee Modal */}
      {addEmployeeModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-zinc-300 shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-zinc-900"/>
                <h2 className="text-sm font-semibold text-zinc-950">Add New Employee</h2>
              </div>
              <button type="button" onClick={() => {
                setError(null);
                closeEntityModals();
            }} className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-5 space-y-3.5 text-xs">
              {error && (<div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 font-medium">
                  {error}
                </div>)}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Full Name</label>
                  <input required value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} placeholder="e.g. Rohan Mehta" className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-950 focus:outline-none focus:border-zinc-950"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Email</label>
                  <input required type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} placeholder="rohan@company.com" className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-950 focus:outline-none focus:border-zinc-950"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Pod</label>
                  <CustomSelect value={empForm.podId} onChange={(v) => setEmpForm({ ...empForm, podId: v })} options={podOptions}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Role Type</label>
                  <CustomSelect value={empForm.roleType} onChange={(v) => setEmpForm({ ...empForm, roleType: v })} options={Object.values(RoleType).map((r) => ({ value: r, label: r }))}/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700">Preferred Weekly Off</label>
                <CustomSelect value={empForm.preferredWeeklyOff} onChange={(v) => setEmpForm({ ...empForm, preferredWeeklyOff: v })} options={WEEKDAYS.map((day, idx) => ({ value: String(idx), label: day }))}/>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700">Process Certifications</label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(ProcessType).map((proc) => {
                const selected = empForm.skills.includes(proc);
                return (<button type="button" key={proc} onClick={() => setEmpForm({
                        ...empForm,
                        skills: selected
                            ? empForm.skills.filter((s) => s !== proc)
                            : [...empForm.skills, proc],
                    })} className={`px-2.5 py-1 rounded font-mono text-[11px] border cursor-pointer ${selected
                        ? 'bg-zinc-950 border-zinc-950 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600'}`}>
                        {proc}
                      </button>);
            })}
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Initial Brand Rule (Optional)</label>
                  <CustomSelect value={empForm.initialRuleId} onChange={(v) => setEmpForm({ ...empForm, initialRuleId: v })} options={ruleOptions}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Allocation Type</label>
                  <CustomSelect value={empForm.assignmentType} onChange={(v) => setEmpForm({ ...empForm, assignmentType: v })} options={[
                { value: 'PRIMARY', label: 'PRIMARY (1.0 FTE)' },
                { value: 'SECONDARY_BACKUP', label: 'SECONDARY_BACKUP (0.3)' },
            ]}/>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => {
                setError(null);
                closeEntityModals();
            }} className="px-3.5 py-2 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium cursor-pointer">
                  {submitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Add Brand Modal */}
      {addBrandModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-zinc-300 shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-900"/>
                <h2 className="text-sm font-semibold text-zinc-950">Add New D2C Brand</h2>
              </div>
              <button type="button" onClick={() => {
                setError(null);
                closeEntityModals();
            }} className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
                <X className="w-4 h-4"/>
              </button>
            </div>

            <form onSubmit={handleCreateBrand} className="p-5 space-y-3.5 text-xs">
              {error && (<div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 font-medium">
                  {error}
                </div>)}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700">Brand Name</label>
                <input required value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} placeholder="e.g. UrbanRoast" className="w-full px-3 py-2 rounded-md border border-zinc-300 text-zinc-950 focus:outline-none focus:border-zinc-950"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Pod Ownership</label>
                  <CustomSelect value={brandForm.podId} onChange={(v) => setBrandForm({ ...brandForm, podId: v })} options={podOptions}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Account Tier</label>
                  <CustomSelect value={brandForm.accountTier} onChange={(v) => setBrandForm({ ...brandForm, accountTier: v })} options={[
                { value: 'Premium', label: 'Premium' },
                { value: 'Standard', label: 'Standard' },
                { value: 'Basic', label: 'Basic' },
            ]}/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Primary Process</label>
                  <CustomSelect value={brandForm.process} onChange={(v) => setBrandForm({ ...brandForm, process: v })} options={Object.values(ProcessType).map((p) => ({ value: p, label: p }))}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-700">Operating Calendar</label>
                  <CustomSelect value={brandForm.operatingCalendar} onChange={(v) => setBrandForm({ ...brandForm, operatingCalendar: v })} options={[
                { value: OperatingCalendar.ALL_365, label: 'ALL_365', sublabel: 'Every day (365d)' },
                { value: OperatingCalendar.EXCL_PH, label: 'EXCL_PH', sublabel: 'Excl Public Holidays' },
                { value: OperatingCalendar.EXCL_SUN_PH, label: 'EXCL_SUN_PH', sublabel: 'Mon–Sat only' },
            ]}/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700">Minimum Daily Headcount</label>
                <input type="number" min={1} max={10} value={brandForm.minHeadcount} onChange={(e) => setBrandForm({ ...brandForm, minHeadcount: Number(e.target.value) || 1 })} className="w-full px-3 py-2 rounded-md border border-zinc-300 font-mono text-zinc-950 focus:outline-none focus:border-zinc-950"/>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => {
                setError(null);
                closeEntityModals();
            }} className="px-3.5 py-2 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-medium cursor-pointer">
                  {submitting ? 'Creating...' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </>);
}
