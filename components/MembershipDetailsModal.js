'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { redeemEntitlement, getAccessLogs, logAccess, cancelEnrollment, deleteEnrollment, logTreatment, updateEnrollmentDocuments } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';

export default function MembershipDetailsModal({ enrollment, onClose, onUpdate, isSpa = false }) {
  const { profile } = useAuth();
  const canEdit = isSpa ? profile?.permissions?.spa?.edit !== false : profile?.permissions?.gym?.edit !== false;
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ service: '', amount: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      const logs = await getAccessLogs(enrollment.clientId, new Date().getFullYear(), isSpa);
      setAccessLogs(logs);
    };
    loadLogs();
  }, [enrollment.clientId]);

  const handleRedeem = async (entitlementName) => {
    if (confirm(`Redeem "${entitlementName}"?`)) {
      setLoading(true);
      await redeemEntitlement(enrollment.id, entitlementName, isSpa);
      onUpdate();
      setLoading(false);
    }
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
      alert('Error: ' + result.error);
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this membership?')) {
      setLoading(true);
      const result = await cancelEnrollment(enrollment.id, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        alert('Error: ' + result.error);
      }
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to PERMANENTLY DELETE this membership record? This cannot be undone.')) {
      setLoading(true);
      const result = await deleteEnrollment(enrollment.id, profile ? { uid: profile.uid, displayName: profile.name, email: profile.email } : null, isSpa);
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        alert('Error: ' + result.error);
      }
      setLoading(false);
    }
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
        alert('Upload Error: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Membership Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
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
              <div className="font-bold text-blue-600">${enrollment.price}</div>
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
                <div className="text-2xl font-black text-blue-600">${enrollment.balance?.toLocaleString() || 0}</div>
              </div>
            )}
          </div>

          {profile?.role === 'Admin' && (
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
                // Handle both old string format and new object format
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
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">Contract</div>
                        <div className="text-slate-500 truncate max-w-[120px]">{enrollment.documents.contract.name}</div>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                ) : (
                  <div className="p-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center justify-center">
                    No Contract Uploaded
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-medium text-slate-500 cursor-pointer hover:text-blue-600 transition-colors">
                    {uploading ? 'Uploading...' : enrollment.documents?.contract ? 'Replace Contract' : 'Upload Contract'}
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
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-green-500 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">Proof of Payment</div>
                        <div className="text-slate-500 truncate max-w-[120px]">{enrollment.documents.pop.name}</div>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
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
        </div>
      </div>
    </div>
  );
}
