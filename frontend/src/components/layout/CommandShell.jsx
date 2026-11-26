'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, BookOpen, CheckCircle2, Download, FileText, Grid3X3, LayoutDashboard, LogOut, RefreshCw, Settings, X, } from 'lucide-react';
import { useRosterStore } from '@/stores/rosterStore';
import { AICopilotPanel } from '@/components/conflicts/AICopilotPanel';
import { CustomMonthPicker } from '@/components/ui/CustomMonthPicker';
import { QuickCreateModals } from '@/components/entities/QuickCreateModals';
import { PlatformGuideModal } from '@/components/guide/PlatformGuideModal';
import { Footer } from '@/components/layout/Footer';
const NAV_ITEMS = [
    { href: '/dashboard', match: ['/', '/dashboard'], label: 'Overview', icon: LayoutDashboard },
    { href: '/roster', match: ['/roster'], label: 'Schedule Matrix', icon: Grid3X3 },
    { href: '/configuration', match: ['/configuration'], label: 'Configuration', icon: Settings },
];
export function CommandShell({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const isAuthRoute = pathname === '/login' || pathname === '/forgot-password';
    const [health, setHealth] = useState(null);
    const [user, setUser] = useState(null);
    const [guideOpen, setGuideOpen] = useState(false);
    const { monthKey, setMonthKey, fetchRosterData, generateRoster, generating, toast, clearToast, showToast, openCopilot, spofItems, } = useRosterStore();
    const [exporting, setExporting] = useState(false);
    useEffect(() => {
        if (isAuthRoute)
            return;
        let active = true;
        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health');
                if (res.ok && active) {
                    setHealth(await res.json());
                }
            }
            catch {
                if (active) {
                    setHealth({
                        healthy: false,
                        services: { postgres: { healthy: false }, solver: { healthy: false } },
                    });
                }
            }
        };
        const loadUser = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok && active) {
                    const data = await res.json();
                    const currentUser = data.user || null;
                    setUser(currentUser);
                    if (currentUser?.email) {
                        const seenKey = `roster_guide_seen:${currentUser.email}`;
                        if (!localStorage.getItem(seenKey)) {
                            setGuideOpen(true);
                            localStorage.setItem(seenKey, '1');
                        }
                    }
                }
            }
            catch {
                // ignore
            }
        };
        checkHealth();
        loadUser();
        const timer = setInterval(checkHealth, 30000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [isAuthRoute]);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(clearToast, 5000);
        return () => clearTimeout(t);
    }, [toast, clearToast]);
    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        router.push('/login');
        router.refresh();
    };
    if (isAuthRoute) {
        return (<div className="min-h-screen flex flex-col bg-[#fafafa]">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>);
    }
    const handleMonthChange = (nextMonth) => {
        setMonthKey(nextMonth);
        fetchRosterData(nextMonth);
    };
    const handleExport = async (format) => {
        setExporting(true);
        try {
            const res = await fetch(`/api/roster/export?monthKey=${encodeURIComponent(monthKey)}&format=${format}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                showToast('error', err.error || `Generate a roster for ${monthKey} before exporting.`);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `roster-${monthKey}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast('success', `Downloaded roster-${monthKey}.${format}`);
        }
        catch {
            showToast('error', 'Failed to export roster file');
        }
        finally {
            setExporting(false);
        }
    };
    return (<div className="min-h-screen flex flex-col bg-[#fafafa] text-zinc-950">
      {/* Crisp Monochrome Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1640px] mx-auto px-3 sm:px-5 lg:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Wordmark + Navigation */}
          <div className="flex items-center gap-4 lg:gap-7 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold tracking-tighter">
                R/
              </div>
              <div className="leading-none">
                <span className="text-sm font-semibold tracking-tight text-zinc-950">
                  Roster
                </span>
                <span className="hidden xl:inline text-xs text-zinc-400 font-mono ml-2">
                  CP-SAT
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
            const isActive = item.match.includes(pathname);
            const Icon = item.icon;
            return (<Link key={item.href} href={item.href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${isActive
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'}`}>
                    <Icon className="w-3.5 h-3.5"/>
                    <span>{item.label}</span>
                  </Link>);
        })}
            </nav>
          </div>

          {/* Right: System Telemetry + Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Minimal Status Indicator */}
            <div className="hidden xl:flex items-center gap-3 px-2.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-[11px] font-mono text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${health?.services?.postgres?.healthy ? 'bg-emerald-600' : 'bg-red-600'}`}/>
                <span>DB</span>
              </span>
              <span className="text-zinc-300">/</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${health?.services?.solver?.healthy ? 'bg-emerald-600' : 'bg-amber-500'}`}/>
                <span>SOLVER</span>
              </span>
            </div>

            {/* Custom Month Picker */}
            <CustomMonthPicker value={monthKey} onChange={handleMonthChange}/>

            {/* Export (Desktop / Large Tablet) */}
            <button type="button" disabled={exporting} onClick={() => handleExport('xlsx')} className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 text-xs font-medium text-zinc-700 transition-colors cursor-pointer" title="Export Excel (.xlsx)">
              <Download className="w-3.5 h-3.5 text-zinc-500"/>
              <span className="hidden lg:inline">{exporting ? 'Exporting...' : 'Export'}</span>
            </button>

            {/* Platform Guide */}
            <button type="button" onClick={() => setGuideOpen(true)} className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition-colors cursor-pointer" title="Platform Guide" aria-label="Platform Guide">
              <BookOpen className="w-3.5 h-3.5 text-zinc-500"/>
              <span className="hidden md:inline">Guide</span>
            </button>

            {/* Diagnostics Brief */}
            <button onClick={() => openCopilot()} className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 transition-colors cursor-pointer" title="Conflict Brief" aria-label="Conflict Brief">
              <FileText className="w-3.5 h-3.5 text-zinc-500"/>
              <span className="hidden md:inline">Conflict Brief</span>
              {spofItems.length > 0 && (<span className="px-1.5 py-0.2 rounded bg-zinc-900 text-white font-mono text-[10px]">
                  {spofItems.length}
                </span>)}
            </button>

            {/* Primary Solve CTA */}
            <button onClick={() => generateRoster(monthKey)} disabled={generating} className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap">
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${generating ? 'animate-spin' : ''}`}/>
              <span className="sm:hidden">{generating ? '...' : 'Solve'}</span>
              <span className="hidden sm:inline">{generating ? 'Solving...' : 'Generate Roster'}</span>
            </button>

            {/* User & Logout */}
            <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-zinc-200">
              {user && (<span className="hidden xl:inline text-xs font-medium text-zinc-700 max-w-[120px] truncate" title={user.email}>
                  {user.name}
                </span>)}
              <button onClick={handleLogout} className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-medium text-zinc-700 transition-colors cursor-pointer" title="Sign out" aria-label="Sign out">
                <LogOut className="w-3.5 h-3.5 text-zinc-500"/>
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile & Tablet Nav + Quick Export */}
        <div className="flex lg:hidden items-center justify-between border-t border-zinc-200 px-3 sm:px-5 py-1.5 gap-2 bg-zinc-50">
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
            {NAV_ITEMS.map((item) => {
            const isActive = item.match.includes(pathname);
            const Icon = item.icon;
            return (<Link key={item.href} href={item.href} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap shrink-0 ${isActive
                    ? 'bg-zinc-950 text-white font-medium'
                    : 'text-zinc-600 bg-white border border-zinc-200'}`}>
                  <Icon className="w-3.5 h-3.5"/>
                  <span>{item.label}</span>
                </Link>);
        })}
          </div>
          <button type="button" disabled={exporting} onClick={() => handleExport('xlsx')} className="md:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-200 bg-white text-[11px] font-mono text-zinc-700 shrink-0 cursor-pointer disabled:opacity-50">
            <Download className="w-3 h-3 text-zinc-500"/>
            <span>{exporting ? '...' : '.xlsx'}</span>
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (<div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 sm:max-w-md">
          <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg text-xs ${toast.type === 'error'
                ? 'bg-white border-red-300 text-red-900'
                : 'bg-zinc-950 border-zinc-800 text-white'}`}>
            {toast.type === 'error' ? (<AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5"/>) : (<CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"/>)}
            <p className="leading-relaxed font-medium flex-1">{toast.message}</p>
            <button onClick={clearToast} className="opacity-60 hover:opacity-100 ml-2 shrink-0 cursor-pointer">
              <X className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>)}

      {/* Main Content */}
      <main className="flex-1 max-w-[1640px] w-full mx-auto px-3 sm:px-5 lg:px-8 py-4 sm:py-7">{children}</main>

      <Footer />

      {/* Diagnostic Brief Drawer */}
      <AICopilotPanel />

      {/* Global Quick-Create Modals */}
      <QuickCreateModals />

      {/* First-Login & Help Platform Guide */}
      <PlatformGuideModal open={guideOpen} onClose={() => setGuideOpen(false)}/>
    </div>);
}
