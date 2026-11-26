'use client';
import React, { useState } from 'react';
import { Check, Flame, X } from 'lucide-react';
import { ShiftCode } from '@/types/roster';
import { CustomSelect } from '@/components/ui/CustomSelect';
const CODE_STYLES = {
    W: 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700',
    BK: 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200',
    WO: 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700',
    PH: 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200',
    AL: 'bg-red-600 text-white border-red-700 hover:bg-red-700',
    CO: 'bg-red-600 text-white border-red-700 hover:bg-red-700',
};
export function ShiftCell({ employeeId, employeeName, date, shiftCode, brandProcessRuleId, brandLabel, isPending, isLocked, rules, onStageEdit, onSimulateDisruption, }) {
    const [open, setOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState(shiftCode);
    const [selectedRuleId, setSelectedRuleId] = useState(brandProcessRuleId || rules[0]?.id || '');
    const handleOpen = () => {
        setSelectedCode(shiftCode);
        setSelectedRuleId(brandProcessRuleId || rules[0]?.id || '');
        setOpen(true);
    };
    const handleApply = () => {
        const needsRule = selectedCode === ShiftCode.W || selectedCode === ShiftCode.BK;
        onStageEdit({
            employeeId,
            date,
            shiftCode: selectedCode,
            brandProcessRuleId: needsRule ? selectedRuleId || null : null,
            notes: 'Manual override',
        });
        setOpen(false);
    };
    return (<div className="relative">
      <button type="button" onClick={handleOpen} title={`${employeeName} • ${date} • ${shiftCode}${brandLabel ? ` (${brandLabel})` : ''}`} className={`w-10 h-8 rounded border text-[11px] font-mono font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer select-none ${CODE_STYLES[shiftCode]} ${isPending ? 'ring-2 ring-zinc-950 ring-offset-1 ring-offset-white' : ''}`}>
        <span className="leading-none">{shiftCode}</span>
        {brandLabel && (shiftCode === ShiftCode.W || shiftCode === ShiftCode.BK) && (<span className="text-[8px] font-normal opacity-75 leading-none mt-0.5 max-w-[34px] truncate">
            {brandLabel}
          </span>)}
      </button>

      {open && (<>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute left-0 top-9 z-50 w-68 p-3.5 rounded-lg bg-white border border-zinc-300 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <div>
                <div className="text-xs font-semibold text-zinc-950 truncate max-w-[180px]">{employeeName}</div>
                <div className="text-[10px] font-mono text-zinc-500">{date}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>

            {!isLocked ? (<>
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.values(ShiftCode).map((code) => (<button key={code} type="button" onClick={() => setSelectedCode(code)} className={`py-1 rounded text-[11px] font-mono font-semibold border cursor-pointer ${selectedCode === code
                        ? 'bg-zinc-950 border-zinc-950 text-white'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-950'}`}>
                      {code}
                    </button>))}
                </div>

                {(selectedCode === ShiftCode.W || selectedCode === ShiftCode.BK) && (<div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-zinc-500">
                      Brand / Process Rule
                    </label>
                    <CustomSelect size="sm" value={selectedRuleId} onChange={setSelectedRuleId} options={rules.map((r) => ({
                        value: r.id,
                        label: `${r.brand?.name || 'Brand'} — ${r.process}`,
                        sublabel: r.operatingCalendar,
                    }))}/>
                  </div>)}

                <button type="button" onClick={handleApply} className="w-full py-1.5 rounded bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                  <Check className="w-3.5 h-3.5"/>
                  <span>Stage Override</span>
                </button>
              </>) : (<p className="text-[11px] text-zinc-700 bg-zinc-100 border border-zinc-200 rounded p-2">
                Roster is PUBLISHED and locked. Unlock to edit shifts.
              </p>)}

            {(shiftCode === ShiftCode.W || shiftCode === ShiftCode.BK) && (<button type="button" onClick={() => {
                    setOpen(false);
                    onSimulateDisruption(date, employeeId);
                }} className="w-full py-1.5 rounded bg-white hover:bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer">
                <Flame className="w-3.5 h-3.5"/>
                <span>Simulate Unplanned Leave</span>
              </button>)}
          </div>
        </>)}
    </div>);
}
