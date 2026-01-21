'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ViewInvoiceModal from '@/components/ViewInvoiceModal';

const STATUS_LABELS = {
  issued: 'Issued',
  sent_to_client: 'Sent to client (pending)',
  completed: 'Completed',
};

export default function InvoiceTracking() {
  const { user, profile } = useAuth();
  const { toast, showConfirm } = useNotifications();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [importInvoices, setImportInvoices] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [importError, setImportError] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // { id, tracking }
  const [statusValue, setStatusValue] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [viewRecord, setViewRecord] = useState(null); // { tracking, invoice: null|{} }
  const [viewLoading, setViewLoading] = useState(false);

  const isAllowed = profile?.role === 'Admin' || profile?.role === 'Manager';
  const isAdmin = profile?.role === 'Admin';
  const [removingId, setRemovingId] = useState(null);

  const fetchTracking = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'invoiceTracking'),
        orderBy('createdAt', 'desc'),
        limit(500)
      );
      const snap = await getDocs(q);
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e?.message || 'Failed to load.');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowed) return;
    fetchTracking();
  }, [isAllowed]);

  const filtered = useMemo(() => {
    let l = list;
    if (statusFilter !== 'all') l = l.filter((t) => (t.status || '') === statusFilter);
    const term = (searchTerm || '').trim();
    if (term) {
      const lower = term.toLowerCase();
      l = l.filter(
        (t) =>
          String(t.invoiceNumber ?? '').includes(term) ||
          (t.clientName || '').toLowerCase().includes(lower) ||
          (t.phone || '').includes(term)
      );
    }
    return l;
  }, [list, statusFilter, searchTerm]);

  const openImport = async () => {
    setImportOpen(true);
    setImportSearch('');
    setImportError(null);
    setImportLoading(true);
    try {
      const q = query(
        collection(db, 'invoices'),
        orderBy('invoiceNumber', 'desc'),
        limit(300)
      );
      const snap = await getDocs(q);
      setImportInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setImportError(e?.message || 'Failed to load invoices.');
      setImportInvoices([]);
    } finally {
      setImportLoading(false);
    }
  };

  const importFiltered = useMemo(() => {
    const term = (importSearch || '').trim();
    if (!term) return importInvoices.slice(0, 20);
    const lower = term.toLowerCase();
    return importInvoices
      .filter(
        (i) =>
          String(i.invoiceNumber ?? '').includes(term) ||
          (i.clientName || '').toLowerCase().includes(lower) ||
          (i.phone || '').includes(term)
      )
      .slice(0, 20);
  }, [importInvoices, importSearch]);

  const doImport = async (inv) => {
    setImportError(null);
    try {
      const existing = await getDocs(
        query(collection(db, 'invoiceTracking'), where('invoiceNumber', '==', inv.invoiceNumber))
      );
      if (!existing.empty) {
        setImportError('This invoice is already in tracking.');
        return;
      }
      await addDoc(collection(db, 'invoiceTracking'), {
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        company: inv.company,
        phone: inv.phone,
        invoiceDate: inv.invoiceDate,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
        serviceType: inv.serviceType,
        experienceType: inv.experienceType,
        status: 'issued',
        createdAt: serverTimestamp(),
        createdBy: user?.email || user?.uid,
      });
      setImportOpen(false);
      fetchTracking();
    } catch (e) {
      setImportError(e?.message || 'Import failed.');
    }
  };

  const openStatus = (t) => {
    setStatusModal({ id: t.id, tracking: t });
    setStatusValue(t.status || 'issued');
    setProofFile(null);
    setStatusError(null);
  };

  const saveStatus = async () => {
    if (!statusModal) return;
    setStatusSaving(true);
    try {
      const isCompleted = statusValue === 'completed';
      let proofUrl = null;
      let proofFileName = null;

      if (isCompleted) {
        if (!proofFile) {
          setStatusError('Proof of payment (image or PDF) is required to set Completed.');
          setStatusSaving(false);
          return;
        }
        const path = `invoice-proofs/${statusModal.id}/${Date.now()}_${proofFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, proofFile, { contentType: proofFile.type });
        proofUrl = await getDownloadURL(storageRef);
        proofFileName = proofFile.name;
      }

      await updateDoc(doc(db, 'invoiceTracking', statusModal.id), {
        status: statusValue,
        ...(proofUrl && {
          proofOfPaymentUrl: proofUrl,
          proofOfPaymentFileName: proofFileName,
          proofOfPaymentUploadedAt: serverTimestamp(),
          proofOfPaymentUploadedBy: user?.email || user?.uid,
        }),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || user?.uid,
      });
      setStatusModal(null);
      fetchTracking();
    } catch (e) {
      setStatusError(e?.message || 'Update failed.');
    } finally {
      setStatusSaving(false);
    }
  };

  const doRemove = async (t) => {
    if (!isAdmin) return;
    const ok = await showConfirm({
      title: 'Remove from tracking',
      message: `Remove invoice #${t.invoiceNumber} (${t.clientName || '—'}) from tracking? This does not delete the invoice itself, only the tracking record.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    setRemovingId(t.id);
    try {
      await deleteDoc(doc(db, 'invoiceTracking', t.id));
      fetchTracking();
    } catch (e) {
      toast('Failed to remove: ' + (e?.message || 'Unknown error'), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const openView = async (t) => {
    setViewRecord({ tracking: t, invoice: null });
    setViewLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'invoices'), where('invoiceNumber', '==', t.invoiceNumber), limit(1))
      );
      const inv = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
      setViewRecord((r) => ({ ...r, invoice: inv || buildPartialFromTracking(t) }));
    } catch {
      setViewRecord((r) => ({ ...r, invoice: buildPartialFromTracking(t) }));
    } finally {
      setViewLoading(false);
    }
  };

  const buildPartialFromTracking = (t) => ({
    invoiceNumber: t.invoiceNumber,
    invoiceDate: t.invoiceDate,
    clientName: t.clientName,
    company: t.company,
    phone: t.phone,
    serviceType: t.serviceType,
    currency: t.currency,
    totalAmount: t.totalAmount,
    qty: 1,
  });

  if (!isAllowed) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">Access denied. Managers and Admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            placeholder="Search by invoice #, client, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-52 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
        >
          <option value="all">All statuses</option>
          <option value="issued">Issued</option>
          <option value="sent_to_client">Sent to client (pending)</option>
          <option value="completed">Completed</option>
        </select>
        <button
          onClick={openImport}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          Import invoice
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-rose-700 dark:text-rose-300 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Invoice #</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Client</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Proof</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      {list.length === 0 ? 'No invoices in tracking. Use "Import invoice" to add one.' : 'No matches for your search or filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{t.invoiceNumber}</td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{t.clientName || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.invoiceDate || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                            t.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' :
                            t.status === 'sent_to_client' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {STATUS_LABELS[t.status] || t.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.proofOfPaymentUrl ? (
                          <a href={t.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-xs">View</a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openView(t)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium">View</button>
                          <button onClick={() => openStatus(t)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">Status</button>
                          {isAdmin && (
                            <button
                              onClick={() => doRemove(t)}
                              disabled={removingId === t.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 text-xs font-medium"
                              title="Remove from tracking (Admin only)"
                            >
                              {removingId === t.id ? 'Removing…' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import modal */}
      {importOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setImportOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Import invoice</h3>
              <button onClick={() => setImportOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">×</button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                placeholder="Search by #, client, or phone..."
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              {importError && <p className="text-rose-600 dark:text-rose-400 text-sm">{importError}</p>}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {importLoading ? (
                  <p className="text-slate-500 py-4 text-center">Loading…</p>
                ) : (
                  importFiltered.map((inv) => {
                    const sym = inv.currency === 'UGX' ? 'UGX ' : '$';
                    return (
                      <button
                        key={inv.id}
                        onClick={() => doImport(inv)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
                      >
                        <span className="font-medium">{inv.invoiceNumber}</span> · {inv.clientName || '—'} · {sym}{Number(inv.totalAmount || 0).toLocaleString()}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change status modal */}
      {statusModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStatusModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Change status</h3>
            <select
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              className="w-full mb-4 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="issued">Issued</option>
              <option value="sent_to_client">Sent to client (pending)</option>
              <option value="completed">Completed</option>
            </select>
            {statusError && <p className="text-rose-600 dark:text-rose-400 text-sm mb-2">{statusError}</p>}
            {statusValue === 'completed' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Proof of payment (image or PDF) *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStatusModal(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium">Cancel</button>
              <button onClick={saveStatus} disabled={statusSaving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium">
                {statusSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewRecord && viewLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="rounded-xl bg-white dark:bg-slate-900 px-6 py-4 flex items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <span className="text-slate-600 dark:text-slate-400">Loading invoice details…</span>
          </div>
        </div>
      )}
      {viewRecord && viewRecord.invoice && !viewLoading && (
        <ViewInvoiceModal
          invoice={viewRecord.invoice}
          extra={viewRecord.tracking ? { status: viewRecord.tracking.status, proofOfPaymentUrl: viewRecord.tracking.proofOfPaymentUrl } : undefined}
          onClose={() => setViewRecord(null)}
        />
      )}
    </div>
  );
}
