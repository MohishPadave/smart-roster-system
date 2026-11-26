'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function CustomMonthPicker({ value, onChange, }) {
    const [open, setOpen] = useState(false);
    const [yearNum, monthNum] = value.split('-').map(Number);
    const [displayYear, setDisplayYear] = useState(yearNum || 2026);
    const ref = useRef(null);
    useEffect(() => {
        setDisplayYear(yearNum || 2026);
    }, [yearNum]);
    useEffect(() => {
        if (!open)
            return;
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);
    const label = `${MONTHS[(monthNum || 1) - 1]} ${yearNum}`;
    return (<div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-white text-xs font-mono text-zinc-900 cursor-pointer transition-colors ${open ? 'border-zinc-950' : 'border-zinc-200 hover:border-zinc-400'}`} aria-label="Select Month">
        <Calendar className="w-3.5 h-3.5 text-zinc-500"/>
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400"/>
      </button>

      {open && (<div className="absolute right-0 mt-1.5 z-50 w-56 max-w-[calc(100vw-1.5rem)] rounded-lg border border-zinc-300 bg-white shadow-xl p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <button type="button" onClick={() => setDisplayYear((y) => y - 1)} className="p-1 rounded hover:bg-zinc-100 text-zinc-600 cursor-pointer">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="font-mono text-xs font-semibold text-zinc-950">{displayYear}</span>
            <button type="button" onClick={() => setDisplayYear((y) => y + 1)} className="p-1 rounded hover:bg-zinc-100 text-zinc-600 cursor-pointer">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, idx) => {
                const key = `${displayYear}-${String(idx + 1).padStart(2, '0')}`;
                const active = key === value;
                return (<button key={m} type="button" onClick={() => {
                        onChange(key);
                        setOpen(false);
                    }} className={`py-1.5 rounded font-mono text-xs cursor-pointer transition-colors ${active
                        ? 'bg-zinc-950 text-white font-semibold'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200'}`}>
                  {m}
                </button>);
            })}
          </div>
        </div>)}
    </div>);
}
