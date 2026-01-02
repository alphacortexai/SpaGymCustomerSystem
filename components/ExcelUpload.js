'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAllBranches } from '@/lib/branches';

export default function ExcelUpload({ onClientsAdded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const branchList = await getAllBranches();
    setBranches(branchList);
  };

  // Listen to job status in real-time
  useEffect(() => {
    if (!currentJobId) return;

    const jobRef = doc(db, 'importJobs', currentJobId);
    const unsubscribe = onSnapshot(jobRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setJobStatus({
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
        
        if (data.status === 'completed') {
          setSuccess(
            data.message || 
            `Import completed! ${data.success || 0} clients added successfully.`
          );
          if (onClientsAdded) {
            onClientsAdded();
          }
          // Don't clear jobId immediately - let user see the results
        } else if (data.status === 'failed') {
          setError(`Import failed: ${data.error || 'Unknown error'}`);
        }
      }
    });

    return () => unsubscribe();
  }, [currentJobId, onClientsAdded]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploading(true);
    setJobStatus(null);
    setCurrentJobId(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      if (defaultBranch) {
        formData.append('defaultBranch', defaultBranch);
      }

      // Upload file to server
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to upload file');
        setUploading(false);
        return;
      }

      if (result.success) {
        setCurrentJobId(result.jobId);
        setSuccess(`File uploaded successfully! Processing ${result.totalRows} rows in background. You can safely navigate away.`);
        setUploading(false);
        // Reset file input
        e.target.value = '';
        
        // Trigger processing in a separate API call
        // This ensures processing happens even on Vercel where functions terminate after response
        try {
          const processResponse = await fetch('/api/jobs/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId: result.jobId }),
          });
          
          if (!processResponse.ok) {
            const processError = await processResponse.json();
            console.error('Failed to start processing:', processError);
            // Don't show error to user - job status listener will handle it
          }
        } catch (processErr) {
          console.error('Error triggering processing:', processErr);
          // Don't show error to user - job status listener will handle it
          // The job data is stored, so processing can be manually triggered if needed
        }
      } else {
        setError(result.error || 'Upload failed');
        setUploading(false);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Upload Excel File</h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Upload an Excel file (.xlsx, .xls) with columns: <strong>Name</strong>, <strong>Phone Number</strong>, <strong>Date of Birth</strong>, and <strong>Branch</strong> (optional - use default below if missing)
        </p>
        <p className="text-xs text-yellow-600 mb-3">
          ⚠️ Note: Clients with invalid or non-existent branches will be skipped during import.
        </p>
        <div className="mb-3">
          <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-700 mb-1">
            Default Branch (if not in Excel file)
          </label>
          <select
            id="defaultBranch"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select default branch (optional)</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
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

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-sm font-medium text-blue-900">Uploading file...</p>
          </div>
        </div>
      )}

      {/* Job Status - Real-time Progress */}
      {jobStatus && (
        <div className="space-y-4 mb-4">
          <div className={`border rounded-lg p-4 ${
            jobStatus.status === 'completed' ? 'bg-green-50 border-green-200' :
            jobStatus.status === 'failed' ? 'bg-red-50 border-red-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm font-medium ${
                jobStatus.status === 'completed' ? 'text-green-900' :
                jobStatus.status === 'failed' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {jobStatus.status === 'pending' && '⏳ Waiting to start...'}
                {jobStatus.status === 'processing' && '🔄 Validating rows...'}
                {jobStatus.status === 'importing' && '💾 Importing to database...'}
                {jobStatus.status === 'completed' && '✅ Import completed!'}
                {jobStatus.status === 'failed' && '❌ Import failed'}
              </p>
              {jobStatus.total > 0 && (
                <p className={`text-sm font-semibold ${
                  jobStatus.status === 'completed' ? 'text-green-700' :
                  jobStatus.status === 'failed' ? 'text-red-700' :
                  'text-blue-700'
                }`}>
                  {jobStatus.processed?.toLocaleString() || 0} / {jobStatus.total.toLocaleString()} ({jobStatus.progress || 0}%)
                </p>
              )}
            </div>
            
            {jobStatus.total > 0 && (
              <div className={`w-full rounded-full h-3 overflow-hidden ${
                jobStatus.status === 'completed' ? 'bg-green-200' :
                jobStatus.status === 'failed' ? 'bg-red-200' :
                'bg-blue-200'
              }`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    jobStatus.status === 'completed' ? 'bg-green-600' :
                    jobStatus.status === 'failed' ? 'bg-red-600' :
                    'bg-blue-600'
                  }`}
                  style={{ width: `${jobStatus.progress || 0}%` }}
                />
              </div>
            )}

            {jobStatus.total > 0 && jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
              <div className="mt-2 text-xs text-gray-600">
                {jobStatus.status === 'processing' && `Validating row ${jobStatus.processed?.toLocaleString() || 0} of ${jobStatus.total.toLocaleString()}...`}
                {jobStatus.status === 'importing' && `Adding client ${jobStatus.processed?.toLocaleString() || 0} of ${jobStatus.total.toLocaleString()} to database...`}
              </div>
            )}

            {/* Stats */}
            {(jobStatus.status === 'importing' || jobStatus.status === 'completed') && (
              <div className="mt-3 pt-3 border-t border-gray-300 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">Success:</span>
                  <span className="ml-1 font-semibold text-green-600">{jobStatus.success || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Failed:</span>
                  <span className="ml-1 font-semibold text-red-600">{jobStatus.failed || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Skipped:</span>
                  <span className="ml-1 font-semibold text-yellow-600">{jobStatus.skipped || 0}</span>
                </div>
              </div>
            )}

            {currentJobId && (jobStatus.status === 'processing' || jobStatus.status === 'importing') && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="text-xs text-gray-600 mb-2">
                  💡 <strong>You can safely close this browser tab!</strong> Processing will continue in the background.
                </p>
                <p className="text-xs text-gray-500">
                  Job ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{currentJobId}</code>
                </p>
              </div>
            )}
          </div>

          {/* Skipped Details */}
          {jobStatus.skippedDetails && jobStatus.skippedDetails.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold mb-2 text-yellow-900">
                ⚠️ {jobStatus.skippedDetails.length} row(s) skipped:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto text-yellow-800">
                {jobStatus.skippedDetails.slice(0, 20).map((item, idx) => (
                  <li key={idx}>
                    Row {item.row}: {item.name} - {item.reason}
                  </li>
                ))}
                {jobStatus.skippedDetails.length > 20 && (
                  <li className="text-yellow-600 italic">
                    ... and {jobStatus.skippedDetails.length - 20} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
