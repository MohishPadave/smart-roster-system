'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
export default function ForgotPasswordPage() {
    const [step, setStep] = useState('REQUEST');
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [devResetCode, setDevResetCode] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const handleRequestCode = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Could not initiate password reset');
                setSubmitting(false);
                return;
            }
            if (data.resetCode) {
                setDevResetCode(data.resetCode);
                setToken(data.resetCode);
            }
            setStep('RESET');
            setSubmitting(false);
        }
        catch {
            setError('Network error while requesting reset code');
            setSubmitting(false);
        }
    };
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError(null);
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to reset password');
                setSubmitting(false);
                return;
            }
            setStep('DONE');
            setSubmitting(false);
        }
        catch {
            setError('Network error while resetting password');
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
            <div className="text-[11px] font-mono text-zinc-500">Account Recovery</div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-5">
          {step === 'REQUEST' && (<>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
                  Forgot password
                </h1>
                <p className="text-xs text-zinc-500">
                  Enter your account email to generate a 6-digit recovery code.
                </p>
              </div>

              {error && (<div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {error}
                </div>)}

              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reset-email" className="block text-xs font-medium text-zinc-700">
                    Email
                  </label>
                  <input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@roaster.io" className="w-full px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"/>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-2.5 px-4 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer">
                  <KeyRound className="w-3.5 h-3.5"/>
                  <span>{submitting ? 'Generating Code...' : 'Send Reset Code'}</span>
                </button>
              </form>
            </>)}

          {step === 'RESET' && (<>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
                  Set new password
                </h1>
                <p className="text-xs text-zinc-500">
                  Enter the 6-digit reset code for <span className="font-medium text-zinc-900">{email}</span>.
                </p>
              </div>

              {devResetCode && (<div className="p-3 rounded-md bg-zinc-50 border border-zinc-300 text-xs space-y-1">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Generated Reset Code (Local Mode)
                  </div>
                  <div className="font-mono text-base font-bold text-zinc-950 tracking-widest">
                    {devResetCode}
                  </div>
                </div>)}

              {error && (<div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {error}
                </div>)}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">Reset Code</label>
                  <input type="text" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" className="w-full px-3 py-2 rounded-md border border-zinc-300 bg-white font-mono text-sm text-zinc-950 focus:outline-none focus:border-zinc-950"/>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">New Password</label>
                  <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" className="w-full px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm text-zinc-950 focus:outline-none focus:border-zinc-950"/>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-700">Confirm Password</label>
                  <input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm text-zinc-950 focus:outline-none focus:border-zinc-950"/>
                </div>
                <button type="submit" disabled={submitting} className="w-full py-2.5 px-4 rounded-md bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer">
                  {submitting ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </>)}

          {step === 'DONE' && (<div className="py-4 text-center space-y-4">
              <CheckCircle2 className="w-8 h-8 text-zinc-950 mx-auto"/>
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-zinc-950">Password updated</h1>
                <p className="text-xs text-zinc-500">
                  Your password has been reset. You can now sign in with your new password.
                </p>
              </div>
              <Link href="/login" className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-medium">
                Return to Sign in
              </Link>
            </div>)}

          <div className="pt-2 border-t border-zinc-100">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-950">
              <ArrowLeft className="w-3.5 h-3.5"/>
              <span>Back to sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </div>);
}
