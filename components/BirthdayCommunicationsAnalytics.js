'use client';

import { useMemo, useState } from 'react';
import {
  endOfDay,
  endOfMonth,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';

const METHOD_LABELS = {
  called: 'Called',
  messaged: 'Message sent',
  both: 'Called + message sent',
  unavailable: 'Unavailable / Not on WhatsApp',
  not_contacted: 'Not contacted',
};

const METHOD_STYLES = {
  called: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200',
  messaged: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200',
  both: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-200',
  unavailable: 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200',
  not_contacted: 'bg-lime-50 text-lime-800 dark:bg-lime-950/20 dark:text-lime-200',
};

function asDate(value) {
  if (!value) return null;
  const date = value.toDate?.() || (value instanceof Date ? value : new Date(value));
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function getMethod(client) {
  return client.birthdayContactMethod || (
    client.birthdayCallStatus === 'called' || client.birthdayCalledById ? 'called' : 'not_contacted'
  );
}

function isOfferRedeemed(client, year) {
  if (client?.birthdayOfferRedeemed === true || client?.birthdayOfferRedeemed === 'true') return true;
  const redeemedAt = asDate(client?.birthdayOfferRedeemedAt);
  if (redeemedAt) return redeemedAt.getFullYear() === year;
  return Number(client?.birthdayOfferRedeemedYear) === year;
}

function birthdayInYear(client, year) {
  const month = Number(client.birthMonth);
  const day = Number(client.birthDay);
  if (!month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPeriod(start, end) {
  if (format(start, 'yyyy') === format(end, 'yyyy')) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}

function MetricCard({ label, value, detail, accent = 'blue' }) {
  const accents = {
    blue: 'border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200',
    pink: 'border-pink-100 bg-pink-50/70 text-pink-700 dark:border-pink-900/40 dark:bg-pink-950/20 dark:text-pink-200',
    lime: 'border-lime-100 bg-lime-50/70 text-lime-800 dark:border-lime-900/40 dark:bg-lime-950/15 dark:text-lime-200',
    violet: 'border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200',
  };
  return (
    <div className={`rounded-2xl border p-5 ${accents[accent] || accents.blue}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">{message}</div>;
}

export default function BirthdayCommunicationsAnalytics({ clients = [], branches = [], birthdayCallers = [], onBack }) {
  const [today] = useState(() => new Date());
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState(format(today, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(today, 'yyyy-MM-dd'));
  const [branch, setBranch] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const callerNameById = useMemo(() => new Map(birthdayCallers.map((caller) => [caller.id, caller.name])), [birthdayCallers]);

  const periodBounds = useMemo(() => {
    const currentDay = startOfDay(today);
    if (period === '7d') return { start: startOfDay(subDays(currentDay, 6)), end: endOfDay(currentDay) };
    if (period === '30d') return { start: startOfDay(subDays(currentDay, 29)), end: endOfDay(currentDay) };
    if (period === 'month') return { start: startOfMonth(currentDay), end: endOfMonth(currentDay) };
    if (period === 'custom') {
      const start = startOfDay(new Date(`${customStart}T00:00:00`));
      const end = endOfDay(new Date(`${customEnd}T00:00:00`));
      return start <= end ? { start, end } : { start: endOfDay(new Date(`${customEnd}T00:00:00`)), end: endOfDay(new Date(`${customStart}T00:00:00`)) };
    }
    return { start: currentDay, end: endOfDay(currentDay) };
  }, [customEnd, customStart, period, today]);

  const birthdayRows = useMemo(() => {
    const { start, end } = periodBounds;
    return clients
      .map((client) => {
        const birthdayDate = birthdayInYear(client, today.getFullYear());
        if (!birthdayDate || !isWithinInterval(birthdayDate, { start, end })) return null;
        if (branch && client.branch !== branch) return null;
        const method = getMethod(client);
        const contactedAt = asDate(client.birthdayCalledAt);
        const redeemed = isOfferRedeemed(client, today.getFullYear());
        return {
          ...client,
          birthdayDate,
          contactedAt,
          method,
          contacted: method !== 'not_contacted',
          contactedById: client.birthdayCalledById || null,
          contactedBy: callerNameById.get(client.birthdayCalledById) || client.birthdayCalledByName || 'Not assigned',
          redeemed,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.birthdayDate - b.birthdayDate || (a.name || '').localeCompare(b.name || ''));
  }, [branch, callerNameById, clients, periodBounds, today]);

  const analytics = useMemo(() => {
    const contactedRows = birthdayRows.filter((row) => row.contacted);
    const redeemedRows = birthdayRows.filter((row) => row.redeemed);
    const methodCounts = ['called', 'messaged', 'both', 'unavailable'].map((method) => ({
      method,
      label: METHOD_LABELS[method],
      count: contactedRows.filter((row) => row.method === method).length,
    }));
    const callerCounts = Object.values(contactedRows.reduce((result, row) => {
      const key = row.contactedById || row.contactedBy;
      if (!result[key]) result[key] = { name: row.contactedBy, count: 0 };
      result[key].count += 1;
      return result;
    }, {})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const dailyCounts = Object.entries(contactedRows.reduce((result, row) => {
      if (!row.contactedAt) return result;
      const key = format(row.contactedAt, 'yyyy-MM-dd');
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {})).map(([date, count]) => ({ date: new Date(`${date}T00:00:00`), count })).sort((a, b) => a.date - b.date);

    return {
      total: birthdayRows.length,
      contacted: contactedRows.length,
      pending: birthdayRows.length - contactedRows.length,
      rate: birthdayRows.length ? Math.round((contactedRows.length / birthdayRows.length) * 100) : 0,
      redeemed: redeemedRows.length,
      redemptionRate: birthdayRows.length ? Math.round((redeemedRows.length / birthdayRows.length) * 100) : 0,
      contactedRedemptionRate: contactedRows.length ? Math.round((redeemedRows.filter((row) => row.contacted).length / contactedRows.length) * 100) : 0,
      methodCounts,
      callerCounts,
      dailyCounts,
    };
  }, [birthdayRows]);

  const filteredRows = useMemo(() => {
    const query = detailSearch.trim().toLowerCase();
    if (!query) return birthdayRows;
    return birthdayRows.filter((row) => [row.name, row.branch, row.contactedBy, METHOD_LABELS[row.method]].some((value) => value?.toLowerCase().includes(query)));
  }, [birthdayRows, detailSearch]);

  const maxMethod = Math.max(...analytics.methodCounts.map((item) => item.count), 1);
  const maxCaller = Math.max(...analytics.callerCounts.map((item) => item.count), 1);
  const maxDaily = Math.max(...analytics.dailyCounts.map((item) => item.count), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            {onBack && <button type="button" onClick={onBack} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Back"><span aria-hidden="true">←</span></button>}
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300">Birthday communications</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Call & message analytics</h2>
            </div>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">See birthday volume against completed outreach, then trace each contact by method, day, branch, and team member.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Analytics period">
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom period</option>
          </select>
          <select value={branch} onChange={(event) => setBranch(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Analytics branch">
            <option value="">All branches</option>
            {branches.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end dark:border-slate-800 dark:bg-slate-900">
          <label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
          <label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">To<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatPeriod(periodBounds.start, periodBounds.end)}</div>
        <div className="text-xs font-semibold text-slate-500">{branch || 'All branches'} · Birthday date window</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Birthdays in period" value={analytics.total} detail="Total birthday records" accent="blue" />
        <MetricCard label="Contacted" value={analytics.contacted} detail={`${analytics.rate}% of birthdays`} accent="pink" />
        <MetricCard label="Still pending" value={analytics.pending} detail="Not contacted yet" accent="lime" />
        <MetricCard label="Outreach coverage" value={`${analytics.rate}%`} detail={`${analytics.contacted} of ${analytics.total} contacted`} accent="violet" />
        <MetricCard label="50% offer redeemed" value={analytics.redeemed} detail={`${analytics.redemptionRate}% of birthdays · ${analytics.contactedRedemptionRate}% of contacted`} accent="violet" />
      </div>

      <section className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/70 via-white to-pink-50/60 p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/20 dark:via-slate-900 dark:to-pink-950/20">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-black text-slate-900 dark:text-white">Birthday offer performance</h3><p className="mt-1 text-xs font-medium text-slate-500">50% birthday offer redemptions compared with the birthday population and completed outreach.</p></div><div className="rounded-xl bg-white/80 px-3 py-2 text-right shadow-sm dark:bg-slate-900/70"><div className="text-lg font-black text-violet-700 dark:text-violet-200">{analytics.redeemed}</div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Redeemed</div></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[{ label: 'Birthday population', value: analytics.total, percent: 100, color: 'bg-blue-400' }, { label: 'Contacted', value: analytics.contacted, percent: analytics.total ? (analytics.contacted / analytics.total) * 100 : 0, color: 'bg-pink-400' }, { label: 'Redeemed 50% offer', value: analytics.redeemed, percent: analytics.total ? (analytics.redeemed / analytics.total) * 100 : 0, color: 'bg-violet-500' }].map((item) => <div key={item.label}><div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>{item.label}</span><span>{item.value} <span className="font-medium text-slate-400">({Math.round(item.percent)}%)</span></span></div><div className="h-2.5 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(item.percent, 100)}%` }} /></div></div>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900 dark:text-white">Contact mix</h3><p className="mt-1 text-xs font-medium text-slate-500">How outreach was completed</p></div><span className="text-xs font-black text-pink-600 dark:text-pink-300">{analytics.contacted} total</span></div>
          <div className="mt-6 space-y-4">
            {analytics.methodCounts.map((item) => <div key={item.method}><div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300"><span>{item.label}</span><span>{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.method === 'called' ? 'bg-blue-500' : item.method === 'messaged' ? 'bg-violet-500' : item.method === 'both' ? 'bg-pink-500' : 'bg-amber-500'}`} style={{ width: `${(item.count / maxMethod) * 100}%` }} /></div></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div><h3 className="font-black text-slate-900 dark:text-white">Activity by day</h3><p className="mt-1 text-xs font-medium text-slate-500">When contacts were recorded</p></div>
          <div className="mt-6 space-y-3">
            {analytics.dailyCounts.length === 0 ? <EmptyState message="No contact activity recorded in this period." /> : analytics.dailyCounts.slice(-7).map((item) => <div key={item.date.toISOString()} className="flex items-center gap-3"><span className="w-16 shrink-0 text-[11px] font-bold text-slate-500">{format(item.date, 'MMM d')}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-pink-400" style={{ width: `${(item.count / maxDaily) * 100}%` }} /></div><span className="w-5 text-right text-xs font-black text-slate-700 dark:text-slate-200">{item.count}</span></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div><h3 className="font-black text-slate-900 dark:text-white">Top callers</h3><p className="mt-1 text-xs font-medium text-slate-500">Contacts attributed by team member</p></div>
          <div className="mt-6 space-y-3">
            {analytics.callerCounts.length === 0 ? <EmptyState message="No attributed contacts in this period." /> : analytics.callerCounts.slice(0, 5).map((item) => <div key={item.name} className="flex items-center gap-3"><span className="w-28 shrink-0 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300" title={item.name}>{item.name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-400" style={{ width: `${(item.count / maxCaller) * 100}%` }} /></div><span className="w-5 text-right text-xs font-black text-slate-700 dark:text-slate-200">{item.count}</span></div>)}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-slate-900 dark:text-white">Birthday contact detail</h3><p className="mt-1 text-xs font-medium text-slate-500">{filteredRows.length} records in the selected view</p></div><input value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} placeholder="Search client, branch, caller..." className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:w-72" /></div>
        {filteredRows.length === 0 ? <div className="p-8"><EmptyState message="No birthday records match this period and filter." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-slate-50/80 dark:bg-slate-800/50"><tr>{['Birthday', 'Client', 'Branch', 'Status', 'Mode', '50% offer', 'Contacted on', 'By'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredRows.map((row) => <tr key={row.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"><td className="px-5 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200">{format(row.birthdayDate, 'MMM d')}</td><td className="px-5 py-3.5"><div className="text-sm font-bold text-slate-900 dark:text-white">{row.name || 'Unnamed client'}</div><div className="text-xs text-slate-500">{row.phoneNumber || 'No phone'}</div></td><td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{row.branch || '—'}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${row.contacted ? 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-200' : 'bg-lime-50 text-lime-800 dark:bg-lime-950/20 dark:text-lime-200'}`}>{row.contacted ? 'Contacted' : 'Pending'}</span></td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${METHOD_STYLES[row.method] || METHOD_STYLES.not_contacted}`}>{METHOD_LABELS[row.method] || METHOD_LABELS.not_contacted}</span></td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${row.redeemed ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200' : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{row.redeemed ? 'Redeemed' : 'Not redeemed'}</span></td><td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">{row.contactedAt ? format(row.contactedAt, 'MMM d, yyyy h:mm a') : '—'}</td><td className="px-5 py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200">{row.contactedBy}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
