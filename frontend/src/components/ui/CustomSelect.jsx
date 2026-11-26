'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
export function CustomSelect({ value, onChange, options, placeholder = 'Select...', searchable, size = 'md', className = '', disabled = false, }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);
    const showSearch = searchable ?? options.length > 8;
    const selected = options.find((o) => o.value === value);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return options;
        return options.filter((o) => o.label.toLowerCase().includes(q) ||
            (o.sublabel && o.sublabel.toLowerCase().includes(q)));
    }, [options, query]);
    useEffect(() => {
        if (!open)
            return;
        const handleOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
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
    return (<div ref={containerRef} className={`relative ${className}`}>
      <button type="button" disabled={disabled} onClick={() => {
            setQuery('');
            setOpen((prev) => !prev);
        }} className={`w-full flex items-center justify-between gap-2 rounded-md border bg-white text-left transition-colors cursor-pointer disabled:opacity-50 ${open ? 'border-zinc-950 ring-1 ring-zinc-950/10' : 'border-zinc-300 hover:border-zinc-400'} ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'}`}>
        <span className={`truncate ${selected ? 'text-zinc-950 font-medium' : 'text-zinc-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180 text-zinc-950' : ''}`}/>
      </button>

      {open && (<div className="absolute left-0 right-0 mt-1 z-50 min-w-[180px] max-w-[calc(100vw-2rem)] rounded-md border border-zinc-300 bg-white shadow-xl overflow-hidden">
          {showSearch && (<div className="p-2 border-b border-zinc-100 bg-zinc-50">
              <div className="relative">
                <Search className="w-3 h-3 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2"/>
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." className="w-full pl-7 pr-2.5 py-1 rounded border border-zinc-200 bg-white text-xs text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"/>
              </div>
            </div>)}

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (<div className="px-3 py-2 text-xs text-zinc-400 text-center">No matches</div>) : (filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (<button key={opt.value} type="button" onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                    }} className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-xs cursor-pointer transition-colors ${isSelected
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-800 hover:bg-zinc-100'}`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{opt.label}</div>
                      {opt.sublabel && (<div className={`text-[10px] font-mono truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                          {opt.sublabel}
                        </div>)}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0"/>}
                  </button>);
            }))}
          </div>
        </div>)}
    </div>);
}
