'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CalendarOff, Layers, Link2, Plus, Trash2, UserPlus, Users, } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { OperatingCalendar, ProcessType, RoleType } from '@/types/roster';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { ConfirmAlertModal } from '@/components/ui/ConfirmAlertModal';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function ConfigurationStudio() {
    const { showToast, fetchRosterData, monthKey, openAddEmployee, openAddBrand } = useRosterStore();
    const [tab, setTab] = useState('ALLOCATIONS');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [allocForm, setAllocForm] = useState({
        employeeId: '',
        brandProcessRuleId: '',
        assignmentType: 'SECONDARY_BACKUP',
        allocationWeight: 0.3,
    });
    const [empForm, setEmpForm] = useState({
        name: '',
        email: '',
        podId: '',
        roleType: RoleType.FLOAT_BACKUP,
        preferredWeeklyOff: 0,
        skills: [ProcessType.CS],
    });
    const [brandForm, setBrandForm] = useState({
        name: '',
        podId: '',
        accountTier: 'Standard',
        process: ProcessType.CS,
        operatingCalendar: OperatingCalendar.EXCL_PH,
        minHeadcount: 1,
    });
    const [leaveForm, setLeaveForm] = useState({
        employeeId: '',
        date: '2026-11-24',
        type: 'APPROVED_LEAVE',
        reason: '',
    });
    const [holidayForm, setHolidayForm] = useState({
        date: '2026-11-26',
        name: '',
    });
    const loadSnapshot = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/entities?include=all');
            if (res.ok) {
                const snap = await res.json();
                setData(snap);
                setAllocForm((prev) => ({
                    ...prev,
                    employeeId: prev.employeeId || snap.employees[0]?.id || '',
                    brandProcessRuleId: prev.brandProcessRuleId || snap.rules[0]?.id || '',
                }));
                setEmpForm((prev) => ({ ...prev, podId: prev.podId || snap.pods[0]?.id || '' }));
                setBrandForm((prev) => ({ ...prev, podId: prev.podId || snap.pods[0]?.id || '' }));
                setLeaveForm((prev) => ({ ...prev, employeeId: prev.employeeId || snap.employees[0]?.id || '' }));
            }
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        loadSnapshot();
    }, [loadSnapshot]);
    const mutate = async (url, method, body, successMsg = 'Saved') => {
        const res = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast('error', json.error || 'Operation failed');
            return false;
        }
        showToast('success', successMsg);
        await loadSnapshot();
        await fetchRosterData(monthKey);
        return true;
    };
    if (loading || !data) {
        return (<div className="bg-white border border-zinc-200 rounded-lg p-12 text-center text-xs font-mono text-zinc-500">
        Loading configuration...
      </div>);
    }
    const tabs = [
        { id: 'ALLOCATIONS', label: 'Allocations', count: data.allocations.length, icon: Link2 },
        { id: 'EMPLOYEES', label: 'Workforce', count: data.employees.length, icon: Users },
        { id: 'BRANDS', label: 'Brands & Rules', count: data.brands.length, icon: Building2 },
        { id: 'LEAVES', label: 'Leaves & Holidays', count: data.leaves.length + data.holidays.length, icon: CalendarOff },
        { id: 'PODS', label: 'Pods & Leads', count: data.pods.length, icon: Layers },
    ];
    const podOptions = data.pods.map((p) => ({ value: p.id, label: p.name }));
    const employeeOptions = data.employees.map((e) => ({
        value: e.id,
        label: e.name,
        sublabel: `${e.pod?.name || ''} • ${e.roleType}`,
    }));
    const ruleOptions = data.rules.map((r) => ({
        value: r.id,
        label: `${r.brand?.name || 'Brand'} — ${r.process}`,
        sublabel: r.operatingCalendar,
    }));
    return (<div className="space-y-6">
      {/* Header + Quick Actions + Tab Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
              Entity &amp; Constraint Configuration
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Manage Pods, Specialists, D2C Brand Operating Calendars, Float Backups, and Leave Locks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openAddEmployee} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 cursor-pointer">
              <UserPlus className="w-3.5 h-3.5 text-zinc-600"/>
              <span>New Employee</span>
            </button>
            <button type="button" onClick={openAddBrand} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-950 hover:bg-zinc-800 text-xs font-medium text-white cursor-pointer">
              <Building2 className="w-3.5 h-3.5"/>
              <span>New Brand</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-md border border-zinc-200 w-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (<button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/70'}`}>
                <Icon className="w-3.5 h-3.5"/>
                <span>{t.label}</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${active ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200 text-zinc-700'}`}>
                  {t.count}
                </span>
              </button>);
        })}
        </div>
      </div>

      {/* TAB 1: ALLOCATIONS */}
      {tab === 'ALLOCATIONS' && (<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={async (e) => {
                e.preventDefault();
                await mutate('/api/entities/allocations', 'POST', allocForm, 'Allocation added');
            }} className="lg:col-span-4 bg-white border border-zinc-200 rounded-lg p-5 space-y-4 h-fit">
            <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
              <Plus className="w-4 h-4 text-zinc-700"/>
              <span>Assign Primary / Backup</span>
            </h2>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-500">Specialist</label>
                <CustomSelect value={allocForm.employeeId} onChange={(v) => setAllocForm({ ...allocForm, employeeId: v })} options={employeeOptions}/>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-500">Brand × Process Rule</label>
                <CustomSelect value={allocForm.brandProcessRuleId} onChange={(v) => setAllocForm({ ...allocForm, brandProcessRuleId: v })} options={ruleOptions}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-500">Assignment Type</label>
                  <CustomSelect value={allocForm.assignmentType} onChange={(v) => setAllocForm({
                ...allocForm,
                assignmentType: v,
            })} options={[
                { value: 'PRIMARY', label: 'PRIMARY' },
                { value: 'SECONDARY_BACKUP', label: 'SECONDARY_BACKUP' },
            ]}/>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-500">FTE Weight</label>
                  <input type="number" step="0.1" min="0.1" max="1.0" value={allocForm.allocationWeight} onChange={(e) => setAllocForm({ ...allocForm, allocationWeight: Number(e.target.value) })} className="w-full px-3 py-2 rounded-md bg-white border border-zinc-300 text-zinc-900 font-mono"/>
                </div>
              </div>
              <button type="submit" className="w-full py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white font-medium cursor-pointer">
                Save Allocation
              </button>
            </div>
          </form>

          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[11px] font-mono text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Specialist</th>
                    <th className="px-4 py-3">Brand &amp; Process</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Weight</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.allocations.map((a) => (<tr key={a.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-semibold text-zinc-950">{a.employee?.name}</td>
                      <td className="px-4 py-2.5 text-zinc-700">
                        {a.brandProcessRule?.brand?.name}{' '}
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 ml-1">
                          {a.brandProcessRule?.process}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${a.assignmentType === 'PRIMARY'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-200'}`}>
                          {a.assignmentType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-zinc-700">{a.allocationWeight.toFixed(1)} FTE</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setPendingDelete({
                    url: `/api/entities/allocations?id=${a.id}`,
                    title: 'Remove Allocation',
                    message: `Remove ${a.employee?.name} from ${a.brandProcessRule?.brand?.name} (${a.brandProcessRule?.process})?`,
                    successMsg: 'Allocation deleted',
                })} className="p-1 rounded text-zinc-400 hover:text-red-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

      {/* TAB 2: EMPLOYEES */}
      {tab === 'EMPLOYEES' && (<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={async (e) => {
                e.preventDefault();
                const ok = await mutate('/api/entities/employees', 'POST', {
                    name: empForm.name,
                    email: empForm.email,
                    podId: empForm.podId,
                    roleType: empForm.roleType,
                    preferredWeeklyOff: empForm.preferredWeeklyOff,
                    processSkillTags: empForm.skills,
                }, 'Employee added');
                if (ok)
                    setEmpForm({ ...empForm, name: '', email: '' });
            }} className="lg:col-span-4 bg-white border border-zinc-200 rounded-lg p-5 space-y-3.5 h-fit text-xs">
            <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
              <Plus className="w-4 h-4 text-zinc-700"/>
              <span>Add Workforce Specialist</span>
            </h2>
            <input required placeholder="Full Name" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-3 py-2 rounded-md bg-white border border-zinc-300 text-zinc-900"/>
            <input required type="email" placeholder="Email address" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} className="w-full px-3 py-2 rounded-md bg-white border border-zinc-300 text-zinc-900"/>
            <div className="grid grid-cols-2 gap-2.5">
              <CustomSelect value={empForm.podId} onChange={(v) => setEmpForm({ ...empForm, podId: v })} options={podOptions}/>
              <CustomSelect value={empForm.roleType} onChange={(v) => setEmpForm({ ...empForm, roleType: v })} options={Object.values(RoleType).map((r) => ({ value: r, label: r }))}/>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-zinc-500">Preferred Weekly Off</label>
              <CustomSelect value={String(empForm.preferredWeeklyOff)} onChange={(v) => setEmpForm({ ...empForm, preferredWeeklyOff: Number(v) })} options={WEEKDAYS.map((day, idx) => ({ value: String(idx), label: day }))}/>
            </div>
            <div>
              <label className="text-[11px] font-mono text-zinc-500">Process Certifications</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
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
            <button type="submit" className="w-full py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white font-medium cursor-pointer">
              Create Specialist
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[11px] font-mono text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Pod</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Skills</th>
                    <th className="px-4 py-3">Pref WO</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.employees.map((emp) => (<tr key={emp.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-zinc-950">{emp.name}</div>
                        <div className="text-[10px] text-zinc-500">{emp.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-700">{emp.pod?.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-zinc-700">{emp.roleType}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-zinc-700">
                        {emp.processSkillTags.join(', ')}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 text-[11px]">
                        {WEEKDAYS[emp.preferredWeeklyOff]}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setPendingDelete({
                    url: `/api/entities/employees?id=${emp.id}`,
                    title: 'Remove Specialist',
                    message: `Delete ${emp.name} and their allocations/leaves from the database?`,
                    successMsg: 'Employee removed',
                })} className="p-1 rounded text-zinc-400 hover:text-red-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

      {/* TAB 3: BRANDS & RULES */}
      {tab === 'BRANDS' && (<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/entities/brands', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: brandForm.name,
                        podId: brandForm.podId,
                        accountTier: brandForm.accountTier,
                    }),
                });
                const json = await res.json();
                if (!res.ok) {
                    showToast('error', json.error || 'Failed to create brand');
                    return;
                }
                await mutate('/api/entities/rules', 'POST', {
                    brandId: json.brand.id,
                    process: brandForm.process,
                    operatingCalendar: brandForm.operatingCalendar,
                    minHeadcount: brandForm.minHeadcount,
                }, `Created ${brandForm.name} with ${brandForm.process} rule`);
                setBrandForm({ ...brandForm, name: '' });
            }} className="lg:col-span-4 bg-white border border-zinc-200 rounded-lg p-5 space-y-3.5 h-fit text-xs">
            <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
              <Plus className="w-4 h-4 text-zinc-700"/>
              <span>Add Brand &amp; Operating Rule</span>
            </h2>
            <input required placeholder="Brand Name" value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} className="w-full px-3 py-2 rounded-md bg-white border border-zinc-300 text-zinc-900"/>
            <div className="grid grid-cols-2 gap-2.5">
              <CustomSelect value={brandForm.podId} onChange={(v) => setBrandForm({ ...brandForm, podId: v })} options={podOptions}/>
              <CustomSelect value={brandForm.accountTier} onChange={(v) => setBrandForm({ ...brandForm, accountTier: v })} options={[
                { value: 'Premium', label: 'Premium' },
                { value: 'Standard', label: 'Standard' },
                { value: 'Basic', label: 'Basic' },
            ]}/>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <CustomSelect value={brandForm.process} onChange={(v) => setBrandForm({ ...brandForm, process: v })} options={Object.values(ProcessType).map((p) => ({ value: p, label: p }))}/>
              <CustomSelect value={brandForm.operatingCalendar} onChange={(v) => setBrandForm({ ...brandForm, operatingCalendar: v })} options={Object.values(OperatingCalendar).map((cal) => ({ value: cal, label: cal }))}/>
            </div>
            <button type="submit" className="w-full py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white font-medium cursor-pointer">
              Create Brand &amp; Rule
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200 text-[11px] font-mono text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Process</th>
                    <th className="px-4 py-3">Operating Calendar</th>
                    <th className="px-4 py-3">Min Headcount</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.rules.map((r) => (<tr key={r.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-semibold text-zinc-950">{r.brand?.name}</td>
                      <td className="px-4 py-2.5 font-mono text-zinc-800">{r.process}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-600">{r.operatingCalendar}</td>
                      <td className="px-4 py-2.5 font-mono text-zinc-900">{r.minHeadcount} FTE</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setPendingDelete({
                    url: `/api/entities/rules?id=${r.id}`,
                    title: 'Delete Process Rule',
                    message: `Delete ${r.brand?.name} — ${r.process} rule and its allocations?`,
                    successMsg: 'Rule deleted',
                })} className="p-1 rounded text-zinc-400 hover:text-red-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

      {/* TAB 4: LEAVES & HOLIDAYS */}
      {tab === 'LEAVES' && (<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-950">Employee Leave Locks (AL / CO)</h2>
            <form onSubmit={async (e) => {
                e.preventDefault();
                await mutate('/api/entities/leaves', 'POST', leaveForm, 'Leave added');
            }} className="grid grid-cols-2 gap-2.5 text-xs">
              <CustomSelect value={leaveForm.employeeId} onChange={(v) => setLeaveForm({ ...leaveForm, employeeId: v })} options={employeeOptions}/>
              <CustomDatePicker value={leaveForm.date} onChange={(d) => setLeaveForm({ ...leaveForm, date: d })}/>
              <CustomSelect value={leaveForm.type} onChange={(v) => setLeaveForm({ ...leaveForm, type: v })} options={[
                { value: 'APPROVED_LEAVE', label: 'APPROVED_LEAVE' },
                { value: 'COMP_OFF', label: 'COMP_OFF' },
            ]}/>
              <button type="submit" className="py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white font-medium cursor-pointer">
                Add Leave Lock
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.leaves.map((l) => (<div key={l.id} className="p-3 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-950">{l.employee?.name}</div>
                    <div className="font-mono text-[10px] text-zinc-600">
                      {l.date.slice(0, 10)} • {l.type} • {l.status}
                    </div>
                  </div>
                  <button onClick={() => setPendingDelete({
                    url: `/api/entities/leaves?id=${l.id}`,
                    title: 'Delete Leave Request',
                    message: `Remove leave for ${l.employee?.name} on ${l.date.slice(0, 10)}?`,
                    successMsg: 'Leave deleted',
                })} className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>))}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-950">Public Holiday Calendar (PH)</h2>
            <form onSubmit={async (e) => {
                e.preventDefault();
                const ok = await mutate('/api/entities/holidays', 'POST', { ...holidayForm, isPublicHoliday: true }, 'Public holiday added');
                if (ok)
                    setHolidayForm({ ...holidayForm, name: '' });
            }} className="flex flex-wrap gap-2.5 text-xs">
              <CustomDatePicker value={holidayForm.date} onChange={(d) => setHolidayForm({ ...holidayForm, date: d })}/>
              <input required placeholder="Holiday Name" value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} className="flex-1 px-3 py-2 rounded-md bg-white border border-zinc-300 text-zinc-900"/>
              <button type="submit" className="px-4 py-2 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white font-medium cursor-pointer">
                Add PH
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.holidays.map((h) => (<div key={h.id} className="p-3 rounded-md bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-950">{h.name}</div>
                    <div className="font-mono text-[10px] text-zinc-600">{h.date.slice(0, 10)}</div>
                  </div>
                  <button onClick={() => setPendingDelete({
                    url: `/api/entities/holidays?id=${h.id}`,
                    title: 'Delete Public Holiday',
                    message: `Remove ${h.name} (${h.date.slice(0, 10)}) from calendar?`,
                    successMsg: 'Holiday deleted',
                })} className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>))}
            </div>
          </div>
        </div>)}

      {/* TAB 5: PODS & LEADS */}
      {tab === 'PODS' && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.pods.map((pod) => {
                const podEmps = data.employees.filter((e) => e.podId === pod.id);
                const podBrands = data.brands.filter((b) => b.podId === pod.id);
                return (<div key={pod.id} className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-950">{pod.name}</h3>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                    {podEmps.length} Staff • {podBrands.length} Brands
                  </span>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-500">Designated Pod Lead</label>
                  <CustomSelect value={pod.podLeadId || ''} onChange={(v) => mutate('/api/entities/pods', 'PATCH', { id: pod.id, podLeadId: v || null }, 'Pod lead updated')} options={[
                        { value: '', label: 'Unassigned' },
                        ...podEmps.map((emp) => ({
                            value: emp.id,
                            label: emp.name,
                            sublabel: emp.roleType,
                        })),
                    ]}/>
                </div>
              </div>);
            })}
        </div>)}

      {/* Custom Confirmation Dialog */}
      <ConfirmAlertModal open={Boolean(pendingDelete)} title={pendingDelete?.title || 'Confirm Delete'} message={pendingDelete?.message || ''} confirmLabel="Delete" onConfirm={async () => {
            if (!pendingDelete)
                return;
            const target = pendingDelete;
            setPendingDelete(null);
            await mutate(target.url, 'DELETE', undefined, target.successMsg);
        }} onCancel={() => setPendingDelete(null)}/>
    </div>);
}
