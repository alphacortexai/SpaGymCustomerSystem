'use client';

import { useState, useEffect } from 'react';
import { getMembershipTypes, updateMembershipType, deleteMembershipType } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';

export default function MembershipTypeManager() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'Admin';
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    type: '',
    price: '',
    duration: '',
    description: '',
    isReducingBalance: false,
    entitlements: ''
  });

  const loadTypes = async () => {
    setLoading(true);
    const data = await getMembershipTypes();
    setTypes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTypes();
  }, []);

  const handleEdit = (type) => {
    setEditingId(type.id);
    setEditForm({
      type: type.type,
      price: type.price,
      duration: type.duration,
      description: type.description || '',
      isReducingBalance: type.isReducingBalance || false,
      entitlements: Array.isArray(type.entitlements) 
        ? type.entitlements.map(e => `${e.name}${e.quantity > 1 ? ` x${e.quantity}` : ''}`).join(', ')
        : type.entitlements || ''
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return alert('Only admins can edit membership types.');

    setLoading(true);
    const formattedEntitlements = editForm.isReducingBalance ? [] : editForm.entitlements.split(',').map(e => {
      const item = e.trim();
      if (!item) return null;
      const match = item.match(/(.+)\s+x(\d+)$/i);
      if (match) return { name: match[1].trim(), quantity: parseInt(match[2]) };
      return { name: item, quantity: 1 };
    }).filter(e => e);

    const result = await updateMembershipType(editingId, {
      ...editForm,
      price: parseFloat(editForm.price),
      duration: parseInt(editForm.duration),
      entitlements: formattedEntitlements
    }, user);

    if (result.success) {
      setEditingId(null);
      loadTypes();
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!isAdmin) return alert('Only admins can delete membership types.');
    if (!confirm(`Are you sure you want to delete "${name}"? This will not affect existing enrollments but new clients cannot use this type.`)) return;

    setLoading(true);
    const result = await deleteMembershipType(id, user);
    if (result.success) {
      loadTypes();
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(false);
  };

  if (loading && types.length === 0) return <div className="text-center py-10">Loading types...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Membership Types</h2>
        <button onClick={loadTypes} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      <div className="grid gap-4">
        {types.map((type) => (
          <div key={type.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {editingId === type.id ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Type Name</label>
                    <input
                      type="text"
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Price {editForm.isReducingBalance && '(Default)'}</label>
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      value={editForm.duration}
                      onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Entitlements</label>
                    <input
                      type="text"
                      disabled={editForm.isReducingBalance}
                      value={editForm.isReducingBalance ? 'N/A (Reducing Balance)' : editForm.entitlements}
                      onChange={(e) => setEditForm({ ...editForm, entitlements: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{type.type}</h3>
                    {type.isReducingBalance && (
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-bold rounded-md uppercase">Reducing Balance</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mb-4">{type.description || 'No description provided.'}</p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex flex-col">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Price</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">${type.price}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">Duration</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{type.duration} Days</span>
                    </div>
                    {!type.isReducingBalance && (
                      <div className="flex flex-col">
                        <span className="text-slate-400 uppercase font-bold text-[10px]">Entitlements</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {Array.isArray(type.entitlements) 
                            ? type.entitlements.map(e => `${e.name}${e.quantity > 1 ? ` x${e.quantity}` : ''}`).join(', ')
                            : 'None'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(type)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                      title="Edit Type"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => handleDelete(type.id, type.type)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      title="Delete Type"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
