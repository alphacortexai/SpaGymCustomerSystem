'use client';

import { useEffect, useState } from 'react';
import {
  addBirthdayCaller,
  deleteBirthdayCaller,
  getBirthdayCallers,
  updateBirthdayCaller,
} from '@/lib/birthdayCallers';

const emptyForm = { name: '', roleLabel: '' };

export default function BirthdayCallersManager({ onChanged }) {
  const [callers, setCallers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCallers = async () => {
    setLoading(true);
    setError('');
    const nextCallers = await getBirthdayCallers();
    setCallers(nextCallers);
    setLoading(false);
  };

  useEffect(() => {
    let isActive = true;
    getBirthdayCallers().then((nextCallers) => {
      if (!isActive) return;
      setCallers(nextCallers);
      setLoading(false);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Enter the name of a marketing or management team member.');
      return;
    }

    setSaving(true);
    setError('');
    const result = editingId
      ? await updateBirthdayCaller(editingId, form)
      : await addBirthdayCaller(form);

    if (!result.success) {
      setError(result.error || 'Unable to save this caller.');
      setSaving(false);
      return;
    }

    resetForm();
    await loadCallers();
    if (onChanged) onChanged();
    setSaving(false);
  };

  const handleEdit = (caller) => {
    setEditingId(caller.id);
    setForm({ name: caller.name || '', roleLabel: caller.roleLabel || '' });
    setError('');
  };

  const handleDelete = async (caller) => {
    if (!window.confirm(`Remove ${caller.name} from the birthday caller list?`)) return;
    setSaving(true);
    const result = await deleteBirthdayCaller(caller.id);
    if (!result.success) setError(result.error || 'Unable to remove this caller.');
    else {
      await loadCallers();
      if (onChanged) onChanged();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/70 to-lime-50/70 p-6 shadow-lg shadow-pink-900/5 dark:border-slate-800 dark:from-slate-950 dark:via-pink-950/20 dark:to-lime-950/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-600 dark:text-pink-300">Birthday workflow</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Birthday call team</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Add the marketing activity managers and other managers who should appear in the <strong>Called by</strong> selector. This list is shared by every approved user.
            </p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-right shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <div className="text-2xl font-black text-pink-600 dark:text-pink-300">{callers.length}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active callers</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Sharon Nakato"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Team / role (optional)</span>
            <input
              value={form.roleLabel}
              onChange={(event) => setForm((current) => ({ ...current, roleLabel: event.target.value }))}
              placeholder="Marketing Manager"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-lime-500 focus:ring-4 focus:ring-lime-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
          <div className="flex gap-2">
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            )}
            <button type="submit" disabled={saving} className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Saving…' : editingId ? 'Update caller' : 'Add caller'}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">Available in birthday records</h3>
          <p className="mt-1 text-xs text-slate-500">Removing a name does not erase historical call records already saved on clients.</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading caller names…</div>
        ) : callers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No callers configured yet. Add the first name above.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {callers.map((caller) => (
              <div key={caller.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{caller.name}</div>
                  <div className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{caller.roleLabel || 'Team member'}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEdit(caller)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300">Edit</button>
                  <button type="button" onClick={() => handleDelete(caller)} disabled={saving} className="rounded-lg border border-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-300">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
