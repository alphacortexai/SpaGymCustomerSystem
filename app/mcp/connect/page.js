'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';

function allowedReturn(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:' && (/(^|\.)grok\.com$/i.test(url.hostname) || /(^|\.)x\.ai$/i.test(url.hostname))) return true;
    const localPage = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return localPage && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function ConnectForm() {
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useMemo(() => ({
    clientId: params.get('clientId') || params.get('client_id') || '',
    redirectUri: params.get('redirectUri') || params.get('redirect_uri') || '',
    codeChallenge: params.get('codeChallenge') || params.get('code_challenge') || '',
    codeChallengeMethod: params.get('codeChallengeMethod') || params.get('code_challenge_method') || '',
    scope: params.get('scope') || '',
    state: params.get('state') || '',
    resource: params.get('resource') || '',
  }), [params]);
  const ready = Boolean(request.clientId && request.redirectUri && request.codeChallenge);
  const isTopAdmin = user?.email?.toLowerCase() === TOP_ADMIN_EMAIL;

  const signIn = async () => {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle();
    if (!result.success && result.error) setError(result.error);
    setBusy(false);
  };

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/mcp/oauth/approve', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error_description || payload.error || 'The connection was not approved.');
      if (!allowedReturn(payload.redirectTo)) throw new Error('Grok did not provide a recognised return address.');
      window.location.assign(payload.redirectTo);
    } catch (approveError) {
      setError(approveError.message || 'The connection was not approved.');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">SpaGym · top administrator</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Connect Grok</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Grok will be able to read branches, concerning feedback, birthdays, client details, check-ins, caller reports, and the number of clients. It cannot change any records.</p>
      {!ready && <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Open this page from Grok’s connector sign-in. A direct visit does not have a connection request to approve.</p>}
      {error && <p role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-slate-500">Checking the signed-in account…</p> : null}
      {!loading && ready && !user && (
        <button type="button" onClick={signIn} disabled={busy} className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60">Sign in with Google</button>
      )}
      {!loading && ready && user && !isTopAdmin && (
        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">This connector is limited to the top administrator. {user.email} cannot approve it.</p>
      )}
      {!loading && ready && isTopAdmin && (
        <button type="button" onClick={approve} disabled={busy} className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? 'Returning to Grok…' : 'Allow Grok to read SpaGym'}</button>
      )}
    </main>
  );
}

export default function ConnectGrokPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-lg items-center px-6 text-sm text-slate-500">Preparing the Grok connection…</main>}>
      <ConnectForm />
    </Suspense>
  );
}
