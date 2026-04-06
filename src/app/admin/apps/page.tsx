'use client';

/**
 * Operator UI: list pending third-party apps and approve or reject (disable).
 * Teachers and admins only. Chess is seeded as pending for demos.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth-context';

type PendingApp = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iframeUrl: string;
  approvalStatus: string;
};

const OPERATOR_ROLES = new Set(['admin', 'teacher']);

export default function AdminAppsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [apps, setApps] = useState<PendingApp[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const loadPending = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/apps/pending', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        setLoadError('Session expired. Log in again.');
        return;
      }
      if (res.status === 403) {
        setLoadError('You need a teacher or admin account to review apps.');
        return;
      }
      if (!res.ok) {
        setLoadError('Could not load pending apps.');
        return;
      }
      const data = await res.json();
      setApps(data.apps ?? []);
    } catch {
      setLoadError('Could not load pending apps.');
    } finally {
      setListLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token && user && OPERATOR_ROLES.has(user.role)) {
      void loadPending();
    }
  }, [authLoading, token, user, loadPending]);

  const runAction = async (slug: string, approvalStatus: 'approved' | 'disabled') => {
    if (!token) return;
    setBusySlug(slug);
    setActionError(null);
    try {
      const res = await fetch(`/api/apps/${slug}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError((data.error as string) || 'Request failed');
        return;
      }
      await loadPending();
    } catch {
      setActionError('Request failed');
    } finally {
      setBusySlug(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f4f0]">
        <LoadingSpinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f4f0] px-6 text-center">
        <p className="text-sm text-[#5c6b7e]">Log in as a teacher or admin to review apps.</p>
        <Link href="/" className="text-sm font-medium text-[#0f8b8d] underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (!OPERATOR_ROLES.has(user.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f4f0] px-6 text-center">
        <p className="text-sm text-[#5c6b7e]">This page is only available to teachers and administrators.</p>
        <Link href="/" className="text-sm font-medium text-[#0f8b8d] underline">
          Back to chat
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#132238]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#5c6b7e]">Operator</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">App approvals</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#5c6b7e]">
              Approve an app to expose its tools in student chat. Reject sends it to disabled and hides it from
              learners.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#132238]/15 bg-white px-4 py-2 text-sm font-medium text-[#132238] shadow-sm transition hover:bg-[#132238]/5"
          >
            ← Back to chat
          </Link>
        </div>

        {loadError && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {loadError}
          </div>
        )}

        {actionError && (
          <div className="mb-6 rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm text-red-950">
            {actionError}
          </div>
        )}

        {listLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="md" label="Loading queue…" />
          </div>
        ) : apps.length === 0 ? (
          <div className="rounded-[1.75rem] border border-[#132238]/10 bg-white/90 p-10 text-center shadow-[0_20px_50px_rgba(19,34,56,0.08)]">
            <p className="text-sm font-medium text-[#132238]">No apps awaiting approval</p>
            <p className="mt-2 text-sm text-[#5c6b7e]">
              New registrations from{' '}
              <code className="rounded bg-[#132238]/5 px-1.5 py-0.5 text-xs">POST /api/apps/register</code> will appear
              here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {apps.map((app) => (
              <li
                key={app.id}
                className="rounded-[1.75rem] border border-[#132238]/10 bg-white/95 p-6 shadow-[0_16px_40px_rgba(19,34,56,0.06)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-[#132238]">{app.name}</h2>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                        Pending
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#5c6b7e]">{app.slug}</p>
                    <p className="mt-3 text-sm leading-6 text-[#3d4d5c]">{app.description}</p>
                    <p className="mt-2 truncate text-xs text-[#5c6b7e]">
                      iframe: <span className="font-mono">{app.iframeUrl}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:w-40">
                    <button
                      type="button"
                      disabled={busySlug !== null}
                      onClick={() => runAction(app.slug, 'approved')}
                      className="rounded-xl bg-[#0f8b8d] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#0c7375] disabled:opacity-50"
                    >
                      {busySlug === app.slug ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={busySlug !== null}
                      onClick={() => runAction(app.slug, 'disabled')}
                      className="rounded-xl border border-[#132238]/20 bg-white px-4 py-2.5 text-sm font-medium text-[#132238] transition hover:bg-[#132238]/5 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
