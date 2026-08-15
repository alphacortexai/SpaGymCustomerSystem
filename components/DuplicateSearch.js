'use client';

import { useState, useEffect, useMemo } from 'react';
import { getAllClients, deleteClient } from '@/lib/clients';
import { extractAllPhoneNumbers } from '@/lib/phoneUtils';
import EditClientModal from './EditClientModal';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/LoadingState';

export default function DuplicateSearch() {
  const { user, profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canEdit = profile?.permissions?.clients?.edit !== false;
  const canDelete = profile?.permissions?.clients?.delete !== false;

  const loadClients = async () => {
    setLoading(true);
    try {
      const allClients = await getAllClients();
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const duplicates = useMemo(() => {
    const phoneMap = new Map();
    const duplicateGroups = [];

    clients.forEach(client => {
      const phoneNumbers = extractAllPhoneNumbers(client.phoneNumber);
      phoneNumbers.forEach(phone => {
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, []);
        }
        phoneMap.get(phone).push(client);
      });
    });

    phoneMap.forEach((group, phone) => {
      if (group.length > 1) {
        // Remove duplicate client objects in the same group (if a client has multiple phone numbers that are both duplicates)
        const uniqueGroup = Array.from(new Map(group.map(c => [c.id, c])).values());
        if (uniqueGroup.length > 1) {
          duplicateGroups.push({
            phone,
            clients: uniqueGroup
          });
        }
      }
    });

    return duplicateGroups;
  }, [clients]);

  const handleDelete = async () => {
    if (!deletingClientId) return;
    setDeleteLoading(true);
    try {
      await deleteClient(deletingClientId, user);
      setShowDeleteConfirm(false);
      setDeletingClientId(null);
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <LoadingState title="Searching for duplicates" description="Checking client records for matching phone numbers." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Duplicate Phone Numbers</h2>
          <p className="text-slate-500 mt-1">Found {duplicates.length} groups of duplicates</p>
        </div>
        <button 
          onClick={loadClients}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          Refresh
        </button>
      </div>

      {duplicates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No duplicates found</h3>
          <p className="text-slate-500 mt-1">All phone numbers in your database are unique.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicates.map((group, index) => (
            <div key={index} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Phone: {group.phone}</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold rounded-full">
                  {group.clients.length} DUPLICATES
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Client Name</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Branch</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Created At</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {group.clients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900 dark:text-white">{client.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{client.phoneNumber}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {client.branch || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {client.createdAt?.toDate ? client.createdAt.toDate().toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingClient(client);
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                title="Edit"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => {
                                  setDeletingClientId(client.id);
                                  setShowDeleteConfirm(true);
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && editingClient && (
        <EditClientModal
          client={editingClient}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingClient(null);
          }}
          onClientUpdated={() => {
            setIsModalOpen(false);
            setEditingClient(null);
            loadClients();
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Client?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              This action cannot be undone. This will permanently delete the client and update all associated records.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center"
              >
                {deleteLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
