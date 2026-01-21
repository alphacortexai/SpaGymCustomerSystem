'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTimeline, deleteTimelineEntry, getTimelineUserEmails } from '@/lib/timeline';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { format } from 'date-fns';

export default function ActionsTimeline() {
  const { profile } = useAuth();
  const { toast, showConfirm } = useNotifications();
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [timePeriod, setTimePeriod] = useState('all'); // 'all', 'week', 'month', 'year'
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [userEmails, setUserEmails] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  const [pageTimestamps, setPageTimestamps] = useState([]); // Store timestamps for each page
  const itemsPerPage = 25;

  const isAdmin = profile?.role === 'Admin';

  const loadUserEmails = async () => {
    const emails = await getTimelineUserEmails();
    setUserEmails(emails);
  };

  const loadTimeline = async (page = 1) => {
    setLoading(true);
    try {
      // Get the timestamp for the previous page (for pagination)
      const previousPageTimestamp = page > 1 && pageTimestamps[page - 2] ? pageTimestamps[page - 2] : null;
      
      const options = {
        maxResults: itemsPerPage,
        period: timePeriod === 'all' ? null : timePeriod,
        userEmail: selectedUserEmail || null,
        lastTimestamp: previousPageTimestamp
      };

      const result = await getTimeline(options);
      
      // Store the timeline for current page
      setTimeline(result.timeline);
      
      // Store the last timestamp of this page for next page navigation
      if (result.lastTimestamp) {
        const newPageTimestamps = [...pageTimestamps];
        newPageTimestamps[page - 1] = result.lastTimestamp;
        setPageTimestamps(newPageTimestamps);
      }
      
      setHasMore(result.hasMore);
      setLastTimestamp(result.lastTimestamp);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm({ message: 'Are you sure you want to delete this timeline entry?', confirmLabel: 'Delete' });
    if (!ok) return;
    setDeletingId(id);
    try {
      const result = await deleteTimelineEntry(id);
      if (result.success) {
        setTimeline(prev => prev.filter(item => item.id !== id));
      } else {
        toast('Failed to delete entry: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting timeline entry:', error);
      toast('An error occurred while deleting.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
    loadTimeline(newPage);
  };

  const getTotalPages = () => {
    // Estimate total pages based on whether there are more results
    // Since Firestore doesn't give us total count, we estimate based on hasMore
    if (!hasMore && currentPage === 1) {
      return 1;
    }
    // If we have more results, we know there's at least one more page
    return hasMore ? currentPage + 1 : currentPage;
  };

  useEffect(() => {
    loadUserEmails();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setPageTimestamps([]);
    setLastTimestamp(null);
    loadTimeline(1);
  }, [timePeriod, selectedUserEmail]);

  const paginatedTimeline = useMemo(() => {
    return timeline;
  }, [timeline]);

  const getActionColor = (action) => {
    switch (action) {
      case 'ADD': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'EDIT': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'DELETE': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      case 'TREATMENT': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  if (loading && timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">Loading timeline...</h3>
          <p className="text-slate-500 mt-1">Please wait while we fetch the records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Actions Timeline</h2>
        <button 
          onClick={() => {
            setCurrentPage(1);
            setPageTimestamps([]);
            loadTimeline(1);
          }} 
          className="text-sm text-blue-600 hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Time Period
            </label>
            <select
              value={timePeriod}
              onChange={(e) => {
                setTimePeriod(e.target.value);
                setCurrentPage(1);
                setPageTimestamps([]);
                setLastTimestamp(null);
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="all">All Time</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filter by User
            </label>
            <select
              value={selectedUserEmail}
              onChange={(e) => {
                setSelectedUserEmail(e.target.value);
                setCurrentPage(1);
                setPageTimestamps([]);
                setLastTimestamp(null);
              }}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            >
              <option value="">All Users</option>
              {userEmails.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
                {isAdmin && <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {paginatedTimeline.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-10 text-center text-slate-500">
                    {loading ? 'Loading...' : 'No actions found for the selected filters.'}
                  </td>
                </tr>
              ) : (
                paginatedTimeline.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {item.timestamp ? format(item.timestamp, 'MMM d, HH:mm:ss') : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{item.userName}</div>
                      <div className="text-xs text-slate-500">{item.userEmail}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${getActionColor(item.action)}`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-400 uppercase">{item.targetType}</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">{item.targetName}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {item.details}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all disabled:opacity-50"
                          title="Delete Entry"
                        >
                          {deletingId === item.id ? (
                            <div className="w-4 h-4 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {paginatedTimeline.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Showing {paginatedTimeline.length} {paginatedTimeline.length === 1 ? 'entry' : 'entries'} on page {currentPage}
            {timePeriod !== 'all' && ` (${timePeriod === 'week' ? 'Last Week' : timePeriod === 'month' ? 'Last Month' : 'Last Year'})`}
            {selectedUserEmail && ` for ${selectedUserEmail}`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Page {currentPage} {hasMore ? `of ${currentPage}+` : `of ${currentPage}`}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore || loading}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
