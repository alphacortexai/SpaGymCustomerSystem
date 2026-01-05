'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { redeemEntitlement, getAccessLogs, logAccess } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';

export default function MembershipDetailsModal({ enrollment, onClose, onUpdate }) {
  const { profile } = useAuth();
  const isGeneralUser = profile?.role === 'General';
  const [accessLogs, setAccessLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      const logs = await getAccessLogs(enrollment.clientId, new Date().getFullYear());
      setAccessLogs(logs);
    };
    loadLogs();
  }, [enrollment.clientId]);

  const handleRedeem = async (entitlement) => {
    if (confirm(`Redeem "${entitlement}"?`)) {
      setLoading(true);
      await redeemEntitlement(enrollment.id, entitlement);
      onUpdate();
      setLoading(false);
    }
  };

  const handleLogAccess = async () => {
    setLoading(true);
    await logAccess(enrollment.clientId, enrollment.id);
    const logs = await getAccessLogs(enrollment.clientId, new Date().getFullYear());
    setAccessLogs(logs);
    setLoading(false);
  };

  // Enhanced calendar view logic
  const renderCalendar = () => {
    const days = [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const accessed = accessLogs.includes(dateStr);
      const isToday = i === today.getDate();
      
      days.push(
        <div 
          key={i} 
          className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs border transition-all ${
            accessed 
              ? 'bg-green-500 text-white border-green-600 shadow-sm' 
              : isToday
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 font-bold'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
          }`}
          title={dateStr}
        >
          {i}
        </div>
      );
    }
    return days;
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
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Entitlements</h3>
            <div className="flex flex-wrap gap-2">
              {enrollment.entitlements?.map((ent, idx) => {
                const isRedeemed = enrollment.redeemedEntitlements?.some(r => r.name === ent);
                return (
	                  <button
	                    key={idx}
	                    disabled={isRedeemed || loading || isGeneralUser}
	                    onClick={() => handleRedeem(ent)}
	                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
	                      isRedeemed 
	                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed line-through' 
	                        : isGeneralUser
	                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
	                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
	                    }`}
	                  >
	                    {ent} {isRedeemed && '✓'}
	                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Access Calendar ({format(new Date(), 'MMMM yyyy')})</h3>
	              {!isGeneralUser && (
	                <button 
	                  onClick={handleLogAccess}
	                  disabled={loading}
	                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
	                >
	                  Log Today&apos;s Access
	                </button>
	              )}
            </div>
            <div className="grid grid-cols-7 gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              {renderCalendar()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
