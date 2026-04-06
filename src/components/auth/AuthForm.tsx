'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      try {
        if (mode === 'login') {
          await login(email, password);
        } else {
          await register(email, password, displayName);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, displayName, login, register]
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,139,141,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(224,149,104,0.18),transparent_26%)]" />
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/60 bg-[rgba(255,252,247,0.62)] shadow-[0_30px_90px_rgba(19,34,56,0.18)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative hidden min-h-[620px] overflow-hidden bg-[#122033] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,220,198,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,191,122,0.2),transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-white/80">
              ChatBridge
            </div>
            <h1 className="mt-8 max-w-md text-5xl font-semibold leading-tight">
              A calmer workspace for AI-assisted learning.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[rgba(225,234,244,0.82)]">
              Ask questions, launch interactive apps, and keep each conversation organized in one polished study space.
            </p>
          </div>

          <div className="relative grid gap-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">What feels better</p>
              <p className="mt-3 text-lg text-white/90">Cleaner focus, clearer actions, and a friendlier first-run experience.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                <p className="text-sm font-medium">Guided chat</p>
                <p className="mt-1 text-sm text-white/65">Prompt starters and app-aware assistance.</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-black/10 p-4">
                <p className="text-sm font-medium">App handoff</p>
                <p className="mt-1 text-sm text-white/65">Move from answers into tools without context loss.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-[rgba(96,113,134,0.88)]">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#132238]">
                {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[rgba(96,113,134,0.96)]">
                {mode === 'login'
                  ? 'Jump into your conversations, apps, and saved context.'
                  : 'Set up your workspace and start exploring with ChatBridge.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  required
                  className="w-full rounded-2xl border border-[rgba(19,34,56,0.12)] bg-white/80 px-4 py-3 text-sm text-[#132238] outline-none transition duration-200 placeholder:text-[rgba(96,113,134,0.72)] focus:border-[rgba(15,139,141,0.45)] focus:bg-white focus:ring-4 focus:ring-[rgba(15,139,141,0.12)]"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-label="Email"
                placeholder="Email"
                data-testid="auth-email"
                required
                className="w-full rounded-2xl border border-[rgba(19,34,56,0.12)] bg-white/80 px-4 py-3 text-sm text-[#132238] outline-none transition duration-200 placeholder:text-[rgba(96,113,134,0.72)] focus:border-[rgba(15,139,141,0.45)] focus:bg-white focus:ring-4 focus:ring-[rgba(15,139,141,0.12)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-label="Password"
                placeholder="Password"
                data-testid="auth-password"
                required
                minLength={8}
                className="w-full rounded-2xl border border-[rgba(19,34,56,0.12)] bg-white/80 px-4 py-3 text-sm text-[#132238] outline-none transition duration-200 placeholder:text-[rgba(96,113,134,0.72)] focus:border-[rgba(15,139,141,0.45)] focus:bg-white focus:ring-4 focus:ring-[rgba(15,139,141,0.12)]"
              />

              {error && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-[#132238] py-3 text-sm font-medium text-white shadow-[0_14px_30px_rgba(19,34,56,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#0d1a2b] disabled:translate-y-0 disabled:opacity-50"
              >
                {loading ? 'Working...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[rgba(19,34,56,0.08)] bg-white/55 px-4 py-3 text-sm text-[rgba(96,113,134,0.96)]">
              <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="font-medium text-[#0f8b8d] transition hover:text-[#0c6b6c]"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
