'use client';
import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = searchParams.get('next') || '/dashboard';
    const [email, setEmail] = useState('admin@roaster.io');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Sign in failed');
                setSubmitting(false);
                return;
            }
            router.push(nextPath);
            router.refresh();
        }
        catch {
            setError('Network error while signing in');
            setSubmitting(false);
        }
    };
    return (<div className="min-h-screen bg-[#fafafa] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-zinc-950 text-white flex items-center justify-center font-mono text-xs font-bold">
            R/
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-950 tracking-tight">Roster</div>
            <div className="text-[11px] font-mono text-zinc-500">Workforce Operations</div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-950">Sign in</h1>
            <p className="text-xs text-zinc-500">
              Enter your credentials to access the scheduling matrix.
            </p>
          </div>

          {error && (<div className="px-3 py-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>)}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-zinc-700">
                Email
              </label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="w-full px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"/>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-zinc-600 hover:text-zinc-950 underline underline-offset-4">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input id="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full pl-3 pr-9 py-2 rounded-md border border-zinc-300 bg-white text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"/>
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-800 cursor-pointer" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-2.5 px-4 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Lock className="w-3.5 h-3.5"/>
              <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="w-3.5 h-3.5"/>
            </button>
          </form>
        </div>

        {/* Seeded Demo Accounts Helper */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2 text-xs">
          <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            Seeded Accounts (Click to Autofill)
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <button type="button" onClick={() => {
            setEmail('admin@roaster.io');
            setPassword('Admin@123');
        }} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-left cursor-pointer">
              <span className="font-medium text-zinc-900">admin@roaster.io</span>
              <span className="font-mono text-[11px] text-zinc-500">Admin@123</span>
            </button>
            <button type="button" onClick={() => {
            setEmail('alice.kumar@company.com');
            setPassword('PodLead@123');
        }} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-left cursor-pointer">
              <span className="font-medium text-zinc-900">alice.kumar@company.com</span>
              <span className="font-mono text-[11px] text-zinc-500">PodLead@123</span>
            </button>
          </div>
        </div>
      </div>
    </div>);
}
export default function LoginPage() {
    return (<Suspense fallback={<div className="min-h-screen bg-[#fafafa]"/>}>
      <LoginForm />
    </Suspense>);
}
