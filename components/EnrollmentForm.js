'use client';

import { useState, useEffect } from 'react';
import { getMembershipTypes, enrollClient } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';
import { searchClients } from '@/lib/clients';

export default function EnrollmentForm({ onEnrolled }) {
  const { user, profile } = useAuth();
  const canAdd = profile?.permissions?.gym?.add !== false;
  const [loading, setLoading] = useState(false);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({
    membershipTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const loadTypes = async () => {
      const types = await getMembershipTypes();
      setMembershipTypes(types);
    };
    loadTypes();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 2) {
        const results = await searchClients(searchTerm);
        setClients(results);
      } else {
        setClients([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !formData.membershipTypeId) return;

    setLoading(true);
    const selectedType = membershipTypes.find(t => t.id === formData.membershipTypeId);
    
    const result = await enrollClient({
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      membershipTypeId: formData.membershipTypeId,
      membershipType: selectedType.type,
      price: selectedType.price,
      description: selectedType.description,
      durationDays: selectedType.duration,
      entitlements: selectedType.entitlements,
      startDate: formData.startDate,
    }, user);

    if (result.success) {
      setSelectedClient(null);
      setSearchTerm('');
      setFormData({ ...formData, membershipTypeId: '' });
      if (onEnrolled) onEnrolled();
    } else {
      alert('Error: ' + result.error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Enroll Client</h2>
      
      <div className="relative">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Client</label>
        <input
          type="text"
          value={selectedClient ? selectedClient.name : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (selectedClient) setSelectedClient(null);
          }}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          placeholder="Search by name or phone..."
          readOnly={!!selectedClient}
        />
        {selectedClient && (
          <button 
            type="button"
            onClick={() => setSelectedClient(null)}
            className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
        
        {!selectedClient && clients.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {clients.map(client => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  setSelectedClient(client);
                  setClients([]);
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="font-medium">{client.name}</div>
                <div className="text-xs text-slate-500">{client.phoneNumber}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Membership Type</label>
          <select
            required
            value={formData.membershipTypeId}
            onChange={(e) => setFormData({ ...formData, membershipTypeId: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="">Select Type</option>
            {membershipTypes.map(type => (
              <option key={type.id} value={type.id}>{type.type} - ${type.price}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            required
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !selectedClient || !formData.membershipTypeId || !canAdd}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
      >
        {loading ? 'Enrolling...' : !canAdd ? 'No Permission to Enroll' : 'Enroll Client'}
      </button>
    </form>
  );
}
