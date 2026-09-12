'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllReports } from '@/lib/reports';

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startDateForDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return toDateKey(date);
};

const rowHasContent = (row = {}) => Boolean(
  row.clientId || row.clientName || row.phoneNumber || row.contactMethod || row.comment
  || Object.values(row.customFields || {}).some((value) => String(value || '').trim()),
);

const rowHasFeedback = (row = {}) => Boolean(
  rowHasContent(row) && String(row.comment || '').trim(),
);

const rowHasWhatsapp = (row = {}) => Boolean(
  rowHasContent(row) && /whatsapp|message|messaged|msg/i.test(String(row.contactMethod || '')),
);

const normalizeReportRows = (report) => ({
  birthday: (report.birthdayClients || []).filter(rowHasContent),
  feedback: (report.previousDayVisits || []).filter(rowHasContent),
  whatsapp: (report.whatsappMessages || []).filter(rowHasContent),
});

function MetricCard({ label, value, detail, accent }) {
  return <div className={`rounded-2xl border p-5 ${accent}`}><p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p><p className="mt-3 text-3xl font-black tracking-tight">{value.toLocaleString()}</p><p className="mt-1 text-xs font-semibold opacity-70">{detail}</p></div>;
}

function formatDateRange(start, end) {
  if (!start || !end) return 'Select a date range';
  return `${new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${end}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function CallerAnalyticsAdmin({ profile, onBack }) {
  const today = toDateKey(new Date());
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState(startDateForDays(7));
  const [customEnd, setCustomEnd] = useState(today);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (profile?.role !== 'Admin') {
      return undefined;
    }
    getAllReports().then((items) => {
      if (active) setReports(items);
    }).catch((loadError) => {
      console.error('Caller analytics load error:', loadError);
      if (active) setError('Unable to load report data. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [profile?.role]);

  const bounds = useMemo(() => {
    if (period === '14d') return { start: startDateForDays(14), end: today };
    if (period === '30d') return { start: startDateForDays(30), end: today };
    if (period === 'custom') return customStart <= customEnd ? { start: customStart, end: customEnd } : { start: customEnd, end: customStart };
    return { start: startDateForDays(7), end: today };
  }, [customEnd, customStart, period, today]);

  const analytics = useMemo(() => {
    const selectedReports = reports.filter((report) => report.reportDateKey >= bounds.start && report.reportDateKey <= bounds.end);
    const callerMap = new Map();
    selectedReports.forEach((report) => {
      const callerId = report.callerId || report.ownerId || report.callerName || report.ownerName || 'unassigned';
      const callerName = report.callerName || report.ownerName || 'Unassigned caller';
      const existing = callerMap.get(callerId) || { id: callerId, name: callerName, reports: 0, birthday: 0, feedback: 0, whatsapp: 0, contacted: 0, dates: new Set() };
      const rows = normalizeReportRows(report);
      existing.reports += 1;
      existing.birthday += rows.birthday.length;
      existing.feedback += rows.feedback.filter(rowHasFeedback).length || rows.feedback.length;
      existing.whatsapp += rows.whatsapp.length || rows.feedback.filter(rowHasWhatsapp).length;
      existing.contacted += rows.birthday.length + rows.feedback.length + rows.whatsapp.length;
      existing.dates.add(report.reportDateKey);
      callerMap.set(callerId, existing);
    });
    const callers = [...callerMap.values()].map((caller) => ({ ...caller, dates: caller.dates.size })).sort((a, b) => b.contacted - a.contacted || a.name.localeCompare(b.name));
    return {
      selectedReports,
      callers,
      birthday: callers.reduce((total, caller) => total + caller.birthday, 0),
      feedback: callers.reduce((total, caller) => total + caller.feedback, 0),
      whatsapp: callers.reduce((total, caller) => total + caller.whatsapp, 0),
    };
  }, [bounds.end, bounds.start, reports]);

  if (profile?.role !== 'Admin') return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This page is available to administrators only.</div>;

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Admin reporting</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Caller analytics</h2></div></div><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Review birthday outreach, feedback contacts, and WhatsApp activity by caller for the selected reporting period.</p></div>
      <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Caller analytics period" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="7d">Last 7 days</option><option value="14d">Last 14 days</option><option value="30d">Last 30 days</option><option value="custom">Custom period</option></select>
    </div>
    {period === 'custom' && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900"><label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label><label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">To<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label></div>}
    <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDateRange(bounds.start, bounds.end)}</span><span className="text-xs font-semibold text-slate-500">{analytics.selectedReports.length} report{analytics.selectedReports.length === 1 ? '' : 's'} included</span></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading caller report data...</div> : <>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Birthday clients contacted" value={analytics.birthday} detail="Across all callers" accent="border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200" /><MetricCard label="Feedback contacts" value={analytics.feedback} detail="Report feedback entries" accent="border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200" /><MetricCard label="WhatsApp contacts" value={analytics.whatsapp} detail="WhatsApp report entries" accent="border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200" /></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Performance by caller</h3><p className="mt-1 text-xs font-medium text-slate-500">Each row is aggregated from the saved daily reports in the selected period.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">{['Caller', 'Reports / days', 'Birthday clients', 'Feedback', 'WhatsApp', 'Total contacts'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{heading}</th>)}</tr></thead><tbody>{analytics.callers.length ? analytics.callers.map((caller) => <tr key={caller.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-5 py-4 text-sm font-black text-slate-800 dark:text-slate-100">{caller.name}</td><td className="px-5 py-4 text-sm font-semibold text-slate-500">{caller.reports} / {caller.dates}</td><td className="px-5 py-4 text-sm font-bold text-blue-700 dark:text-blue-300">{caller.birthday}</td><td className="px-5 py-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">{caller.feedback}</td><td className="px-5 py-4 text-sm font-bold text-violet-700 dark:text-violet-300">{caller.whatsapp}</td><td className="px-5 py-4 text-sm font-black text-slate-800 dark:text-slate-100">{caller.contacted}</td></tr>) : <tr><td colSpan="6" className="px-5 py-12 text-center text-sm font-semibold text-slate-500">No report activity found for this period.</td></tr>}</tbody></table></div></section>
    </>}
  </div>;
}
