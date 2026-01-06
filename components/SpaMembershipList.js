'use client';

import { useState, useEffect } from 'react';
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

  if (loading && enrollments.length === 0) return <div className="text-center py-10">Loading spa memberships...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Spa Memberships</h2>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
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
          <button onClick={loadEnrollments} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Branch</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-slate-500">No spa memberships found.</td>
              </tr>
            ) : (
              enrollments.map((enrollment) => (
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
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      enrollment.status === 'cancelled'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : new Date() > enrollment.expiryDate 
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                          : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    }`}>
                      {enrollment.status === 'cancelled' ? 'Cancelled' : (new Date() > enrollment.expiryDate ? 'Expired' : 'Active')}
                    </span>
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
              ))
            )}
          </tbody>
        </table>
      </div>

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
