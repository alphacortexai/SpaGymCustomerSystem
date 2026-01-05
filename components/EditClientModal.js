'use client';

import { useState, useEffect } from 'react';
import { updateClient, checkDuplicatePhone } from '@/lib/clients';
import { useAuth } from '@/contexts/AuthContext';
import { getAllBranches } from '@/lib/branches';
import { normalizePhoneNumber, extractAllPhoneNumbers } from '@/lib/phoneUtils';

export default function EditClientModal({ client, isOpen, onClose, onClientUpdated }) {
  const { profile } = useAuth();
  const isGeneralUser = profile?.role === 'General';
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
    if (isOpen && client) {
      // Populate form with client data
      setFormData({
        name: client.name || '',
        phoneNumber: client.phoneNumber || '',
        birthMonth: client.birthMonth || '',
        birthDay: client.birthDay || '',
        branch: client.branch || '',
      });
      setError('');
      setSuccess('');
      setDuplicateWarning(false);
    }
    loadBranches();
  }, [isOpen, client]);

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
    if (formData.phoneNumber.trim() && formData.phoneNumber !== client.phoneNumber) {
      // Normalize phone number for duplicate check
      const normalized = normalizePhoneNumber(formData.phoneNumber);
      // Update the form with normalized value so user sees what will be stored
      if (normalized !== formData.phoneNumber) {
        setFormData((prev) => ({ ...prev, phoneNumber: normalized }));
      }
      // Check for duplicates using the original input (checkDuplicatePhone handles normalization)
      const exists = await checkDuplicatePhone(formData.phoneNumber, formData.branch, client.id);
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

    // Validation
    if (!formData.name.trim()) {
      setError('Client name is required');
      setLoading(false);
      return;
    }

    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required');
      setLoading(false);
      return;
    }

    if (!formData.birthMonth || !formData.birthDay) {
      setError('Date of birth (month and day) is required');
      setLoading(false);
      return;
    }

    // Normalize phone number before checking duplicates and storing
    const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);

    // Check for duplicate phone number (excluding current client)
    // This checks ALL numbers if multiple are provided (e.g., "0776961331/ 0758583813")
    if (formData.phoneNumber !== client.phoneNumber || formData.branch !== client.branch) {
      const exists = await checkDuplicatePhone(formData.phoneNumber, formData.branch, client.id);
      if (exists) {
        const allNumbers = extractAllPhoneNumbers(formData.phoneNumber);
        if (allNumbers.length > 1) {
          setError(`One or more of these phone numbers already exist in the same branch: ${allNumbers.join(', ')}. Please use different phone numbers.`);
        } else {
          setError('A client with this phone number already exists in the same branch. Please use a different phone number.');
        }
        setLoading(false);
        return;
      }
    }

    // Convert month/day to a date string (using current year for storage)
    const currentYear = new Date().getFullYear();
    const month = parseInt(formData.birthMonth);
    const day = parseInt(formData.birthDay);
    
    // Validate date
    const date = new Date(currentYear, month - 1, day);
    if (date.getMonth() !== month - 1 || date.getDate() !== day) {
      setError('Invalid date. Please check month and day.');
      setLoading(false);
      return;
    }

    try {
      const result = await updateClient(client.id, {
        name: formData.name,
        phoneNumber: normalizedPhone, // Use normalized phone number
        birthMonth: month,
        birthDay: day,
      });
      
      if (result.success) {
        setSuccess('Client updated successfully!');
        setTimeout(() => {
          if (onClientUpdated) {
            onClientUpdated();
          }
          onClose();
        }, 1000);
      } else {
        setError(result.error || 'Failed to update client');
      }
    } catch (err) {
      setError('An error occurred while updating the client');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Edit Client</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                Client Name *
              </label>
              <input
                type="text"
                id="edit-name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter client name"
              />
            </div>

            <div>
              <label htmlFor="edit-phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                id="edit-phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                onBlur={handlePhoneBlur}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
              {duplicateWarning && (
                <p className="mt-1 text-sm text-yellow-600">
                  ⚠️ A client with this phone number already exists
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth (Month & Day) *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-birthMonth" className="block text-xs text-gray-600 mb-1">
                    Month
                  </label>
                  <select
                    id="edit-birthMonth"
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Month</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-birthDay" className="block text-xs text-gray-600 mb-1">
                    Day
                  </label>
                  <select
                    id="edit-birthDay"
                    name="birthDay"
                    value={formData.birthDay}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="edit-branch" className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                id="edit-branch"
                name="branch"
                value={formData.branch}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500">
                Branch cannot be changed after client creation
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
	              {!isGeneralUser && (
	                <button
	                  type="submit"
	                  disabled={loading}
	                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
	                >
	                  {loading ? 'Updating...' : 'Update Client'}
	                </button>
	              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


