'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="max-w-[1640px] mx-auto px-3 sm:px-5 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500 text-center sm:text-left">
        <span className="font-mono text-[11px]">
          Roster Engine • Constraint Workforce Scheduling
        </span>
        <a
          href="https://www.mohishpadave.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
        >
          <span>Developed by</span>
          <span className="underline underline-offset-4 font-semibold text-zinc-950">
            Mohish Padave
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
        </a>
      </div>
    </footer>
  );
}
