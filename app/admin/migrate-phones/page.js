'use client';

import { useState } from 'react';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizePhoneNumber } from '@/lib/phoneUtils';
import { useNotifications } from '@/contexts/NotificationContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MigratePhones() {
  const { showConfirm } = useNotifications();
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
    const ok = await showConfirm({
      title: 'Update every phone number?',
      message: 'This rewrites stored phone numbers. It cannot be undone. Preview the list first, and keep a backup.',
      confirmLabel: 'Update numbers',
      tone: 'destructive',
    });
    if (!ok) return;

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
      <div className="dashboard-shell min-h-screen p-6 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <header className="page-intro mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Phone numbers</h1>
              <p className="page-intro-copy">Rewrite stored numbers into one local format. Preview the list before anything changes. Keep a backup, because this cannot be undone.</p>
            </div>
          </header>
          <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6">
            <p className="mb-3 text-sm text-[#6e6e73]">Examples of what will change:</p>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[#424245]">
              <li>782830524 becomes 0782830524</li>
              <li>0776961331/ 758583813 keeps the first number, 0776961331</li>
              <li>254782830524 drops the country code and becomes 0782830524</li>
            </ul>
            <p className="rounded-xl bg-[#fff4e5] px-4 py-3 text-sm leading-6 text-[#7a4b00]">Take a backup first. Updating numbers rewrites the database.</p>
          </div>

          <div className="mb-6 rounded-2xl border border-black/5 bg-white p-6">
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={loading}
                className="apple-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Working…' : 'Preview changes'}
              </button>
              <button
                type="button"
                onClick={handleMigration}
                disabled={loading || !preview}
                className="apple-button-destructive text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update numbers'}
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
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <h2 className="mb-4 text-xl font-bold">Preview ({preview.length})</h2>
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
            <div className="rounded-2xl border border-black/5 bg-white p-6">
              <p className="text-sm text-[#6e6e73]">Every phone number is already in the local format.</p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}





