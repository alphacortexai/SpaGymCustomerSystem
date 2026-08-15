'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/LoadingState';
import {
  addPartnerCompany,
  deletePartnerCompany,
  getPartnerCompanies,
  updatePartnerCompany,
} from '@/lib/partnerCompanies';

export default function PartnerCompanyManager() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCompanies = async () => {
    setLoading(true);
    setCompanies(await getPartnerCompanies());
    setLoading(false);
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleAdd = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const result = await addPartnerCompany(name, user);
    if (result.success) {
      setName('');
      await loadCompanies();
    } else {
      setError(result.error || 'Unable to add company.');
    }
    setSaving(false);
  };

  const handleUpdate = async (companyId) => {
    setSaving(true);
    setError('');
    const result = await updatePartnerCompany(companyId, editingName);
    if (result.success) {
      setEditingId(null);
      setEditingName('');
      await loadCompanies();
    } else {
      setError(result.error || 'Unable to update company.');
    }
    setSaving(false);
  };

  const handleDelete = async (companyId) => {
    if (!window.confirm('Delete this partner company? Existing invoices will keep their saved company name.')) return;
    setSaving(true);
    await deletePartnerCompany(companyId);
    await loadCompanies();
    setSaving(false);
  };

  return (
    <section className="card-bg-doc rounded-2xl border border-slate-200 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-5">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Partner Companies</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Add companies that can be selected when creating an invoice.</p>
      </div>

      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Company name" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        <button type="submit" disabled={saving || !name.trim()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Add company</button>
      </form>

      {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {loading ? <LoadingState title="Loading partner companies" description="Preparing company options." compact /> : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {companies.length === 0 && <p className="py-5 text-sm text-slate-500">No partner companies have been added.</p>}
          {companies.map((company) => (
            <div key={company.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              {editingId === company.id ? (
                <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              ) : <span className="font-semibold text-slate-800 dark:text-slate-200">{company.name}</span>}
              <div className="flex gap-2">
                {editingId === company.id ? (
                  <>
                    <button type="button" onClick={() => handleUpdate(company.id)} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setEditingId(company.id); setEditingName(company.name); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Edit</button>
                    <button type="button" onClick={() => handleDelete(company.id)} disabled={saving} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50">Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
