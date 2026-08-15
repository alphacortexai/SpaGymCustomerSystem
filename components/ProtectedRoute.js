'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut } from '@/lib/auth';
import LoadingState from './LoadingState';

const INACTIVE_STATUSES = new Set(['disabled', 'suspended', 'revoked']);

function AccessCard({ title, message, tone = 'slate', action }) {
  const toneStyles = {
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${toneStyles[tone] || toneStyles.slate}`}>
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mb-8 text-slate-500 dark:text-slate-400">{message}</p>
        {action}
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, profile, loading, authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/signin');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-2xl"><LoadingState title="Preparing your workspace..." description="Checking your secure session." /></div>
      </div>
    );
  }

  if (!user) return null;

  const logoutAction = (
    <button
      type="button"
      onClick={async () => { await signOut(); window.location.href = '/auth/signin'; }}
      className="w-full rounded-xl bg-slate-100 py-3 font-bold text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      Sign out
    </button>
  );

  if (authError) {
    return <AccessCard title="Session verification failed" message={authError} action={logoutAction} />;
  }

  if (!profile) {
    return <AccessCard title="Account unavailable" message="We could not load your account profile. Please sign out and try again." action={logoutAction} />;
  }

  if (INACTIVE_STATUSES.has(profile.status)) {
    return <AccessCard title="Account access paused" message="This account is not currently active. Contact an administrator if you believe this is a mistake." tone="rose" action={logoutAction} />;
  }

  if (profile.status === 'pending') {
    return (
      <AccessCard
        title="Approval pending"
        message="Your account was created successfully. An administrator must approve your access and assign a role before you can use the workspace."
        tone="amber"
        action={(
          <div className="space-y-3">
            <button type="button" onClick={() => window.location.reload()} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition-all hover:bg-blue-700">Check status</button>
            {logoutAction}
          </div>
        )}
      />
    );
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(profile.role) && profile.role !== 'Admin') {
    return (
      <AccessCard
        title="Access denied"
        message="Your account does not have the role required to view this page."
        action={<button type="button" onClick={() => router.replace('/')} className="font-semibold text-blue-600 hover:underline">Return home</button>}
      />
    );
  }

  return <>{children}</>;
}
