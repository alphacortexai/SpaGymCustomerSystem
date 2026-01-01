'use client';

import { useState, useEffect } from 'react';
import { addBranch, getAllBranches } from '@/lib/branches';

export default function BranchForm({ onBranchAdded }) {
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingBranches, setExistingBranches] = useState([]);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const branches = await getAllBranches();
    setExistingBranches(branches);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!branchName.trim()) {
      setError('Branch name is required');
      setLoading(false);
      return;
    }

    try {
      const result = await addBranch(branchName);
      
      if (result.success) {
        setSuccess('Branch added successfully!');
        setBranchName('');
        await loadBranches();
        if (onBranchAdded) {
          onBranchAdded();
        }
      } else {
        setError(result.error || 'Failed to add branch');
      }
    } catch (err) {
      setError('An error occurred while adding the branch');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Branch</h2>
        
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

        <div>
          <label htmlFor="branchName" className="block text-sm font-medium text-gray-700 mb-1">
            Branch Name *
          </label>
          <input
            type="text"
            id="branchName"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter branch name"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding...' : 'Add Branch'}
        </button>
      </form>

      {/* Existing Branches List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Existing Branches</h3>
        {existingBranches.length === 0 ? (
          <p className="text-gray-500">No branches created yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {existingBranches.map((branch) => (
              <div
                key={branch.id}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-700"
              >
                {branch.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

