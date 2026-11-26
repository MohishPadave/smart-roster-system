'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export function CustomDatePicker({ value, onChange, }) {
    const [open, setOpen] = useState(false);
    const [y, m] = (value || '2026-11-01').split('-').map(Number);
    const [viewYear, setViewYear] = useState(y || 2026);
    const [viewMonth, setViewMonth] = useState(m || 11);
    const ref = useRef(null);
    useEffect(() => {
        if (y && m) {
            setViewYear(y);
            setViewMonth(m);
        }
    }, [y, m]);
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
    const firstDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const shiftMonth = (delta) => {
        const dt = new Date(Date.UTC(viewYear, viewMonth - 1 + delta, 1));
        setViewYear(dt.getUTCFullYear());
        setViewMonth(dt.getUTCMonth() + 1);
    };
    return (<div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((p) => !p)} className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-white font-mono text-xs text-zinc-900 cursor-pointer ${open ? 'border-zinc-950' : 'border-zinc-300 hover:border-zinc-400'}`}>
        <span>{value || 'YYYY-MM-DD'}</span>
        <Calendar className="w-3.5 h-3.5 text-zinc-500"/>
      </button>

      {open && (<div className="absolute left-0 mt-1 z-50 w-64 rounded-lg border border-zinc-300 bg-white shadow-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-zinc-100 text-zinc-600 cursor-pointer">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="font-mono text-xs font-semibold text-zinc-950">
              {MONTHS[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-zinc-100 text-zinc-600 cursor-pointer">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-zinc-400">
            {DAYS.map((d) => (<div key={d}>{d}</div>))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
            {Array.from({ length: firstDow }).map((_, i) => (<div key={`empty-${i}`}/>))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const active = dateStr === value;
                return (<button key={dateStr} type="button" onClick={() => {
                        onChange(dateStr);
                        setOpen(false);
                    }} className={`py-1 rounded cursor-pointer ${active
                        ? 'bg-zinc-950 text-white font-semibold'
                        : 'hover:bg-zinc-100 text-zinc-800'}`}>
                  {day}
                </button>);
            })}
          </div>
        </div>)}
    </div>);
}
