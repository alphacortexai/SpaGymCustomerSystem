'use client';

import { useState, useEffect } from 'react';
import { addClient, checkDuplicatePhone } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';

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

    if (!formData.branch.trim()) {
      setError('Branch is required');
      setLoading(false);
      return;
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

    // Format as YYYY-MM-DD for storage (using current year)
    const dateOfBirth = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // Check for duplicate phone number before submitting
    const exists = await checkDuplicatePhone(formData.phoneNumber, formData.branch);
    if (exists) {
      setError('A client with this phone number already exists in the same branch. Please use a different phone number.');
      setLoading(false);
      return;
    }

    try {
      const result = await addClient({
        ...formData,
        dateOfBirth,
        birthMonth: month,
        birthDay: day,
      });
      
      if (result.success) {
        setSuccess('Client added successfully!');
        setFormData({
          name: '',
          phoneNumber: '',
          birthMonth: '',
          birthDay: '',
          branch: '',
        });
        setDuplicateWarning(false);
        if (onClientAdded) {
          onClientAdded();
        }
      } else {
        setError(result.error || 'Failed to add client');
      }
    } catch (err) {
      setError('An error occurred while adding the client');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Client</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Client Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter client name"
        />
      </div>

      <div>
        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number *
        </label>
        <input
          type="tel"
          id="phoneNumber"
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
            <label htmlFor="birthMonth" className="block text-xs text-gray-600 mb-1">
              Month
            </label>
            <select
              id="birthMonth"
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
            <label htmlFor="birthDay" className="block text-xs text-gray-600 mb-1">
              Day
            </label>
            <select
              id="birthDay"
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
        <p className="mt-1 text-xs text-gray-500">
          Year is not required - only month and day are needed
        </p>
      </div>

      <div>
        <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">
          Branch *
        </label>
        {branches.length === 0 ? (
          <div className="w-full px-3 py-2 border border-yellow-300 bg-yellow-50 rounded-md text-sm text-yellow-700">
            No branches available. Please create a branch first.
          </div>
        ) : (
          <select
            id="branch"
            name="branch"
            value={formData.branch}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add Client'}
      </button>
    </form>
  );
}

