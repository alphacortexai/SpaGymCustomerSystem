'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import EditClientModal from './EditClientModal';
import { deleteClient } from '@/lib/clients';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export default function ClientList({ clients, title = 'Clients', onClientUpdated }) {
  // Helper function to generate WhatsApp link
  const generateWhatsAppLink = (phoneNumber) => {
    if (!phoneNumber) return null;

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) return null;

    // Remove leading 0 and add country code for Kenya (254)
    // Example: 0782830524 -> 254782830524
    let whatsappNumber = normalized.replace(/^0/, '');
    whatsappNumber = `254${whatsappNumber}`;

    return `https://wa.me/${whatsappNumber}`;
  };

  // Helper function to generate call link
  const generateCallLink = (phoneNumber) => {
    if (!phoneNumber) return null;

    const normalized = normalizePhoneNumber(phoneNumber);
    if (!normalized) return null;

    return `tel:${normalized}`;
  };
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  if (!clients || clients.length === 0) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        {title && <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">{title}</h2>}
        <p className="text-gray-500">No clients found</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        {title ? (
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{title} ({clients.length})</h2>
        ) : (
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Clients ({clients.length})</h2>
        )}
        {/* View Toggle */}
        <div className="flex gap-2 border border-gray-300 rounded-md p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Table View"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              viewMode === 'card'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Card View"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Card View */}
      {viewMode === 'card' && (
        <div className="space-y-4">
        {clients.map((client) => {
          let dobDisplay = 'N/A';
          
          if (client.birthMonth && client.birthDay) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            dobDisplay = `${monthNames[client.birthMonth - 1]} ${String(client.birthDay).padStart(2, '0')}`;
          } else if (client.dateOfBirth) {
            const dob = new Date(client.dateOfBirth);
            dobDisplay = format(dob, 'MMM dd');
          }
          
          return (
            <div key={client.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{client.name}</h3>
                  <p className="text-sm text-gray-600 font-mono">{client.phoneNumber || 'N/A'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                <span>📅 {dobDisplay}</span>
                <span>🏢 {client.branch || 'N/A'}</span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {client.phoneNumber && (
                  <>
                    <a
                      href={generateCallLink(client.phoneNumber)}
                      className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 text-center"
                      title="Call client"
                    >
                      📞 Call
                    </a>
                    <a
                      href={generateWhatsAppLink(client.phoneNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 text-center"
                      title="WhatsApp client"
                    >
                      💬 WhatsApp
                    </a>
                  </>
                )}
                <button
                  onClick={() => {
                    setEditingClient(client);
                    setIsModalOpen(true);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeletingClientId(client.id);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
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
                    {client.phoneNumber ? (
                      <span className="font-mono">{client.phoneNumber}</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dobDisplay}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.branch || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex gap-2">
                      {client.phoneNumber && (
                        <>
                          <a
                            href={generateCallLink(client.phoneNumber)}
                            className="text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                            title="Call client"
                          >
                            📞
                          </a>
                          <a
                            href={generateWhatsAppLink(client.phoneNumber)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 hover:text-green-600 font-medium px-2 py-1 rounded hover:bg-green-50"
                            title="WhatsApp client"
                          >
                            💬
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setEditingClient(client);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setDeletingClientId(client.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
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
      )}
      
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

