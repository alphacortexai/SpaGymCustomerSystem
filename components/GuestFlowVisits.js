'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from '@/lib/usePageVisibility';
import { extractAllPhoneNumbers } from '@/lib/phoneUtils';
import {
  checkInGuestFlowClient,
  checkOutGuestFlowVisit,
  deleteGuestFlowVisit,
  getGuestFlowVisitsForDate,
  getTodayGuestFlowVisits,
  getKampalaDateKey,
} from '@/lib/guestflowVisits';

function Icon({ name, className = '' }) {
  const paths = {
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    logout: 'M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
    refresh: 'M20 7v5h-5M4 17v-5h5m11-2a8 8 0 0 0-14-3L4 12m0 0a8 8 0 0 0 14 3l2-3',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm13 10v-2a4 4 0 0 0-3-3.87m-1-12.13a4 4 0 0 1 0 7.75',
    plus: 'M12 5v14m-7-7h14',
    trash: 'M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 13h10l1-13',
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

export default function GuestFlowVisits({ onBack, clients = [], branches = [] }) {
  const { user, profile } = useAuth();
  const isVisible = usePageVisibility();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // null = today
  const [branchFilter, setBranchFilter] = useState('all');
  const todayKey = getKampalaDateKey();
  const isHistoricalDate = Boolean(selectedDate && selectedDate !== todayKey);
  const canCheckOut = profile?.role === 'Admin' || profile?.permissions?.clients?.edit === true;
  const canCheckIn = profile?.role === 'Admin' || profile?.permissions?.clients?.view === true;
  const canDelete = profile?.role === 'Admin' && profile?.email?.toLowerCase() === 'alphacortexai@gmail.com';

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (selectedDate) {
        setVisits(await getGuestFlowVisitsForDate(selectedDate, { canCheckOut }));
      } else {
        setVisits(await getTodayGuestFlowVisits({ canCheckOut }));
      }
      setRefreshedAt(new Date());
    } catch (loadError) {
      console.error('Unable to load GuestFlow visits:', loadError);
      setError('Could not load check-in records for the selected date.');
    } finally {
      setLoading(false);
    }
  }, [canCheckOut, selectedDate]);

  useEffect(() => { loadVisits(); }, [loadVisits]);
  useEffect(() => {
    if (!isVisible) return undefined;
    const interval = window.setInterval(loadVisits, 60_000);
    return () => window.clearInterval(interval);
  }, [loadVisits, isVisible]);
  useEffect(() => { if (isVisible) loadVisits(); }, [isVisible, loadVisits]);

  const matchingClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    const sorted = [...clients].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    if (!term) return sorted.slice(0, 12);
    return sorted.filter((client) => `${client.name || ''} ${client.phoneNumber || ''}`.toLowerCase().includes(term)).slice(0, 12);
  }, [clientSearch, clients]);
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const branchOptions = useMemo(() => [...new Set([...branches.map((branch) => String(branch.name || branch || '').trim()), ...visits.map((visit) => String(visit.branch || '').trim())].filter(Boolean))].sort((a, b) => a.localeCompare(b)), [branches, visits]);
  const filteredVisits = useMemo(() => branchFilter === 'all' ? visits : visits.filter((visit) => String(visit.checkedInBranch || visit.branch || '').trim() === branchFilter), [branchFilter, visits]);
  const activeCount = filteredVisits.filter((visit) => !visit.checkedOutAt).length;
  function getRegisteredBranch(visit) {
    return visit.registeredBranch || clients.find((client) => client.id === visit.clientId)?.branch || '';
  }
  function getContactPhone(phoneNumber) {
    return extractAllPhoneNumbers(phoneNumber)[0] || '';
  }
  function getCallLink(phoneNumber) {
    const normalized = getContactPhone(phoneNumber);
    return normalized ? `tel:${normalized}` : '';
  }
  function getWhatsAppLink(phoneNumber) {
    const normalized = getContactPhone(phoneNumber);
    if (!normalized) return '';
    return `https://wa.me/256${normalized.replace(/^0/, '')}`;
  }

  function openCheckIn() {
    setError('');
    setSuccess('');
    setClientSearch('');
    setSelectedClientId('');
    setShowCheckInModal(true);
  }

  async function checkInSelectedClient(event) {
    event.preventDefault();
    if (!selectedClientId || checkInLoading) return;
    setCheckInLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await checkInGuestFlowClient(selectedClientId);
      setSuccess(result.alreadyCheckedIn ? `${selectedClient?.name || 'Client'} is already checked in today.` : `${selectedClient?.name || 'Client'} checked in successfully.`);
      setShowCheckInModal(false);
      await loadVisits();
    } catch (checkInError) {
      console.error('Unable to check in client:', checkInError);
      setError(checkInError.message || 'Could not record the client check-in.');
    } finally {
      setCheckInLoading(false);
    }
  }

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

  async function deleteVisit(visit) {
    if (!canDelete || workingId === visit.id) return;
    if (!window.confirm(`Delete the check-in for ${visit.clientName || 'this client'}? This cannot be undone.`)) return;
    setWorkingId(visit.id);
    setError('');
    try {
      await deleteGuestFlowVisit(visit.id);
      setSuccess('Check-in deleted.');
      await loadVisits();
    } catch (deleteError) {
      console.error('Unable to delete GuestFlow visit:', deleteError);
      setError(deleteError.message || 'Could not delete this check-in.');
    } finally {
      setWorkingId('');
    }
  }

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">GuestFlow integration</p>
          <div className="mt-1 flex items-center gap-3">
            {onBack && <button type="button" onClick={onBack} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" aria-label="Back to home">←</button>}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Spa check-ins</h2>
          </div>
          <p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">{selectedDate ? `Check-ins for ${selectedDate}. Use the date picker at the top to view historical arrivals and departures.` : "Today's client arrivals and departures. The register opens on the current Kampala day by default."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCheckIn && <button type="button" onClick={openCheckIn} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"><Icon name="plus" /> Check in client</button>}
          <button type="button" onClick={loadVisits} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Refresh</button>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <span>📅</span>
            <input
              type="date"
              value={selectedDate || todayKey}
              max={todayKey}
              onChange={(e) => setSelectedDate(e.target.value || null)}
              className="w-full max-w-[160px] cursor-pointer border-0 bg-transparent text-sm font-bold text-slate-900 dark:text-slate-200 focus:outline-none"
            />
          </label>
          {selectedDate && (
            <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Clear</button>
          )}
        </div>
      </div>

      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{success}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Check-in branch registers">
        <button type="button" role="tab" aria-selected={branchFilter === 'all'} onClick={() => setBranchFilter('all')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${branchFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>All branches <span className="ml-1 opacity-75">({visits.length})</span></button>
        {branchOptions.map((branch) => <button type="button" role="tab" aria-selected={branchFilter === branch} key={branch} onClick={() => setBranchFilter(branch)} className={`rounded-xl px-4 py-2 text-sm font-black transition ${branchFilter === branch ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{branch} <span className="ml-1 opacity-75">({visits.filter((visit) => String(visit.checkedInBranch || visit.branch || '').trim() === branch).length})</span></button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500"><Icon name="users" /> {selectedDate ? `Arrivals for ${selectedDate}` : 'Arrivals today'}</div><div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{filteredVisits.length}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><Icon name="clock" /> Still checked in</div><div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{activeCount}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Last refreshed</div><div className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">{refreshedAt ? timeLabel(refreshedAt.toISOString()) : '—'}</div></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">{selectedDate ? `${selectedDate} register` : "Today's register"}{branchFilter !== 'all' ? ` · ${branchFilter}` : ''}</h3><p className="mt-1 text-xs font-medium text-slate-500">Check-outs are recorded in the shared visit log.</p></div>
        {loading ? <div className="p-10 text-center text-sm font-semibold text-slate-500">Loading check-ins…</div> : filteredVisits.length === 0 ? <div className="p-10 text-center text-sm font-semibold text-slate-500">No arrivals have been recorded for this date.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60"><th className="px-5 py-3">Client</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Registered branch</th><th className="px-5 py-3">Check-in branch</th><th className="px-5 py-3">Check-in</th><th className="px-5 py-3">Check-out</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{filteredVisits.map((visit) => { const callLink = getCallLink(visit.phoneNumber); const whatsappLink = getWhatsAppLink(visit.phoneNumber); return <tr key={visit.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800"><td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">{visit.clientName || 'Client'}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{visit.phoneNumber || '—'}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{getRegisteredBranch(visit) || '—'}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{visit.checkedInBranch || visit.branch || '—'}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{timeLabel(visit.checkedInAt)}</td><td className="px-5 py-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{timeLabel(visit.checkedOutAt)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${visit.checkedOutAt ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>{visit.checkedOutAt ? 'Checked out' : 'On site'}</span></td><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2">{isHistoricalDate && callLink && <a href={callLink} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 transition-all hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-900/20" title={`Call ${visit.clientName || 'client'}`}><Image src="/telephone.svg" alt="Call" width={20} height={20} className="h-5 w-5" /></a>}{isHistoricalDate && whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 transition-all hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/20" title={`WhatsApp ${visit.clientName || 'client'}`}><Image src="/whatsapp.svg" alt="WhatsApp" width={20} height={20} className="h-5 w-5" /></a>}{!visit.checkedOutAt && canCheckOut && <button type="button" onClick={() => checkOut(visit)} disabled={workingId === visit.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{workingId === visit.id ? 'Saving…' : 'Check out'}</button>}{canDelete && <button type="button" onClick={() => deleteVisit(visit)} disabled={workingId === visit.id} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-300" title="Delete check-in"><Icon name="trash" /> Delete</button>}{!isHistoricalDate && !canCheckOut && !canDelete && <span className="text-xs font-semibold text-slate-400">View only</span>}</div></td></tr>; })}</tbody></table></div>
        )}
      </div>

      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="check-in-dialog-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4"><div><h3 id="check-in-dialog-title" className="text-xl font-black text-slate-900 dark:text-white">Check in a client</h3><p className="mt-1 text-sm text-slate-500">Select a client for today’s spa visit.</p></div><button type="button" onClick={() => setShowCheckInModal(false)} className="text-2xl leading-none text-slate-400" aria-label="Close">×</button></div>
            <form onSubmit={checkInSelectedClient} className="mt-5 space-y-4">
              <input autoFocus value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search by client name or phone" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{matchingClients.length === 0 ? <p className="p-4 text-center text-sm text-slate-500">No matching clients found.</p> : matchingClients.map((client) => <button key={client.id} type="button" onClick={() => setSelectedClientId(client.id)} className={`w-full rounded-lg border px-3 py-3 text-left ${selectedClientId === client.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}><span className="block text-sm font-bold text-slate-900 dark:text-white">{client.name || 'Unnamed client'}</span><span className="mt-1 block text-xs text-slate-500">{client.phoneNumber || 'No phone'}{client.branch ? ` · ${client.branch}` : ''}</span></button>)}</div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCheckInModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="submit" disabled={!selectedClientId || checkInLoading} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{checkInLoading ? 'Checking in…' : 'Confirm check-in'}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
