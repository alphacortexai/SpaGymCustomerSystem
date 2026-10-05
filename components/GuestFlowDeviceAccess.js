'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisibility } from '@/lib/usePageVisibility';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function isOnline(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Boolean(time && Date.now() - time <= 2 * 60 * 1000);
}

export default function GuestFlowDeviceAccess({ user, onBack }) {
  const isVisible = usePageVisibility();
  const wasVisibleRef = useRef(isVisible);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDevices = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/guestflow/devices', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load device requests.');
      setDevices(payload.devices || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load device requests.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const interval = window.setInterval(() => { void loadDevices({ silent: true }); }, 5000);
    return () => window.clearInterval(interval);
  }, [isVisible, loadDevices]);

  useEffect(() => {
    if (isVisible && !wasVisibleRef.current) void loadDevices({ silent: true });
    wasVisibleRef.current = isVisible;
  }, [isVisible, loadDevices]);

  async function updateDevice(device, action, body = {}) {
    setWorkingId(device.id);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/guestflow/devices/${encodeURIComponent(device.id)}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update this device.');
      if (action === 'rename') {
        setEditingId('');
        setNameDraft('');
        setNotice('Device name saved.');
      } else {
        setNotice(action === 'approve' ? 'Device approved. The kiosk will unlock automatically.' : 'Device revoked. Its saved credential is no longer valid.');
      }
      await loadDevices();
    } catch (updateError) {
      setError(updateError.message || 'Could not update this device.');
    } finally {
      setWorkingId('');
    }
  }

  function startEditing(device) {
    setEditingId(device.id);
    setNameDraft(device.deviceName || '');
    setError('');
    setNotice('');
  }

  const pending = devices.filter((device) => device.status === 'pending');
  const active = devices.filter((device) => device.status === 'approved');
  const revoked = devices.filter((device) => device.status === 'revoked');

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Top administrator</p>
          <div className="mt-1 flex items-center gap-3">
            {onBack && <button type="button" onClick={onBack} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800" aria-label="Back to admin tools">←</button>}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">GuestFlow device access</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Approve the phones and tablets allowed to use branch check-in links, and give each device a name so it is easy to recognize. New requests appear automatically while this page is open.</p>
        </div>
        <button type="button" onClick={loadDevices} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Refresh</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20"><div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Pending approval</div><div className="mt-2 text-3xl font-black text-amber-800 dark:text-amber-200">{pending.length}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20"><div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Approved devices</div><div className="mt-2 text-3xl font-black text-emerald-800 dark:text-emerald-200">{active.length}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-black uppercase tracking-wider text-slate-500">Revoked devices</div><div className="mt-2 text-3xl font-black text-slate-800 dark:text-slate-200">{revoked.length}</div></div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h3 className="font-black text-slate-900 dark:text-white">Device requests</h3><p className="mt-1 text-xs font-medium text-slate-500">Review the branch and browser before granting access. Custom names are only visible to administrators.</p></div>
        {loading && devices.length === 0 ? <div className="p-10 text-center text-sm font-semibold text-slate-500">Loading device requests…</div> : devices.length === 0 ? <div className="p-10 text-center text-sm font-semibold text-slate-500">No GuestFlow device requests have been received.</div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{devices.map((device) => {
          const isEditing = editingId === device.id;
          const isWorking = workingId === device.id;
          const displayName = device.deviceName || device.label || 'GuestFlow device';
          const online = isOnline(device.lastSeenAt);
          return (
            <article key={device.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-black text-slate-900 dark:text-white">{displayName}</h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">{device.branchName || 'All branches'}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${device.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : device.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{device.status}</span>
                  {device.status === 'approved' && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${online ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{online ? 'Online' : 'Offline'}</span>}
                </div>
                {isEditing ? (
                  <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); updateDevice(device, 'rename', { name: nameDraft }); }}>
                    <input autoFocus maxLength={80} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Front Desk Tablet" aria-label={`Name for ${displayName}`} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    <div className="flex gap-2">
                      <button type="submit" disabled={isWorking || !nameDraft.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">{isWorking ? 'Saving…' : 'Save name'}</button>
                      <button type="button" disabled={isWorking} onClick={() => { setEditingId(''); setNameDraft(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="mt-1 truncate text-xs font-medium text-slate-500">{device.deviceName ? `Device label: ${device.label || 'GuestFlow device'} · ` : ''}{device.userAgent || 'Unknown browser'} · Last seen {formatDate(device.lastSeenAt)} · Requested {formatDate(device.requestedAt)}</p>
                    <button type="button" onClick={() => startEditing(device)} className="mt-2 text-xs font-black text-blue-700 hover:underline dark:text-blue-300">{device.deviceName ? 'Edit device name' : 'Give this device a name'}</button>
                  </>
                )}
              </div>
              <div className="flex shrink-0 gap-2">{device.status !== 'approved' && <button type="button" onClick={() => updateDevice(device, 'approve')} disabled={isWorking || isEditing} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">{isWorking ? 'Saving…' : 'Approve'}</button>}{device.status === 'approved' && <button type="button" onClick={() => updateDevice(device, 'revoke')} disabled={isWorking || isEditing} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30">{isWorking ? 'Saving…' : 'Revoke'}</button>}</div>
            </article>
          );
        })}</div>}
      </section>
    </section>
  );
}
