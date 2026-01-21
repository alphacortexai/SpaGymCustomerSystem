'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export default function LinkInvoiceModal({ onSelect, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocs(query(collection(db, 'invoiceTracking'), orderBy('createdAt', 'desc'), limit(300)))
      .then((snap) => {
        if (cancelled) return;
        setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const t = (search || '').trim().toLowerCase();
    if (!t) return list.slice(0, 25);
    return list
      .filter(
        (i) =>
          String(i.invoiceNumber ?? '').includes(search.trim()) ||
          (i.clientName || '').toLowerCase().includes(t) ||
          (i.phone || '').includes(search.trim())
      )
      .slice(0, 25);
  }, [list, search]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Link invoice</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Only invoices imported in Invoice Tracking can be linked.</p>
          <input
            type="text"
            placeholder="Search by #, client, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-slate-500 dark:text-slate-400 py-4 text-center text-sm">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 py-4 text-center text-sm">No tracked invoices match. Import an invoice in Invoice Tracking first.</p>
            ) : (
              filtered.map((t) => {
                const sym = (t.currency || 'USD') === 'UGX' ? 'UGX ' : '$';
                return (
                  <button
                    key={t.id}
                    onClick={() => { onSelect({ invoiceNumber: t.invoiceNumber }); onClose(); }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <span className="font-medium">#{t.invoiceNumber}</span> · {t.clientName || '—'} · {sym}{Number(t.totalAmount || 0).toLocaleString()}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
