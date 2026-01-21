'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { generateInvoicePdf } from '@/lib/invoicePdf';
import ViewInvoiceModal from '@/components/ViewInvoiceModal';

export default function InvoiceList() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Gym' | 'Spa'
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  const isAdmin = profile?.role === 'Admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchInvoices = async () => {
      try {
        const q = query(
          collection(db, 'invoices'),
          orderBy('invoiceNumber', 'desc'),
          limit(500)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvoices(list);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load invoices.');
        setInvoices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInvoices();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (typeFilter !== 'all') {
      list = list.filter((inv) => (inv.serviceType || '') === typeFilter);
    }
    const term = (searchTerm || '').trim();
    if (term) {
      const lower = term.toLowerCase();
      list = list.filter(
        (inv) =>
          String(inv.invoiceNumber ?? '').includes(term) ||
          (inv.clientName || '').toLowerCase().includes(lower) ||
          (inv.phone || '').includes(term)
      );
    }
    return list;
  }, [invoices, typeFilter, searchTerm]);

  const handleDownload = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const dataUri = await generateInvoicePdf(inv);
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = `invoice_${inv.invoiceNumber}.pdf`;
      a.click();
    } catch (e) {
      console.error('PDF generation failed:', e);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by invoice #, client name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="sm:w-40 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
        >
          <option value="all">All types</option>
          <option value="Gym">GYM</option>
          <option value="Spa">SPA</option>
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
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
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Client</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 hidden md:table-cell">Company</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Phone</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Total</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      {invoices.length === 0 ? 'No invoices yet.' : 'No invoices match your search or filter.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => {
                    const sym = inv.currency === 'UGX' ? 'UGX ' : '$';
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{inv.invoiceNumber}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.invoiceDate || '—'}</td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{inv.clientName || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">{inv.company || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{inv.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                              inv.serviceType === 'Gym'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                            }`}
                          >
                            {inv.serviceType === 'Gym' ? 'GYM' : inv.serviceType === 'Spa' ? 'SPA' : inv.serviceType || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{sym}{Number(inv.totalAmount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewInvoice(inv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              View
                            </button>
                            <button
                              onClick={() => handleDownload(inv)}
                              disabled={downloadingId === inv.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                            >
                              {downloadingId === inv.id ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  Creating…
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                  PDF
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400">
              Showing {filtered.length} of {invoices.length} invoice(s)
            </div>
          )}
        </div>
      )}

      {viewInvoice && (
        <ViewInvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
    </div>
  );
}
