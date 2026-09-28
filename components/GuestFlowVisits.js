'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkOutGuestFlowVisit, getTodayGuestFlowVisits } from '@/lib/guestflowVisits';

function Icon({ name, className = '' }) {
  const paths = {
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    logout: 'M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
    refresh: 'M20 7v5h-5M4 17v-5h5m11-2a8 8 0 0 0-14-3L4 12m0 0a8 8 0 0 0 14 3l2-3',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-1-12.13a4 4 0 0 1 0 7.75',
  };
  return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function timeLabel(value) {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date) : '—';
}

export default function GuestFlowVisits({ onBack }) {
  const { user, profile } = useAuth();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const canCheckOut = profile?.role === 'Admin' || profile?.permissions?.clients?.edit === true;

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setVisits(await getTodayGuestFlowVisits());
      setRefreshedAt(new Date());
    } catch (loadError) {
      console.error('Unable to load GuestFlow visits:', loadError);
      setError('Could not load check-in records. Confirm your account has client-view permission.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  async function checkOut(visit) {
    if (!canCheckOut || visit.checkedOutAt) return;
    setWorkingId(visit.id);
    setError('');
    try {
      await checkOutGuestFlowVisit(visit.id, user?.displayName || user?.email || 'SpaGym staff');
      await loadVisits();
    } catch (checkoutError) {
      console.error('Unable to check out GuestFlow visit:', checkoutError);
      setError('Could not record check-out. Confirm your account has client-edit permission.');
    } finally {
      setWorkingId('');
    }
  }

  const activeCount = visits.filter((visit) => !visit.checkedOutAt).length;

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">GuestFlow integration</p>
          <div className="mt-1 flex items-center gap-3">
            {onBack && <button type="button" onClick={onBack} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" aria-label="Back to home">←</button>}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Spa check-ins</h2>
          </div>
          <p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">Today's client arrivals and departures recorded by the GuestFlow sign-in screen.</p>
        </div>
        <button type="button" onClick={loadVisits} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Icon name="refresh" className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Icon name="users" /> Arrivals today</div><div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{visits.length}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><Icon name="clock" /> Still checked in</div><div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{activeCount}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Last refreshed</div><div className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">{refreshedAt ? timeLabel(refreshedAt.toISOString()) : '—'}</div></div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Today's register</h3><p className="mt-1 text-xs font-medium text-slate-500">Check-outs are recorded in the same shared visit log.</p></div>
        {loading ? <div className="p-10 text-center text-sm font-semibold text-slate-500">Loading today's check-ins…</div> : visits.length === 0 ? <div className="p-10 text-center text-sm font-semibold text-slate-500">No GuestFlow arrivals have been recorded today.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60"><th className="px-5 py-3">Client</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Check-in</th><th className="px-5 py-3">Check-out</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{visits.map((visit) => <tr key={visit.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{visit.clientName || 'Client'}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{visit.phoneNumber || '—'}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{visit.branch || '—'}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{timeLabel(visit.checkedInAt)}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{timeLabel(visit.checkedOutAt)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${visit.checkedOutAt ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>{visit.checkedOutAt ? 'Checked out' : 'On site'}</span></td><td className="px-5 py-4">{!visit.checkedOutAt && canCheckOut ? <button type="button" onClick={() => checkOut(visit)} disabled={workingId === visit.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"><Icon name="logout" />{workingId === visit.id ? 'Saving…' : 'Check out'}</button> : <span className="text-xs font-semibold text-slate-400">{visit.checkedOutAt ? (visit.checkedOutBy || 'Recorded') : 'View only'}</span>}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </section>
  );
}
