'use client';

import { useState } from 'react';
import { addMembershipType } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';

export default function MembershipForm({ onMembershipAdded }) {
  const { user, profile } = useAuth();
  const canAdd = profile?.permissions?.gym?.add !== false;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    price: '',
    description: '',
    duration: '',
    entitlements: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await addMembershipType({
      ...formData,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      entitlements: formData.entitlements.split(',').map(e => e.trim()).filter(e => e),
    }, user);

    if (result.success) {
      setFormData({ type: '', price: '', description: '', duration: '', entitlements: '' });
      if (onMembershipAdded) onMembershipAdded();
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Create Membership Type</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Membership Type</label>
          <input
            type="text"
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="e.g. Gold Monthly"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Price</label>
          <input
            type="number"
            required
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Duration (Days)</label>
          <input
            type="number"
            required
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Entitlements (comma separated)</label>
          <input
            type="text"
            value={formData.entitlements}
            onChange={(e) => setFormData({ ...formData, entitlements: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Gym, Pool, Sauna"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          rows="3"
          placeholder="Describe the membership..."
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={loading || !canAdd}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
      >
        {loading ? 'Creating...' : !canAdd ? 'No Permission to Add' : 'Create Membership Type'}
      </button>
    </form>
  );
}
