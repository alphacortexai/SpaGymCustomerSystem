'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import EditClientModal from './EditClientModal';
import { deleteClient } from '@/lib/clients';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export default function ClientList({ clients = [], title = 'Clients', onClientUpdated }) {
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [searchQuery, setSearchQuery] = useState('');

  const generateWhatsAppLink = (phoneNumber) => {
    if (!phoneNumber) return null;
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) return null;
    let whatsappNumber = normalized.replace(/^0/, '');
    whatsappNumber = `256${whatsappNumber}`;
    return `https://wa.me/${whatsappNumber}`;
  };

  const generateCallLink = (phoneNumber) => {
    if (!phoneNumber) return null;
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) return null;
    return `tel:${normalized}`;
  };

  const getAbbreviatedBranch = (branch) => {
    if (!branch) return 'N/A';
    const words = branch.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const handleDelete = async () => {
    if (!deletingClientId) return;
    setDeleteLoading(true);
    try {
      await deleteClient(deletingClientId);
      setShowDeleteConfirm(false);
      setDeletingClientId(null);
      if (onClientUpdated) onClientUpdated();
    } catch (error) {
      console.error('Error deleting client:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => {
      const nameMatch = client.name?.toLowerCase().includes(query);
      const phoneMatch = client.phoneNumber?.toLowerCase().includes(query);
      const branchMatch = client.branch?.toLowerCase().includes(query);
      return nameMatch || phoneMatch || branchMatch;
    });
  }, [clients, searchQuery]);

  if (!clients || clients.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white">No clients found</h3>
        <p className="text-slate-500 mt-1">Try adding some clients to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filteredClients.length} records found</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search within these results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
            />
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'card' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Cards
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-slate-500">No clients match your search query.</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Clear search
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Birthday</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClients.map((client) => {
                let dobDisplay = 'N/A';
                if (client.birthMonth && client.birthDay) {
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
                }
                return (
                  <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{client.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 dark:text-slate-400 font-mono">{client.phoneNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        <svg className="w-3 h-3 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9V9a2 2 0 00-2-2M6 12V9a2 2 0 002-2h8" /></svg>
                        {dobDisplay}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="sm:hidden">{getAbbreviatedBranch(client.branch)}</span>
                        <span className="hidden sm:inline">{client.branch || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {client.phoneNumber && (
                          <>
                            <a href={generateCallLink(client.phoneNumber)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Call">
                              <Image src="/telephone.svg" alt="Call" width={24} height={24} className="w-6 h-6" />
                            </a>
                            <a href={generateWhatsAppLink(client.phoneNumber)} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all" title="WhatsApp">
                              <Image src="/whatsapp.svg" alt="WhatsApp" width={24} height={24} className="w-6 h-6" />
                            </a>
                          </>
                        )}
                        <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all" title="Edit">
                          <Image src="/edit.svg" alt="Edit" width={24} height={24} className="w-6 h-6" />
                        </button>
                        <button onClick={() => { setDeletingClientId(client.id); setShowDeleteConfirm(true); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="Delete">
                          <Image src="/bin.svg" alt="Delete" width={24} height={24} className="w-6 h-6" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => {
              let dobDisplay = 'N/A';
              if (client.birthMonth && client.birthDay) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
              }
              return (
                <div key={client.id} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{client.name}</h3>
                      <p className="text-sm text-slate-500 font-mono mt-0.5">{client.phoneNumber || 'N/A'}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingClient(client); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors">
                        <Image src="/edit.svg" alt="Edit" width={16} height={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <div className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <svg className="w-3 h-3 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9V9a2 2 0 00-2-2M6 12V9a2 2 0 002-2h8" /></svg>
                      {dobDisplay}
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      🏢 <span className="sm:hidden">{getAbbreviatedBranch(client.branch)}</span>
                      <span className="hidden sm:inline">{client.branch || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex gap-2">
                      {client.phoneNumber && (
                        <>
                          <a href={generateCallLink(client.phoneNumber)} className="w-9 h-9 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 hover:text-blue-600 rounded-xl transition-all">
                            <Image src="/telephone.svg" alt="Call" width={18} height={18} />
                          </a>
                          <a href={generateWhatsAppLink(client.phoneNumber)} target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-600 hover:text-emerald-600 rounded-xl transition-all">
                            <Image src="/whatsapp.svg" alt="WhatsApp" width={18} height={18} />
                          </a>
                        </>
                      )}
                    </div>
                    <button onClick={() => { setDeletingClientId(client.id); setShowDeleteConfirm(true); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-600 hover:text-rose-600 rounded-xl transition-all">
                      <Image src="/bin.svg" alt="Delete" width={18} height={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && editingClient && (
        <EditClientModal
          client={editingClient}
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingClient(null); }}
          onClientUpdated={onClientUpdated}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Delete Client</h3>
            <p className="text-slate-500 mt-2">Are you sure you want to delete this client? This action cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
