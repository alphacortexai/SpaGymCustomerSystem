'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import EditClientModal from './EditClientModal';
import { deleteClient } from '@/lib/clients';

export default function ClientList({ clients, title = 'Clients', onClientUpdated }) {
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  if (!clients || clients.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
        <p className="text-gray-500">No clients found</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title} ({clients.length})</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date of Birth
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Branch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.map((client) => {
              // Display date of birth (month and day only)
              let dobDisplay = 'N/A';
              
              if (client.birthMonth && client.birthDay) {
                // Use stored month and day
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
              } else if (client.dateOfBirth) {
                // Fallback to dateOfBirth if month/day not stored
                const dob = new Date(client.dateOfBirth);
                dobDisplay = format(dob, 'MMM dd');
              }
              
              return (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.phoneNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dobDisplay}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.branch || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingClient(client);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeletingClientId(client.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <EditClientModal
        client={editingClient}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingClient(null);
        }}
        onClientUpdated={() => {
          if (onClientUpdated) {
            onClientUpdated();
          }
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this client? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingClientId(null);
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setDeleteLoading(true);
                    const result = await deleteClient(deletingClientId);
                    setDeleteLoading(false);
                    if (result.success) {
                      setShowDeleteConfirm(false);
                      setDeletingClientId(null);
                      if (onClientUpdated) {
                        onClientUpdated();
                      }
                    } else {
                      alert('Failed to delete client: ' + (result.error || 'Unknown error'));
                    }
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

