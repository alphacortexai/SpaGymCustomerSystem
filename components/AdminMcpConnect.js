'use client';

import { useCallback, useEffect, useState } from 'react';

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';

const TOOLS = [
  ['Wrong feedback', 'Complaints and other follow-up comments for a day or a range, by branch.'],
  ['Birthdays', 'Birthday babies today, or birthdays across any period.'],
  ['Client lookup', 'Find a client by phone number or name.'],
  ['Check-ins', 'Who checked in, when, and who is still checked in, for any period up to 92 days.'],
  ['Caller reports', 'Which callers filed a report, the details they recorded, and the feedback in it.'],
  ['Client count', 'How many clients are stored, in total and by branch.'],
];

function formatWhen(value) {
  if (!value) return 'Not yet';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))} EAT`;
}

export default function AdminMcpConnect({ user, onBack }) {
  const isTopAdmin = user?.email?.toLowerCase() === TOP_ADMIN_EMAIL;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [freshKey, setFreshKey] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mcp', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load the Grok connection.');
      setStatus(payload);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the Grok connection.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isTopAdmin && user) load();
  }, [isTopAdmin, load, user]);

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError('The value could not be copied. Select it and copy it manually.');
    }
  };

  const createKey = async () => {
    if (status?.configured && !window.confirm('Replace the current connection key? Grok sessions using the old key will stop working. A Grok sign-in connection keeps working.')) return;
    setBusy(true);
    setError('');
    setFreshKey('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/mcp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to create a connection key.');
      setFreshKey(payload.token);
      setStatus((current) => ({
        ...(current || {}),
        configured: true,
        keyPrefix: payload.keyPrefix,
        createdAt: payload.createdAt,
        endpoint: payload.endpoint || current?.endpoint,
      }));
    } catch (createError) {
      setError(createError.message || 'Unable to create a connection key.');
    } finally {
      setBusy(false);
    }
  };

  if (!isTopAdmin) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">The Grok connection is available to the top administrator only.</div>;
  }

  const endpoint = status?.endpoint || '';

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Top admin only</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Grok MCP</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Connect Grok to read SpaGym. The connector can pull concerning feedback, birthdays, clients, check-ins, and caller reports. It cannot add, edit, or delete anything.</p>
          </div>
        </div>
        <button type="button" onClick={createKey} disabled={loading || busy} className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy ? 'Creating key…' : status?.configured ? 'Replace connection key' : 'Create connection key'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {loading && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading the Grok connection…</p>}

      {freshKey && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-black text-amber-950 dark:text-amber-100">Copy this key now. SpaGym will not show it again.</p>
          <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950 px-3 py-2.5 text-xs text-slate-100">{freshKey}</code>
          <button type="button" onClick={() => copy('key', freshKey)} className="mt-3 rounded-xl border border-amber-300 px-3 py-2 text-xs font-black text-amber-950 dark:text-amber-100">{copied === 'key' ? 'Copied' : 'Copy key'}</button>
        </div>
      )}

      {status && !loading && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Server URL</p>
            <p className="mt-2 break-all text-sm font-bold text-slate-900 dark:text-white">{endpoint}</p>
            <button type="button" onClick={() => copy('url', endpoint)} className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">{copied === 'url' ? 'Copied' : 'Copy URL'}</button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Connection key</p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{status.configured ? `${status.keyPrefix}…` : 'Not created'}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Created {formatWhen(status.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Last key use</p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatWhen(status.lastUsedAt)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Sign-in connections are counted separately.</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Connect on grok.com</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <li>Use the public HTTPS address of this SpaGym site. Grok cannot reach a localhost address.</li>
          <li>Open grok.com/connectors, choose New Connector, then Custom, and paste the server URL above.</li>
          <li>When Grok asks you to sign in, use the top administrator Google account. Any other account is refused.</li>
          <li>Ask Grok, for example, who has a birthday today, who checked in at a branch, or which feedback from yesterday needs attention.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Connect with a key</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use the connection key when an xAI API request or the Grok command line needs a bearer token. Put the key in the Authorization header. Do not put it in the chat.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-100"><code>{`grok mcp add --transport http spagym ${endpoint || 'https://your-spa-domain/api/mcp'} --header "Authorization: Bearer <connection key>"`}</code></pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">What Grok can read</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TOOLS.map(([title, detail]) => (
            <div key={title} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-black text-slate-900 dark:text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
