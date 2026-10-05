'use client';

import { useEffect, useMemo, useState } from 'react';

const PERIOD_OPTIONS = [
  { value: '2m', label: 'Last 2 months' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom period' },
];

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return asDate(value.toDate());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function subtractMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function formatDate(value) {
  const date = asDate(value);
  return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function MetricCard({ label, value, detail, tone }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 text-xs font-medium opacity-75">{detail}</div>
    </div>
  );
}

export default function NewClientsAnalyticsAdmin({ clients = [], loadClientData, onBack }) {
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState('2m');
  const [customStart, setCustomStart] = useState(toInputDate(subtractMonths(today, 2)));
  const [customEnd, setCustomEnd] = useState(toInputDate(today));
  const [branch, setBranch] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(!clients.length);

  useEffect(() => {
    let mounted = true;
    if (clients.length || !loadClientData) {
      return undefined;
    }
    Promise.resolve(loadClientData()).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [clients.length, loadClientData]);

  const branches = useMemo(() => [...new Set(clients.map((client) => client.branch?.trim()).filter(Boolean))].sort(), [clients]);

  const bounds = useMemo(() => {
    if (period === 'custom') {
      const start = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : startOfDay(subtractMonths(today, 2));
      const end = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : endOfDay(today);
      return start <= end ? { start, end } : { start: endOfDay(new Date(`${customEnd}T00:00:00`)), end: endOfDay(new Date(`${customStart}T00:00:00`)) };
    }
    const days = period === '30d' ? 30 : period === '90d' ? 90 : null;
    return { start: days ? startOfDay(new Date(today.getTime() - (days - 1) * 86400000)) : startOfDay(subtractMonths(today, 2)), end: endOfDay(today) };
  }, [customEnd, customStart, period, today]);

  const addedClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients
      .map((client) => ({ client, createdDate: asDate(client.createdAt) }))
      .filter(({ client, createdDate }) => createdDate && createdDate >= bounds.start && createdDate <= bounds.end)
      .filter(({ client }) => branch === 'all' || client.branch?.trim() === branch)
      .filter(({ client }) => !query || [client.name, client.phoneNumber, client.branch].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => b.createdDate - a.createdDate);
  }, [bounds, branch, clients, search]);

  const branchCounts = useMemo(() => {
    const counts = new Map();
    addedClients.forEach(({ client }) => {
      const name = client.branch?.trim() || 'Unassigned';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [addedClients]);

  const rangeLabel = `${formatDate(bounds.start)} – ${formatDate(bounds.end)}`;
  const isLoading = loading && !clients.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Admin reporting</div>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">New Clients Analytics</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">See clients added during the last two months or any custom period. Dates use the client record creation date.</p>
        </div>
        <button type="button" onClick={onBack} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Back to Admin</button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-black uppercase tracking-wider text-slate-500">Period<select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="flex-1 text-xs font-black uppercase tracking-wider text-slate-500">Branch<select value={branch} onChange={(event) => setBranch(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><option value="all">All branches</option>{branches.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="flex-[1.4] text-xs font-black uppercase tracking-wider text-slate-500">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, phone or branch" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
      </div>

      {period === 'custom' && <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row"><label className="flex-1 text-xs font-black uppercase tracking-wider text-slate-500">From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label><label className="flex-1 text-xs font-black uppercase tracking-wider text-slate-500">To<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label></div>}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">{rangeLabel}</span><span className="text-xs font-semibold text-slate-500">{addedClients.length} matching client{addedClients.length === 1 ? '' : 's'}</span></div>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="New clients" value={addedClients.length} detail="Added in the selected period" tone="border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200" /><MetricCard label="Branches represented" value={branchCounts.length} detail="With at least one new client" tone="border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200" /><MetricCard label="Average per day" value={Math.round((addedClients.length / Math.max(1, Math.ceil((bounds.end - bounds.start + 1) / 86400000))) * 10) / 10} detail="Across the selected range" tone="border-violet-100 bg-violet-50/70 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-200" /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Clients added in this period</h3><p className="mt-1 text-xs font-medium text-slate-500">Most recently added records appear first.</p></div><div className="overflow-x-auto">{isLoading ? <div className="p-10 text-center text-sm font-semibold text-slate-500">Loading client data…</div> : <table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">{['Client', 'Branch', 'Phone', 'Added'].map((heading) => <th key={heading} className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{heading}</th>)}</tr></thead><tbody>{addedClients.length ? addedClients.map(({ client, createdDate }) => <tr key={client.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-5 py-4 text-sm font-black text-slate-800 dark:text-slate-100">{client.name || 'Unnamed client'}</td><td className="px-5 py-4 text-sm font-semibold text-slate-500">{client.branch || 'Unassigned'}</td><td className="px-5 py-4 text-sm font-semibold text-slate-500">{client.phoneNumber || '—'}</td><td className="px-5 py-4 text-sm font-semibold text-slate-500">{formatDate(createdDate)}</td></tr>) : <tr><td colSpan="4" className="px-5 py-12 text-center text-sm font-semibold text-slate-500">No clients were added in this period.</td></tr>}</tbody></table>}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h3 className="font-black text-slate-900 dark:text-white">By branch</h3><p className="mt-1 text-xs font-medium text-slate-500">New clients by location.</p><div className="mt-5 space-y-3">{branchCounts.length ? branchCounts.map(([name, count]) => <div key={name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"><span className="truncate pr-3 text-sm font-bold text-slate-700 dark:text-slate-200">{name}</span><span className="text-lg font-black text-slate-900 dark:text-white">{count}</span></div>) : <p className="text-sm font-semibold text-slate-500">No branch data for this period.</p>}</div></section>
      </div>
    </div>
  );
}
