'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import MembershipDetailsModal from './MembershipDetailsModal';

export default function MembershipList() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'enrollments'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        expiryDate: doc.data().expiryDate?.toDate(),
      }));
      setEnrollments(data);
    } catch (error) {
      console.error('Error loading enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnrollments();
  }, []);

  if (loading) return <div className="text-center py-10">Loading memberships...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Memberships</h2>
        <button onClick={loadEnrollments} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {enrollments.map((enrollment) => (
              <tr key={enrollment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900 dark:text-white">{enrollment.clientName}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
                    {enrollment.membershipType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                  {enrollment.startDate && format(enrollment.startDate, 'MMM d, yyyy')} - {enrollment.expiryDate && format(enrollment.expiryDate, 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    new Date() > enrollment.expiryDate 
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                      : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  }`}>
                    {new Date() > enrollment.expiryDate ? 'Expired' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedEnrollment(enrollment)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEnrollment && (
        <MembershipDetailsModal 
          enrollment={selectedEnrollment} 
          onClose={() => setSelectedEnrollment(null)}
          onUpdate={loadEnrollments}
        />
      )}
    </div>
  );
}
