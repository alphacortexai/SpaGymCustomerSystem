'use client';

import { useMemo, useState } from 'react';

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: dateKey(start), end: dateKey(end) };
};

const formatDate = (value) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : 'Date not recorded';

const severityStyle = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200',
  attention: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
};

export default function FeedbackAttentionAdmin({ user, profile, onBack, onOpenSettings }) {
  const initialRange = useMemo(getInitialRange, []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reviewFeedback = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError('Choose a valid date range. The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/ai-feedback-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to review feedback. Please try again.');
      setResult(payload);
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to review feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'Admin') {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This page is available to administrators only.</div>;
  }

  const findings = result?.findings || [];
  const urgentCount = findings.filter((item) => item.severity === 'urgent').length;
  const attentionCount = findings.length - urgentCount;

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">Admin review</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Feedback attention</h2></div>
        </div>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Review saved caller feedback across a selected date range. AI flags entries that may need a follow-up; every flagged item retains its caller and client details.</p>
      </div>
      <button type="button" onClick={onOpenSettings} className="shrink-0 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50 dark:border-violet-900/50 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/30">AI key settings</button>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">From<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">To<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
        <button type="button" onClick={reviewFeedback} disabled={loading || !user} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60">{loading ? 'Reviewing feedback…' : 'Review with AI'}</button>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">The AI receives feedback text only. Caller names, client names, and phone numbers are attached to results on the server and shown here for follow-up.</p>
    </section>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}{/key|configured/i.test(error) && <button type="button" onClick={onOpenSettings} className="ml-2 underline underline-offset-2">Open AI key settings</button>}</div>}

    {result && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reports reviewed</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{result.reportCount}</p><p className="mt-1 text-xs font-semibold text-slate-500">{result.feedbackCount} feedback entries</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-300">Urgent</p><p className="mt-2 text-2xl font-black text-rose-800 dark:text-rose-200">{urgentCount}</p><p className="mt-1 text-xs font-semibold text-rose-700/80 dark:text-rose-200/70">Prioritize follow-up</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Needs attention</p><p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-200">{attentionCount}</p><p className="mt-1 text-xs font-semibold text-amber-800/80 dark:text-amber-200/70">Consider a follow-up</p></div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black text-slate-900 dark:text-white">AI summary</h3><p className="mt-1 text-xs font-medium text-slate-500">{formatDate(result.startDate)} – {formatDate(result.endDate)}</p></div><span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{findings.length} flagged</span></div>
        <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">{result.summary || 'No recurring concern themes were identified.'}</p>
      </section>

      <section className="space-y-3">
        <div><h3 className="text-lg font-black text-slate-900 dark:text-white">Feedback requiring attention</h3><p className="mt-1 text-xs font-medium text-slate-500">Sorted urgent first, then items that may benefit from follow-up.</p></div>
        {findings.length ? findings.map((item, index) => <article key={`${item.sourceId || index}-${index}`} className={`rounded-2xl border p-5 shadow-sm ${severityStyle[item.severity] || severityStyle.attention}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-current/20 bg-white/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] dark:bg-slate-950/30">{item.severity === 'urgent' ? 'Urgent concern' : 'Needs attention'}</span><span className="text-xs font-semibold opacity-75">{formatDate(item.reportDate)} · {item.branch || 'Branch not recorded'}{item.section ? ` · ${item.section}` : ''}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Caller</p><p className="mt-1 text-sm font-bold">{item.callerName || 'Caller not recorded'}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Client</p><p className="mt-1 text-sm font-bold">{item.clientName || 'Client name not recorded'}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Phone</p><p className="mt-1 text-sm font-bold">{item.phoneNumber || 'Phone not recorded'}</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-current/10 bg-white/70 p-4 dark:bg-slate-950/25"><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Original feedback</p><p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6">{item.feedback}</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Why it was flagged</p><p className="mt-1 text-sm font-medium leading-5">{item.reason}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Suggested next step</p><p className="mt-1 text-sm font-medium leading-5">{item.suggestedAction}</p></div></div>
        </article>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">No feedback requiring attention was identified in this range. This is an AI-assisted review, not a guarantee that every issue was detected.</div>}
      </section>
    </>}
  </div>;
}
