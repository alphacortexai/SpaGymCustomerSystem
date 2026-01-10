'use client';

import { useState, useEffect } from 'react';
import { getAllUnrecognizedClients, updateUnrecognizedClient, deleteUnrecognizedClient, approveUnrecognizedClient } from '@/lib/unrecognizedClients';
import { addClient } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';
import { format } from 'date-fns';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

export default function UnrecognizedClientsList({ onClientUpdated }) {
  const { profile } = useAuth();
  const canEdit = profile?.permissions?.clients?.edit !== false;
  const canDelete = profile?.permissions?.clients?.delete !== false;
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [unrecognizedClients, allBranches] = await Promise.all([
      getAllUnrecognizedClients(),
      getAllBranches(),
    ]);
    setClients(unrecognizedClients);
    setBranches(allBranches);
    setLoading(false);
  };

  const handleEdit = (client) => {
    setEditingId(client.id);
    setEditForm({
      name: client.name || '',
      phoneNumber: client.phoneNumber || '',
      birthMonth: client.birthMonth || '',
      birthDay: client.birthDay || '',
      branch: client.branch || '',
    });
    setError('');
    setSuccess('');
  };

  const handleSave = async (clientId) => {
    setError('');
    setSuccess('');
    
    if (!editForm.name.trim()) {
      setError('Client name is required');
      return;
    }
    
    if (!editForm.phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }
    
    if (!editForm.branch.trim()) {
      setError('Branch is required');
      return;
    }

    const result = await updateUnrecognizedClient(clientId, editForm);
    if (result.success) {
      setSuccess('Client updated successfully!');
      setEditingId(null);
      await loadData();
      if (onClientUpdated) {
        onClientUpdated();
      }
    } else {
      setError(result.error || 'Failed to update client');
    }
  };

  const handleApprove = async (client) => {
    if (!confirm(`Approve this client and add to regular clients?`)) {
      return;
    }

    setError('');
    setSuccess('');

    // Check if branch is set
    if (!client.branch || !client.branch.trim()) {
      setError('Please set a branch before approving this client.');
      return;
    }

    const result = await approveUnrecognizedClient(client.id, async (clientData) => {
      return await addClient(clientData);
    });

    if (result.success) {
      setSuccess('Client approved and added to regular clients!');
      await loadData();
      if (onClientUpdated) {
        onClientUpdated();
      }
    } else {
      setError(result.error || 'Failed to approve client');
    }
  };

  const handleDelete = async (clientId) => {
    if (!confirm('Are you sure you want to delete this unrecognized client?')) {
      return;
    }

    const result = await deleteUnrecognizedClient(clientId);
    if (result.success) {
      setSuccess('Client deleted successfully!');
      await loadData();
    } else {
      setError(result.error || 'Failed to delete client');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Loading unrecognized clients...</h3>
          <p className="text-slate-500 mt-1">Please wait while we fetch the records.</p>
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Unrecognised Uploaded Client Data</h2>
        <p className="text-slate-500">No unrecognized clients found. All client data is valid!</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
        Unrecognised Uploaded Client Data ({clients.length})
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        These clients have phone numbers that couldn't be recognized. Please review and fix them before approving.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {/* Mobile: Card View */}
      <div className="md:hidden space-y-4">
        {clients.map((client) => {
          let dobDisplay = 'N/A';
          if (client.birthMonth && client.birthDay) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
          }

          const isEditing = editingId === client.id;

          return (
            <div key={client.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-600">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Phone Number</label>
                    <input
                      type="tel"
                      value={editForm.phoneNumber}
                      onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded mt-1 font-mono"
                      placeholder="e.g., 0776961331"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Date of Birth (Optional)</label>
                    <div className="flex gap-2 mt-1">
                      <select
                        value={editForm.birthMonth}
                        onChange={(e) => setEditForm({ ...editForm, birthMonth: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded"
                      >
                        <option value="">Month</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.birthDay}
                        onChange={(e) => setEditForm({ ...editForm, birthDay: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Branch</label>
                    <select
                      value={editForm.branch}
                      onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded mt-1"
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSave(client.id)}
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white/70 backdrop-blur-md text-gray-800 hover:bg-white/90 hover:border-gray-300 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditForm({});
                        setError('');
                        setSuccess('');
                      }}
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white/70 backdrop-blur-md text-gray-800 hover:bg-white/90 hover:border-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-600 font-mono mt-1">{client.phoneNumber}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Image src="/cake.svg" alt="Birthday" width={16} height={16} />
                      {dobDisplay}
                    </span>
                    <span>🏢 {client.branch || 'N/A'}</span>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    {client.reason || 'Unrecognized phone number'}
                  </div>
	                  <div className="flex gap-2 pt-2 border-t border-gray-100">
	                    {canEdit && (
	                      <>
	                        <button
	                          onClick={() => handleEdit(client)}
	                          className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white/70 backdrop-blur-md text-gray-800 hover:bg-white/90 hover:border-gray-300 transition-colors"
	                        >
	                          <span className="inline-flex items-center justify-center gap-2">
	                            <Image src="/edit.svg" alt="Edit" width={18} height={18} />
	                            Edit
	                          </span>
	                        </button>
	                        <button
	                          onClick={() => handleApprove(client)}
	                          disabled={!client.branch || !client.branch.trim()}
	                          className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 bg-white/70 backdrop-blur-md text-green-700 hover:bg-white/90 hover:border-gray-300 transition-colors disabled:text-gray-400 disabled:bg-white/70 disabled:cursor-not-allowed"
	                        >
	                          Approve
	                        </button>
	                      </>
	                    )}
	                    {canDelete && (
	                      <button
	                        onClick={() => handleDelete(client.id)}
	                        className="px-3 py-2 text-sm rounded-md border border-gray-200 bg-white/70 backdrop-blur-md text-red-700 hover:bg-white/90 hover:border-gray-300 transition-colors"
	                      >
	                        <span className="inline-flex items-center justify-center">
	                          <Image src="/bin.svg" alt="Delete" width={18} height={18} />
	                        </span>
	                      </button>
	                    )}
	                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date of Birth</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.map((client) => {
              let dobDisplay = 'N/A';
              if (client.birthMonth && client.birthDay) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
              }

              const isEditing = editingId === client.id;

              return (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{client.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.phoneNumber}
                        onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="e.g., 0776961331"
                      />
                    ) : (
                      <span className="text-gray-500 font-mono">{client.phoneNumber}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select
                          value={editForm.birthMonth}
                          onChange={(e) => setEditForm({ ...editForm, birthMonth: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="">Month</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={editForm.birthDay}
                          onChange={(e) => setEditForm({ ...editForm, birthDay: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-gray-500">{dobDisplay}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <select
                        value={editForm.branch}
                        onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Select branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.name}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-500">{client.branch || 'N/A'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="text-xs">{client.reason || 'Unrecognized phone number'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(client.id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditForm({});
                            setError('');
                            setSuccess('');
                          }}
                          className="text-gray-600 hover:text-gray-800 font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
	                      <div className="flex gap-3">
	                        {canEdit && (
	                          <>
	                            <button
	                              onClick={() => handleEdit(client)}
	                              className="text-blue-600 hover:text-blue-800 font-medium p-2 rounded hover:bg-blue-50"
	                              title="Edit client"
	                              aria-label="Edit client"
	                            >
	                              <Image src="/edit.svg" alt="Edit" width={18} height={18} />
	                            </button>
	                            <button
	                              onClick={() => handleApprove(client)}
	                              disabled={!client.branch || !client.branch.trim()}
	                              className="text-green-600 hover:text-green-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
	                              title={!client.branch ? 'Set a branch first' : 'Approve and add to regular clients'}
	                            >
	                              Approve
	                            </button>
	                          </>
	                        )}
	                        {canDelete && (
	                          <button
	                            onClick={() => handleDelete(client.id)}
	                            className="text-red-600 hover:text-red-800 font-medium p-2 rounded hover:bg-red-50"
	                            title="Delete client"
	                            aria-label="Delete client"
	                          >
	                            <Image src="/bin.svg" alt="Delete" width={18} height={18} />
	                          </button>
	                        )}
	                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

