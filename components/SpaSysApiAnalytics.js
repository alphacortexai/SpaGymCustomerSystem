'use client';

import { useCallback, useEffect, useState } from 'react';

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';

function formatDay(day) {
  const [year, month, date] = String(day || '').split('-').map(Number);
  if (!year || !month || !date) return day || '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
}

function formatWhen(value) {
  if (!value) return 'No activity';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))} EAT`;
}

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{Number(value || 0).toLocaleString('en-GB')}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

export default function SpaSysApiAnalytics({ user, profile, onBack }) {
  const isTopAdmin = user?.email?.toLowerCase() === TOP_ADMIN_EMAIL && profile?.email?.toLowerCase() === TOP_ADMIN_EMAIL;
  const [days, setDays] = useState(7);
  const [logFilter, setLogFilter] = useState('all');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/spa-sys/analytics?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load API analytics.');
      setReport(payload);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load API analytics.');
    } finally {
      setLoading(false);
    }
  }, [days, user]);

  useEffect(() => {
    if (isTopAdmin && user) loadReport();
  }, [isTopAdmin, loadReport, user]);

  if (!isTopAdmin) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">API analytics is available to the top administrator only.</div>;
  }

  const maxDay = Math.max(1, ...(report?.api?.days || []).map((item) => item.requests));

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Top admin · SPA_SYS_API_V1</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">API analytics</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Each API key has a total, and the log below shows the individual request, which key made it, and whether it succeeded. A failure includes the error. Dates use the Africa/Kampala day. Phone numbers and secrets are not stored.</p>
          </div>
        </div>
        <div className="flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {[7, 30].map((option) => (
            <button key={option} type="button" onClick={() => setDays(option)} className={`rounded-xl px-4 py-2 text-sm font-black ${days === option ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{option} days</button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {report?.alerts?.rejectedBurst && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">Rejected calls are high for this period. Review the request log for keys that failed.</p>}
      {loading && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading API activity…</p>}

      {report && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="API calls" value={report.api.requests} detail={`${formatDay(report.from)} – ${formatDay(report.to)}`} />
            <Metric label="Rejected calls" value={report.rejected} detail="Wrong or missing keys" />
            <Metric label="Alerts delivered" value={report.webhooks.delivered} detail="Check-in webhooks accepted" />
            <Metric label="Alerts failed" value={report.webhooks.failed} detail="Not accepted by the other system" />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-black text-slate-900 dark:text-white">Calls by day</h3>
            <div className="mt-4 space-y-2">
              {report.api.days.map((item) => (
                <div key={item.day} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-xs font-semibold text-slate-500">
                  <span>{formatDay(item.day)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.max(item.requests ? 4 : 0, Math.round((item.requests / maxDay) * 100))}%` }} /></span>
                  <span className="text-right text-slate-800 dark:text-slate-100">{item.requests}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white">Every API key</h3>
              <p className="mt-1 text-sm text-slate-500">A registered system stays in this list even when it made no calls. An environment key appears after its first call. A badge marks many different client lookups, or many updates.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
                  <tr>
                    {['System', 'Key', 'Calls', 'Reads', 'Lookups', 'Updates', 'Check-outs', 'Errors', 'Last call'].map((column) => <th key={column} className="px-3 py-2 font-black">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.api.keys.map((item) => (
                    <tr key={item.subjectId} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        {item.name}{item.status === 'revoked' ? ' · revoked' : ''}
                        {item.manyLookups && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Many lookups</span>}
                        {item.manyUpdates && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Many updates</span>}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{item.keyPreview || '—'}</td>
                      <td className="px-3 py-3">{item.requests}</td>
                      <td className="px-3 py-3">{item.reads}</td>
                      <td className="px-3 py-3">{item.distinctLookups || 0}</td>
                      <td className="px-3 py-3">{item.updates}</td>
                      <td className="px-3 py-3">{item.checkouts}</td>
                      <td className="px-3 py-3">{item.clientError + item.serverError}</td>
                      <td className="px-3 py-3 text-slate-500">{formatWhen(item.lastAt)}</td>
                    </tr>
                  ))}
                  {report.api.keys.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-slate-500">No API keys have been registered, and no environment key has called in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white">Webhook activity</h3>
              <p className="mt-1 text-sm text-slate-500">One row for each system that should receive a check-in alert.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
                  <tr>
                    {['System', 'Host', 'Delivered', 'Failed', 'Last result', 'Last attempt'].map((column) => <th key={column} className="px-3 py-2 font-black">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.webhooks.targets.map((item) => (
                    <tr key={item.subjectId} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">{item.name}</td>
                      <td className="px-3 py-3 text-slate-500">{item.host || 'No webhook'}</td>
                      <td className="px-3 py-3">{item.delivered}</td>
                      <td className="px-3 py-3">{item.failed}</td>
                      <td className="px-3 py-3">{item.lastReason || '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{formatWhen(item.lastAt)}</td>
                    </tr>
                  ))}
                  {report.webhooks.targets.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-slate-500">No webhook is configured.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">Request log</h3>
                <p className="mt-1 text-sm text-slate-500">Newest 200 calls in this period. The path is the endpoint, not the phone number. A client id is kept only for an update or a check-out.</p>
              </div>
              <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
                {[['all', 'All'], ['api', 'API'], ['webhook', 'Webhooks']].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setLogFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${logFilter === value ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
                  <tr>
                    {['Time', 'Key', 'Request', 'Result'].map((column) => <th key={column} className="px-3 py-2 font-black">{column}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(report.entries || []).filter((item) => logFilter === 'all' || item.channel === logFilter).map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-500">{formatWhen(item.at)}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="font-mono text-xs text-slate-500">{item.keyPreview || 'No key'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{item.request}</div>
                        <div className="text-xs text-slate-500">{item.path}</div>
                        {item.requestId && <div className="font-mono text-[11px] text-slate-400">Request {item.requestId}</div>}
                        {item.clientId && <div className="font-mono text-[11px] text-slate-400">Client {item.clientId}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {item.success
                          ? <span className="font-bold text-emerald-700 dark:text-emerald-300">Success · {item.status}</span>
                          : <span className="font-bold text-rose-700 dark:text-rose-300">{item.status || 'Failed'}{item.errorCode ? ` · ${item.errorCode}` : ''}</span>}
                        {!item.success && item.errorMessage && <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{item.errorMessage}</p>}
                      </td>
                    </tr>
                  ))}
                  {(report.entries || []).filter((item) => logFilter === 'all' || item.channel === logFilter).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-slate-500">No requests have been logged in this period yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {report.truncated && <p className="text-sm font-semibold text-amber-700">The daily totals for this period are too large to load in full. Use 7 days for a complete count.</p>}
          {report.logsTruncated && <p className="text-sm font-semibold text-amber-700">More than 200 requests were logged in this period. The table shows the newest 200.</p>}
        </>
      )}
    </div>
  );
}
