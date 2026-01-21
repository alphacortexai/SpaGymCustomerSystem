'use client';

/**
 * Shows full invoice details. Optional extra: { status, proofOfPaymentUrl } for tracking view.
 */
export default function ViewInvoiceModal({ invoice, extra, onClose }) {
  if (!invoice) return null;
  const sym = invoice.currency === 'UGX' ? 'UGX ' : '$';
  const unitAmount = invoice.qty ? Number(invoice.totalAmount || 0) / Number(invoice.qty) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invoice #{invoice.invoiceNumber}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm">
          {extra && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Status</span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {extra.status === 'issued' && 'Issued'}
                  {extra.status === 'sent_to_client' && 'Sent to client (pending)'}
                  {extra.status === 'completed' && 'Completed'}
                  {!['issued','sent_to_client','completed'].includes(extra.status) && (extra.status || '—')}
                </p>
              </div>
              {extra.proofOfPaymentUrl && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Proof of payment</span>
                  <p>
                    <a href={extra.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                      View / Download
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500 dark:text-slate-400">Date</span>
            <span className="text-slate-900 dark:text-white">{invoice.invoiceDate || '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Client</span>
            <span className="text-slate-900 dark:text-white">{invoice.clientName || '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Company</span>
            <span className="text-slate-900 dark:text-white">{invoice.company || '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Phone</span>
            <span className="text-slate-900 dark:text-white">{invoice.phone || '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Type</span>
            <span className="text-slate-900 dark:text-white">{invoice.serviceType === 'Gym' ? 'GYM' : invoice.serviceType === 'Spa' ? 'SPA' : (invoice.serviceType || '—')}</span>
            <span className="text-slate-500 dark:text-slate-400">Experience</span>
            <span className="text-slate-900 dark:text-white">{invoice.experienceType || '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Currency</span>
            <span className="text-slate-900 dark:text-white">{invoice.currency || '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Item / Membership</span>
            <p className="text-slate-900 dark:text-white mt-0.5">{invoice.membership || invoice.customItem || '—'}</p>
          </div>
          {invoice.customAmount != null && invoice.customAmount !== '' && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-slate-500 dark:text-slate-400">Custom amount</span>
              <span className="text-slate-900 dark:text-white">{sym}{Number(invoice.customAmount).toLocaleString()}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500 dark:text-slate-400">Qty</span>
            <span className="text-slate-900 dark:text-white">{invoice.qty ?? '—'}</span>
            <span className="text-slate-500 dark:text-slate-400">Unit price</span>
            <span className="text-slate-900 dark:text-white">{sym}{Number(unitAmount).toLocaleString()}</span>
            <span className="text-slate-500 dark:text-slate-400">Total</span>
            <span className="font-semibold text-slate-900 dark:text-white">{sym}{Number(invoice.totalAmount || 0).toLocaleString()}</span>
          </div>
          {invoice.customComplimentaries && (
            <div>
              <span className="text-slate-500 dark:text-slate-400">Complimentaries</span>
              <p className="text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{invoice.customComplimentaries}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
