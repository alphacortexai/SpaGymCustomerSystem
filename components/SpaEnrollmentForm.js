'use client';

import { useState, useEffect } from 'react';
import { getMembershipTypes, enrollClient } from '@/lib/memberships';
import { useAuth } from '@/contexts/AuthContext';
import { searchClients } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';

export default function SpaEnrollmentForm({ onEnrolled }) {
  const { user, profile } = useAuth();
  const canAdd = profile?.permissions?.spa?.add !== false;
  const [loading, setLoading] = useState(false);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState({
    membershipTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    price: '',
    branch: '',
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [popFile, setPopFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const [types, allBranches] = await Promise.all([
        getMembershipTypes(true),
        getAllBranches()
      ]);
      setMembershipTypes(types);
      setBranches(allBranches);
    };
    loadInitialData();
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

  const uploadDocument = async (file, type, clientId) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('clientId', clientId);

    const response = await fetch('/api/upload-doc', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return { url: result.url, name: result.name, type: result.type };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !formData.membershipTypeId || !formData.branch) return;

    setLoading(true);
    setUploading(true);
    
    try {
      const invoiceDoc = await uploadDocument(invoiceFile, 'invoice', selectedClient.id);
      const popDoc = await uploadDocument(popFile, 'pop', selectedClient.id);
      
      const selectedType = membershipTypes.find(t => t.id === formData.membershipTypeId);
      const isReducingBalance = selectedType.isReducingBalance || false;
      const enrollmentPrice = isReducingBalance ? formData.price : selectedType.price;
      
      const result = await enrollClient({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        membershipTypeId: formData.membershipTypeId,
        membershipType: selectedType.type,
        price: enrollmentPrice,
        description: selectedType.description,
        durationDays: selectedType.duration,
        entitlements: selectedType.entitlements,
        isReducingBalance: isReducingBalance,
        balance: isReducingBalance ? enrollmentPrice : 0,
        startDate: formData.startDate,
        branch: formData.branch,
        documents: {
          invoice: invoiceDoc,
          pop: popDoc
        }
      }, user, true);

      if (result.success) {
        setSelectedClient(null);
        setSearchTerm('');
        setFormData({ ...formData, membershipTypeId: '', price: '', branch: '' });
        setInvoiceFile(null);
        setPopFile(null);
        if (onEnrolled) onEnrolled();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      alert('Upload Error: ' + error.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Enroll Spa Client</h2>
      
      <div className="relative">
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search Client</label>
        <input
          type="text"
          value={selectedClient ? selectedClient.name : searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (selectedClient) setSelectedClient(null);
          }}
          className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Branch</label>
          <select
            required
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">Select Branch</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.name}>{branch.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Membership Type</label>
          <select
            required
            value={formData.membershipTypeId}
            onChange={(e) => {
              const type = membershipTypes.find(t => t.id === e.target.value);
              setFormData({ 
                ...formData, 
                membershipTypeId: e.target.value,
                price: type?.isReducingBalance ? '' : (type?.price || '')
              });
            }}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            <option value="">Select Type</option>
            {membershipTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.type} {type.isReducingBalance ? '(Reducing Balance)' : `- $${type.price}`}
              </option>
            ))}
          </select>
        </div>

        {membershipTypes.find(t => t.id === formData.membershipTypeId)?.isReducingBalance && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Enrollment Price (Balance)</label>
            <input
              type="number"
              required
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Enter balance amount"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
          <input
            type="date"
            required
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="md:col-span-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Documents (Optional)</h3>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Client Invoice (PDF/Image)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setInvoiceFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Proof of Payment (PDF/Image)</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setPopFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !selectedClient || !formData.membershipTypeId || !formData.branch || !canAdd}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
      >
        {uploading ? 'Uploading Documents...' : loading ? 'Enrolling...' : !canAdd ? 'No Permission to Enroll' : 'Enroll Spa Client'}
      </button>
    </form>
  );
}
