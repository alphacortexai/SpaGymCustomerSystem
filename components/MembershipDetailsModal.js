'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { collection, getDocs, query, where, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { redeemEntitlement, getAccessLogs, logAccess, cancelEnrollment, deleteEnrollment, logTreatment, updateEnrollmentDocuments, updateEnrollment } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import ViewInvoiceModal from '@/components/ViewInvoiceModal';
import LinkInvoiceModal from '@/components/LinkInvoiceModal';

export default function MembershipDetailsModal({ enrollment, onClose, onUpdate, isSpa = false }) {
  const { user, profile } = useAuth();
  const { toast, showConfirm } = useNotifications();
  const canEdit = isSpa ? profile?.permissions?.spa?.edit !== false : profile?.permissions?.gym?.edit !== false;
  const isAdmin = profile?.role === 'Admin';
  
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ service: '', amount: '' });
  const [uploading, setUploading] = useState(false);
  
  // Linked invoice
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);

  // Fallback: when enrollment has no currency, fetch from membership type
  const [fetchedCurrency, setFetchedCurrency] = useState(null);

  // Admin Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    price: enrollment.price || 0,
    balance: enrollment.balance || 0,
    startDate: enrollment.startDate ? format(enrollment.startDate, 'yyyy-MM-dd') : '',
    expiryDate: enrollment.expiryDate ? format(enrollment.expiryDate, 'yyyy-MM-dd') : '',
    status: enrollment.status || 'active'
  });

  useEffect(() => {
    const loadLogs = async () => {
      const logs = await getAccessLogs(enrollment.clientId, new Date().getFullYear(), isSpa);
      setAccessLogs(logs);
    };
    loadLogs();
  }, [enrollment.clientId]);

  // When enrollment has no currency, fetch from membership type so we show UGX/USD correctly
  useEffect(() => {
    if (enrollment.currency) {
      setFetchedCurrency(null);
      return;
    }
    if (!enrollment.membershipTypeId) {
      setFetchedCurrency('USD');
      return;
    }
    let cancelled = false;
    const col = isSpa ? 'spa_membership_types' : 'membership_types';
    getDoc(doc(db, col, enrollment.membershipTypeId)).then((snap) => {
      if (cancelled) return;
      setFetchedCurrency(snap.exists() ? (snap.data().currency || 'USD') : 'USD');
    });
    return () => { cancelled = true; };
  }, [enrollment.currency, enrollment.membershipTypeId, isSpa]);

  const handleRedeem = async (entitlementName) => {
    const ok = await showConfirm({ message: `Redeem "${entitlementName}"?`, confirmLabel: 'Redeem' });
    if (!ok) return;
    setLoading(true);
    await redeemEntitlement(enrollment.id, entitlementName, isSpa);
    onUpdate();
    setLoading(false);
  };

  const handleLogTreatment = async (e) => {
    e.preventDefault();
    if (!treatmentForm.service || !treatmentForm.amount) return;
    
    setLoading(true);
    const result = await logTreatment(enrollment.id, treatmentForm, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
    if (result.success) {
      setTreatmentForm({ service: '', amount: '' });
      onUpdate();
    } else {
      toast('Error: ' + result.error, 'error');
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    const ok = await showConfirm({ message: 'Are you sure you want to cancel this membership?', confirmLabel: 'Cancel Membership' });
    if (!ok) return;
    setLoading(true);
    const result = await cancelEnrollment(enrollment.id, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
    if (result.success) {
      onUpdate();
      onClose();
    } else {
      toast('Error: ' + result.error, 'error');
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    const ok = await showConfirm({ message: 'Are you sure you want to PERMANENTLY DELETE this membership record? This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    setLoading(true);
    const result = await deleteEnrollment(enrollment.id, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
    if (result.success) {
      onUpdate();
      onClose();
    } else {
      toast('Error: ' + result.error, 'error');
    }
    setLoading(false);
  };

  const handleAdminUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await updateEnrollment(enrollment.id, editForm, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
    if (result.success) {
      setIsEditing(false);
      onUpdate();
      toast('Membership updated successfully', 'success');
    } else {
      toast('Error: ' + result.error, 'error');
    }
    setLoading(false);
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('clientId', enrollment.clientId);

      const response = await fetch('/api/upload-doc', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      
      if (result.success) {
        const docData = { [type]: { url: result.url, name: result.name, type: result.type } };
        await updateEnrollmentDocuments(enrollment.id, docData, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
        onUpdate();
      } else {
        toast('Upload Error: ' + result.error, 'error');
      }
    } catch (error) {
      toast('Error: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleViewInvoice = async () => {
    if (!enrollment?.invoiceNumber) return;
    setViewInvoiceLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'invoices'), where('invoiceNumber', '==', enrollment.invoiceNumber), limit(1)));
      if (!snap.empty) setViewInvoice({ id: snap.docs[0].id, ...snap.docs[0].data() });
      else toast('Invoice not found.', 'error');
    } catch (e) {
      toast('Error loading invoice: ' + (e?.message || 'Unknown'), 'error');
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  const handleLinkSelect = async (inv) => {
    setViewInvoiceLoading(true);
    try {
      const res = await updateEnrollment(enrollment.id, { invoiceNumber: inv.invoiceNumber }, user ? { uid: user.uid, displayName: user.displayName || user.email, email: user.email } : null, isSpa);
      if (res.success) onUpdate();
      else toast('Error: ' + (res.error || 'Could not link.'), 'error');
    } catch (e) {
      toast('Error: ' + (e?.message || 'Unknown'), 'error');
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  const handleUnlinkInvoice = async () => {
    const ok = await showConfirm({ message: 'Unlink this invoice from the membership?', confirmLabel: 'Unlink' });
    if (!ok) return;
    setViewInvoiceLoading(true);
    try {
      const res = await updateEnrollment(enrollment.id, { invoiceNumber: null }, user ? { uid: user.uid, displayName: user.displayName || user.email, email: user.email } : null, isSpa);
      if (res.success) onUpdate();
      else toast('Error: ' + (res.error || 'Could not unlink.'), 'error');
    } catch (e) {
      toast('Error: ' + (e?.message || 'Unknown'), 'error');
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Membership Details</h2>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all"
              >
                Edit Details
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">✕</button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
          {isEditing ? (
            <form onSubmit={handleAdminUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Price</label>
                  <input 
                    type="number" 
                    value={editForm.price}
                    onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Balance</label>
                  <input 
                    type="number" 
                    value={editForm.balance}
                    onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Start Date</label>
                  <input 
                    type="date" 
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({...editForm, startDate: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Expiry Date</label>
                  <input 
                    type="date" 
                    value={editForm.expiryDate}
                    onChange={(e) => setEditForm({...editForm, expiryDate: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-500">Status</label>
                  <select 
                    value={editForm.status}
                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Client</div>
                  <div className="font-bold">{enrollment.clientName}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Membership</div>
                  <div className="font-bold">{enrollment.membershipType}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Duration</div>
                  <div className="font-medium text-sm">
                    {format(enrollment.startDate, 'MMM d, yyyy')} - {format(enrollment.expiryDate, 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Price</div>
                  <div className="font-bold text-blue-600">{((enrollment.currency || fetchedCurrency || 'USD') === 'UGX' ? 'UGX ' : '$')}{Number(enrollment.price || 0).toLocaleString()}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Enrolled By</div>
                  <div className="font-medium text-sm">
                    {enrollment.enrolledBy?.name || 'System'}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <div className="text-xs text-slate-500 mb-1">Status</div>
                  <div className="font-bold capitalize">{enrollment.status || 'Active'}</div>
                </div>
                {enrollment.isReducingBalance && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 col-span-2">
                    <div className="text-xs text-blue-500 mb-1">Current Balance</div>
                    <div className="text-2xl font-black text-blue-600">{((enrollment.currency || fetchedCurrency || 'USD') === 'UGX' ? 'UGX ' : '$')}{Number(enrollment.balance || 0).toLocaleString()}</div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Linked invoice</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {enrollment.invoiceNumber != null && enrollment.invoiceNumber !== '' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">Invoice #{enrollment.invoiceNumber}</span>
                      <button
                        onClick={handleViewInvoice}
                        disabled={viewInvoiceLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium"
                      >
                        {viewInvoiceLoading ? 'Loading…' : 'View'}
                      </button>
                      {canEdit && (
                        <button
                          onClick={handleUnlinkInvoice}
                          disabled={viewInvoiceLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ) : canEdit ? (
                    <button
                      onClick={() => setLinkModalOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      Link invoice
                    </button>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 text-sm">No invoice linked</span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="flex gap-3">
                  {enrollment.status !== 'cancelled' && (
                    <button
                      onClick={handleCancel}
                      disabled={loading}
                      className="flex-1 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-xl text-sm font-bold transition-all"
                    >
                      Cancel Membership
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl text-sm font-bold transition-all"
                  >
                    Delete Record
                  </button>
                </div>
              )}

              {!enrollment.isReducingBalance && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Entitlements</h3>
                  <div className="flex flex-wrap gap-2">
                    {enrollment.entitlements?.map((ent, idx) => {
                    const entName = typeof ent === 'string' ? ent : ent.name;
                    const totalQty = typeof ent === 'string' ? 1 : ent.quantity;
                    const redeemedCount = enrollment.redeemedEntitlements?.filter(r => r.name === entName).length || 0;
                    const remaining = totalQty - redeemedCount;
                    const isFullyRedeemed = remaining <= 0;

                    return (
                      <button
                        key={idx}
                        disabled={isFullyRedeemed || loading || !canEdit}
                        onClick={() => handleRedeem(entName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                          isFullyRedeemed 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed line-through' 
                            : !canEdit
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                        }`}
                      >
                        <span>{entName}</span>
                        {totalQty > 1 && (
                          <span className="px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded-md text-[10px]">
                            {redeemedCount}/{totalQty}
                          </span>
                        )}
                        {isFullyRedeemed && '✓'}
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {enrollment.isReducingBalance && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Log Treatment</h3>
                  <form onSubmit={handleLogTreatment} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Service name..."
                      value={treatmentForm.service}
                      onChange={(e) => setTreatmentForm({ ...treatmentForm, service: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={treatmentForm.amount}
                      onChange={(e) => setTreatmentForm({ ...treatmentForm, amount: e.target.value })}
                      className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button
                      type="submit"
                      disabled={loading || !canEdit}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                      Log
                    </button>
                  </form>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {enrollment.documents?.contract ? (
                      <a 
                        href={enrollment.documents.contract.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 transition-all group overflow-hidden"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0 flex items-center justify-center text-blue-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white">Invoice</div>
                            <div className="text-slate-500 truncate">{enrollment.documents.contract.name}</div>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ) : (
                      <div className="p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-center">
                        No Invoice Uploaded
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium text-slate-500 cursor-pointer hover:text-blue-600 transition-colors">
                        {uploading ? 'Uploading...' : enrollment.documents?.contract ? 'Replace Invoice' : 'Upload Invoice'}
                        <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleFileUpload(e, 'contract')} disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {enrollment.documents?.pop ? (
                      <a 
                        href={enrollment.documents.pop.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-green-500 transition-all group overflow-hidden"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex-shrink-0 flex items-center justify-center text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <div className="text-xs min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white">Proof of Payment</div>
                            <div className="text-slate-500 truncate">{enrollment.documents.pop.name}</div>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ) : (
                      <div className="p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-center">
                        No POP Uploaded
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-medium text-slate-500 cursor-pointer hover:text-green-600 transition-colors">
                        {uploading ? 'Uploading...' : enrollment.documents?.pop ? 'Replace POP' : 'Upload POP'}
                        <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => handleFileUpload(e, 'pop')} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    {linkModalOpen && <LinkInvoiceModal onSelect={handleLinkSelect} onClose={() => setLinkModalOpen(false)} />}
    {viewInvoice && <ViewInvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
    </>
  );
}
