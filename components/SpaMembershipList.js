'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import MembershipDetailsModal from './MembershipDetailsModal';
import { getAllBranches } from '@/lib/branches';

export default function SpaMembershipList() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadInitialData = async () => {
    const allBranches = await getAllBranches();
    setBranches(allBranches);
  };

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'spa_enrollments'), orderBy('createdAt', 'desc'));
      
      if (selectedBranch) {
        q = query(
          collection(db, 'spa_enrollments'),
          where('branch', '==', selectedBranch),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        expiryDate: doc.data().expiryDate?.toDate(),
      }));
      setEnrollments(data);
    } catch (error) {
      console.error('Error loading spa enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [selectedBranch]);

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(enrollment => 
      enrollment.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.membershipType?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [enrollments, searchTerm]);

  const totalPages = Math.ceil(filteredEnrollments.length / itemsPerPage);
  const paginatedEnrollments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEnrollments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEnrollments, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch]);

  if (loading && enrollments.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Loading spa memberships...</h3>
          <p className="text-slate-500 mt-1">Please wait while we fetch the records.</p>
        </div>
      </div>
    );
  }

  const StatusBadge = ({ enrollment }) => {
    const isExpired = new Date() > enrollment.expiryDate;
    const isCancelled = enrollment.status === 'cancelled';
    
    let bgColor = 'bg-green-50 dark:bg-green-900/20';
    let textColor = 'text-green-600 dark:text-green-400';
    let label = 'Active';

    if (isCancelled) {
      bgColor = 'bg-amber-50 dark:bg-amber-900/20';
      textColor = 'text-amber-600 dark:text-amber-400';
      label = 'Cancelled';
    } else if (isExpired) {
      bgColor = 'bg-red-50 dark:bg-red-900/20';
      textColor = 'text-red-600 dark:text-red-400';
      label = 'Expired';
    }

    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${bgColor} ${textColor}`}>
        {label}
      </span>
    );
  };

  const UploadTicks = ({ enrollment }) => (
    <div className="flex gap-1 items-center">
      <div title={enrollment.documents?.contract ? "Invoice Uploaded" : "No Invoice"} className={`w-5 h-5 rounded-full flex items-center justify-center ${enrollment.documents?.contract ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-300'}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
      <div title={enrollment.documents?.pop ? "POP Uploaded" : "No POP"} className={`w-5 h-5 rounded-full flex items-center justify-center ${enrollment.documents?.pop ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-300'}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Spa Memberships</h2>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search spa memberships..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.name}>{branch.name}</option>
            ))}
          </select>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
            <button 
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
          </div>

          <button onClick={loadEnrollments} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      {filteredEnrollments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No spa memberships found</h3>
          <p className="text-slate-500 mt-1">Try adjusting your search criteria.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Docs</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {paginatedEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white">{enrollment.clientName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                      {enrollment.membershipType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{enrollment.branch || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {enrollment.startDate && format(enrollment.startDate, 'MMM d, yyyy')} - {enrollment.expiryDate && format(enrollment.expiryDate, 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4">
                    <UploadTicks enrollment={enrollment} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge enrollment={enrollment} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedEnrollment(enrollment)}
                      className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-lg truncate" title={enrollment.clientName}>{enrollment.clientName}</div>
                  <div className="text-xs text-indigo-600 font-medium uppercase tracking-wider">{enrollment.membershipType}</div>
                </div>
                <StatusBadge enrollment={enrollment} />
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  {enrollment.branch || 'N/A'}
                </div>
                <div className="flex items-center text-sm text-slate-500">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {enrollment.startDate && format(enrollment.startDate, 'MMM d, yyyy')} - {enrollment.expiryDate && format(enrollment.expiryDate, 'MMM d, yyyy')}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-medium">Documents Status:</div>
                  <UploadTicks enrollment={enrollment} />
                </div>
              </div>

              <button 
                onClick={() => setSelectedEnrollment(enrollment)}
                className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {selectedEnrollment && (
        <MembershipDetailsModal 
          enrollment={selectedEnrollment} 
          onClose={() => setSelectedEnrollment(null)}
          onUpdate={loadEnrollments}
          isSpa={true}
        />
      )}
    </div>
  );
}
