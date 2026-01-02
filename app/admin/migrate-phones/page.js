'use client';

import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MigratePhones() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);

  const handlePreview = async () => {
    setLoading(true);
    setProgress('Fetching clients...');
    setPreview(null);
    
    try {
      const clientsRef = collection(db, 'clients');
      const snapshot = await getDocs(clientsRef);
      
      const updates = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const currentPhone = data.phoneNumber || '';
        const normalizedPhone = normalizePhoneNumber(currentPhone);
        
        if (currentPhone !== normalizedPhone) {
          updates.push({
            id: docSnapshot.id,
            name: data.name || 'N/A',
            branch: data.branch || 'N/A',
            oldPhone: currentPhone,
            newPhone: normalizedPhone,
          });
        }
      });
      
      setPreview(updates);
      setProgress(`Found ${updates.length} phone numbers that need normalization.`);
    } catch (error) {
      console.error('Preview error:', error);
      setProgress(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm('This will update all phone numbers in the database. This action cannot be undone. Continue?')) {
      return;
    }

    setLoading(true);
    setProgress('Fetching clients...');
    setResults(null);
    
    try {
      const clientsRef = collection(db, 'clients');
      const snapshot = await getDocs(clientsRef);
      
      const updates = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const currentPhone = data.phoneNumber || '';
        const normalizedPhone = normalizePhoneNumber(currentPhone);
        
        if (currentPhone !== normalizedPhone) {
          updates.push({
            id: docSnapshot.id,
            name: data.name || 'N/A',
            branch: data.branch || 'N/A',
            oldPhone: currentPhone,
            newPhone: normalizedPhone,
          });
        }
      });
      
      setProgress(`Found ${updates.length} phone numbers to normalize. Updating...`);
      
      let updated = 0;
      let errors = 0;
      const errorDetails = [];
      
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        try {
          const clientRef = doc(db, 'clients', update.id);
          await updateDoc(clientRef, {
            phoneNumber: update.newPhone,
            updatedAt: Timestamp.now(),
          });
          updated++;
          setProgress(`Updated ${updated}/${updates.length}: ${update.name} - "${update.oldPhone}" → "${update.newPhone}"`);
        } catch (error) {
          console.error(`Error updating ${update.id}:`, error);
          errors++;
          errorDetails.push({
            name: update.name,
            error: error.message,
          });
        }
      }
      
      setResults({
        total: updates.length,
        updated,
        errors,
        errorDetails,
      });
      setProgress('Migration complete!');
    } catch (error) {
      console.error('Migration error:', error);
      setProgress(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h1 className="text-2xl font-bold mb-2">Phone Number Migration</h1>
            <p className="text-gray-600 mb-4">
              This tool will normalize all phone numbers in the database. For example:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
              <li>"782830524" → "0782830524"</li>
              <li>"0776961331/ 758583813" → "0776961331" (uses first number)</li>
              <li>"254782830524" → "0782830524" (removes country code)</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Important:</strong> Make sure to backup your database before running the migration. 
                This action will update all phone numbers and cannot be undone.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex gap-4 mb-4">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Preview Changes'}
              </button>
              <button
                onClick={handleMigration}
                disabled={loading || !preview}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Migrating...' : 'Start Migration'}
              </button>
            </div>
            
            {progress && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <p className="text-sm">{progress}</p>
              </div>
            )}
            
            {results && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                <h3 className="font-bold mb-2 text-green-800">Migration Results:</h3>
                <p className="text-sm text-green-700">Total found: {results.total}</p>
                <p className="text-sm text-green-700">Successfully updated: {results.updated}</p>
                {results.errors > 0 && (
                  <>
                    <p className="text-sm text-red-600 mt-2">Errors: {results.errors}</p>
                    {results.errorDetails.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-red-600">Error Details:</p>
                        <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                          {results.errorDetails.map((detail, idx) => (
                            <li key={idx}>{detail.name}: {detail.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {preview && preview.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold mb-4">Preview Changes ({preview.length} records)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Old Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Phone</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.slice(0, 50).map((update, idx) => (
                      <tr key={update.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">{update.name}</td>
                        <td className="px-4 py-3 text-gray-500">{update.branch}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{update.oldPhone}</td>
                        <td className="px-4 py-3 text-green-600 font-mono font-semibold">{update.newPhone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 50 && (
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    Showing first 50 of {preview.length} records
                  </p>
                )}
              </div>
            </div>
          )}

          {preview && preview.length === 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600">All phone numbers are already normalized. No changes needed!</p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}





