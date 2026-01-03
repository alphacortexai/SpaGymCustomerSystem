'use client';

import { useState, useEffect } from 'react';
import { addClient, checkDuplicatePhone } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';
import { normalizePhoneNumberWithAll, extractAllPhoneNumbers } from '@/lib/phoneUtils';

export default function ClientForm({ onClientAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    birthMonth: '',
    birthDay: '',
    branch: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const branchList = await getAllBranches();
    setBranches(branchList);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
    setDuplicateWarning(false);
  };

  const handlePhoneBlur = async () => {
    if (formData.phoneNumber.trim()) {
      const phoneData = normalizePhoneNumberWithAll(formData.phoneNumber);
      if (phoneData.hasUnrecognized) {
        setError(`Warning: Some phone numbers could not be recognized: ${phoneData.invalidPhoneNumbers.join(', ')}.`);
      } else {
        setError('');
      }
      
      const exists = await checkDuplicatePhone(formData.phoneNumber, formData.branch);
      if (exists) {
        setDuplicateWarning(true);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.name.trim() || !formData.phoneNumber.trim() || !formData.birthMonth || !formData.birthDay || !formData.branch.trim()) {
      setError('All fields marked with * are required');
      setLoading(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const month = parseInt(formData.birthMonth);
    const day = parseInt(formData.birthDay);
    const date = new Date(currentYear, month - 1, day);
    
    if (date.getMonth() !== month - 1 || date.getDate() !== day) {
      setError('Invalid date. Please check month and day.');
      setLoading(false);
      return;
    }

    const dateOfBirth = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const phoneData = normalizePhoneNumberWithAll(formData.phoneNumber);
    const exists = await checkDuplicatePhone(formData.phoneNumber, formData.branch);
    
    if (exists) {
      setError('A client with this phone number already exists in this branch.');
      setLoading(false);
      return;
    }
    
    if (phoneData.hasUnrecognized && phoneData.validNumbers.length === 0) {
      setError('No valid phone numbers found.');
      setLoading(false);
      return;
    }

    try {
      const result = await addClient({
        ...formData,
        phoneNumber: formData.phoneNumber,
        dateOfBirth,
        birthMonth: month,
        birthDay: day,
      });
      
      if (result.success) {
        setSuccess('Client added successfully!');
        setFormData({ name: '', phoneNumber: '', birthMonth: '', birthDay: '', branch: '' });
        setDuplicateWarning(false);
        if (onClientAdded) onClientAdded();
      } else {
        setError(result.error || 'Failed to add client');
      }
    } catch (err) {
      setError('An error occurred while adding the client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Client</h2>
        <p className="text-sm text-slate-500 mt-1">Register a new customer to the system.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">Client Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phoneNumber" className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number *</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                onBlur={handlePhoneBlur}
                required
                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border ${duplicateWarning ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'} rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all`}
                placeholder="07..."
              />
              {duplicateWarning && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Already exists in this branch
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date of Birth *</label>
            <div className="grid grid-cols-2 gap-4">
              <select
                name="birthMonth"
                value={formData.birthMonth}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Month</option>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                name="birthDay"
                value={formData.birthDay}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branch" className="text-sm font-medium text-slate-700 dark:text-slate-300">Branch *</label>
            {branches.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">
                No branches available. Please create a branch first.
              </div>
            ) : (
              <select
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Select a branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.name}>{branch.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Processing...
            </>
          ) : 'Add Client'}
        </button>
      </form>
    </div>
  );
}
