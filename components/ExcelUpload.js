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

  const loadBranches = async () => {
    const branchList = await getAllBranches();
    setBranches(branchList);
  };

  useEffect(() => {
    loadBranches();
  }, []);

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
          setSuccess(data.message || `Import completed! ${data.success || 0} clients added successfully.`);
          if (onClientsAdded) onClientsAdded();
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
      const formData = new FormData();
      formData.append('file', file);
      if (defaultBranch) formData.append('defaultBranch', defaultBranch);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to upload file');
        setUploading(false);
        return;
      }

      if (result.success) {
        setCurrentJobId(result.jobId);
        setSuccess(`File uploaded! Processing ${result.totalRows} rows.`);
        setUploading(false);
        e.target.value = '';
        try {
          await fetch('/api/jobs/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: result.jobId }),
          });
        } catch (processErr) {
          console.error('Error triggering processing:', processErr);
        }
      } else {
        setError(result.error || 'Upload failed');
        setUploading(false);
      }
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Upload Excel File</h2>
        <p className="text-sm text-slate-500 mt-1">Import multiple clients at once using a spreadsheet.</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            File Requirements
          </h4>
          <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
            Your Excel file should include columns for <strong>Name</strong>, <strong>Phone Number</strong>, <strong>Date of Birth</strong>, and <strong>Branch</strong>.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="defaultBranch" className="text-sm font-medium text-slate-700 dark:text-slate-300">Default Branch</label>
            <select
              id="defaultBranch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">Select default branch (optional)</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name}>{branch.name}</option>
              ))}
            </select>
          </div>

          <div className="relative group">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 group-hover:border-blue-400 dark:group-hover:border-blue-500 rounded-2xl p-8 transition-all text-center">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{uploading ? 'Uploading...' : 'Click to upload or drag and drop'}</p>
              <p className="text-xs text-slate-500 mt-1">Excel files (.xlsx, .xls) up to 10MB</p>
            </div>
          </div>
        </div>

        {(error || success) && (
          <div className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${error ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={error ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M5 13l4 4L19 7"} /></svg>
            <p>{error || success}</p>
          </div>
        )}

        {jobStatus && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
                  <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                )}
                <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{jobStatus.status}</span>
              </div>
              <span className="text-xs font-bold text-blue-600">{jobStatus.progress || 0}%</span>
            </div>
            
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${jobStatus.progress || 0}%` }}></div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Success</p>
                <p className="text-lg font-bold text-emerald-600">{jobStatus.success || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Failed</p>
                <p className="text-lg font-bold text-rose-600">{jobStatus.failed || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Skipped</p>
                <p className="text-lg font-bold text-amber-600">{jobStatus.skipped || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
