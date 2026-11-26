'use client';
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
export function ConfirmAlertModal({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = true, onConfirm, onCancel, }) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white border border-zinc-300 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${destructive ? 'text-red-600' : 'text-zinc-900'}`}/>
            <h3 className="text-xs font-semibold text-zinc-950 uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-900 cursor-pointer">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="p-4 text-xs text-zinc-700 leading-relaxed">{message}</div>

        <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-xs font-medium text-zinc-700 cursor-pointer">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`px-3 py-1.5 rounded-md text-xs font-medium text-white cursor-pointer ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-950 hover:bg-zinc-800'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}
