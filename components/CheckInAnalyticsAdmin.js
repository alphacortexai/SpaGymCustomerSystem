'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { getKampalaDateKey, getGuestFlowCheckInAnalytics } from '@/lib/guestflowVisits';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';
const BRANCH_COLORS = ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : getKampalaDateKey(date);
}

function shiftDate(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function startDateForDays(days) {
  return shiftDate(getKampalaDateKey(), -(days - 1));
}

function makeDateRange(start, end) {
  const dates = [];
  let cursor = start;
  while (cursor && cursor <= end && dates.length <= 366) {
    dates.push(cursor);
    cursor = shiftDate(cursor, 1);
  }
  return dates;
}

function formatDate(dateKey, options = { month: 'short', day: 'numeric' }) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, options);
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-semibold opacity-70">{detail}</p>
    </div>
  );
}

export default function CheckInAnalyticsAdmin({ user, profile, onBack }) {
  const isTopAdmin = user?.email?.toLowerCase() === TOP_ADMIN_EMAIL && profile?.email?.toLowerCase() === TOP_ADMIN_EMAIL;
  const today = getKampalaDateKey();
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState(startDateForDays(7));
  const [customEnd, setCustomEnd] = useState(today);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bounds = useMemo(() => {
    if (period === '14d') return { start: startDateForDays(14), end: today };
    if (period === '30d') return { start: startDateForDays(30), end: today };
    if (period === 'custom') {
      return customStart <= customEnd
        ? { start: customStart, end: customEnd }
        : { start: customEnd, end: customStart };
    }
    return { start: startDateForDays(7), end: today };
  }, [customEnd, customStart, period, today]);

  useEffect(() => {
    let active = true;
    if (!isTopAdmin) return undefined;
    Promise.resolve().then(() => {
      if (!active) return null;
      setLoading(true);
      setError('');
      return getGuestFlowCheckInAnalytics(bounds.start, bounds.end)
        .then((items) => { if (active) setVisits(items); })
        .catch((loadError) => {
          console.error('Check-in analytics load error:', loadError);
          if (active) {
            setVisits([]);
            setError(loadError.message || 'Unable to load check-in analytics. Please try again.');
          }
        })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [bounds.end, bounds.start, isTopAdmin]);

  const analytics = useMemo(() => {
    const dates = makeDateRange(bounds.start, bounds.end);
    const branchSet = new Set();
    const counts = new Map(dates.map((date) => [date, {}]));
    visits.forEach((visit) => {
      const date = String(visit.visitDate || '').slice(0, 10);
      const branch = String(visit.checkedInBranch || visit.branch || 'Unassigned').trim() || 'Unassigned';
      if (!counts.has(date)) return;
      branchSet.add(branch);
      const day = counts.get(date);
      day[branch] = (day[branch] || 0) + 1;
    });
    const branches = [...branchSet].sort((a, b) => a.localeCompare(b));
    const totals = dates.map((date) => branches.reduce((sum, branch) => sum + (counts.get(date)?.[branch] || 0), 0));
    return { dates, branches, counts, totals, total: totals.reduce((sum, value) => sum + value, 0) };
  }, [bounds.end, bounds.start, visits]);

  const chart = useMemo(() => ({
    options: {
      chart: { type: 'line', stacked: false, toolbar: { show: false }, fontFamily: 'inherit', foreColor: '#64748b' },
      colors: [...analytics.branches.map((_, index) => BRANCH_COLORS[index % BRANCH_COLORS.length]), '#0f172a'],
      stroke: { width: [...analytics.branches.map(() => 0), 3], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: analytics.dates.length > 30 ? '70%' : '52%', borderRadius: 4 } },
      fill: { opacity: [...analytics.branches.map(() => 0.88), 1] },
      dataLabels: { enabled: false },
      grid: { borderColor: '#e8edf3', strokeDashArray: 4, padding: { left: 8, right: 8 } },
      xaxis: { categories: analytics.dates.map((date) => formatDate(date)), labels: { rotate: analytics.dates.length > 14 ? -45 : 0, hideOverlappingLabels: true } },
      yaxis: { min: 0, forceNiceScale: true, title: { text: 'Clients checked in' }, labels: { formatter: (value) => Math.round(value) } },
      legend: { position: 'top', horizontalAlign: 'left', fontWeight: 700, markers: { radius: 10 } },
      tooltip: { shared: true, intersect: false, y: { formatter: (value) => `${value} client${value === 1 ? '' : 's'}` } },
      noData: { text: 'No check-ins in this period' },
    },
    series: [
      ...analytics.branches.map((branch) => ({ name: branch, type: 'column', data: analytics.dates.map((date) => analytics.counts.get(date)?.[branch] || 0) })),
      { name: 'Total clients', type: 'line', data: analytics.totals },
    ],
  }), [analytics]);

  if (!isTopAdmin) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This analytics page is available to the top administrator only.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
            <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Top admin reporting</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Client check-in analytics</h2></div>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Compare daily client arrivals by branch. Bars show each branch and the dark line shows the combined daily total.</p>
        </div>
        <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Check-in analytics period" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><option value="7d">Last 7 days</option><option value="14d">Last 14 days</option><option value="30d">Last 30 days</option><option value="custom">Custom period</option></select>
      </div>
      {period === 'custom' && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row dark:border-slate-800 dark:bg-slate-900"><label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">From<input type="date" max={today} value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label><label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">To<input type="date" max={today} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(bounds.start, { month: 'short', day: 'numeric', year: 'numeric' })} – {formatDate(bounds.end, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span className="text-xs font-semibold text-slate-500">{analytics.dates.length} days · {visits.length} check-in{visits.length === 1 ? '' : 's'}</span></div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Total check-ins" value={analytics.total} detail="Clients who arrived" tone="border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200" /><MetricCard label="Average per day" value={analytics.dates.length ? Math.round((analytics.total / analytics.dates.length) * 10) / 10 : 0} detail="Across the selected period" tone="border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200" /><MetricCard label="Branches active" value={analytics.branches.length} detail="With at least one arrival" tone="border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200" /></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Clients per day by branch</h3><p className="mt-1 text-xs font-medium text-slate-500">Hover over a day to see the branch breakdown and total arrivals.</p></div><div className="min-h-[380px] p-3 sm:p-5">{loading ? <div className="flex min-h-[340px] items-center justify-center text-sm font-semibold text-slate-500">Loading check-in data…</div> : <Chart options={chart.options} series={chart.series} type="line" height={350} />}</div></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Branch totals</h3><p className="mt-1 text-xs font-medium text-slate-500">Total arrivals by branch for the selected dates.</p></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{analytics.branches.length ? analytics.branches.map((branch, index) => <div key={branch} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"><span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BRANCH_COLORS[index % BRANCH_COLORS.length] }} /> <span className="truncate">{branch}</span></span><span className="text-lg font-black text-slate-900 dark:text-white">{analytics.dates.reduce((sum, date) => sum + (analytics.counts.get(date)?.[branch] || 0), 0)}</span></div>) : <p className="text-sm font-semibold text-slate-500">No branch arrivals found for this period.</p>}</div></section>
    </div>
  );
}
