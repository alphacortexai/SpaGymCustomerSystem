'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { getUploadHistory } from '@/lib/uploadHistory';

export default function UploadHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'completed', 'failed', 'processing'

  useEffect(() => {
    loadHistory();
  }, [filter]);

  useEffect(() => {
    // Auto-refresh every 30 seconds to catch new uploads
    const interval = setInterval(() => {
      loadHistory();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const allHistory = await getUploadHistory(50); // Get more to filter client-side
      let filtered = allHistory;
      
      if (filter !== 'all') {
        filtered = allHistory.filter(item => item.status === filter);
      }
      
      setHistory(filtered);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'processing':
      case 'importing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'processing':
      case 'importing':
        return '🔄';
      case 'pending':
        return '⏳';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Loading upload history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md">
        {/* Mobile: Stacked Header */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
              Upload History
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {history.length}
              </span>
              <button
                onClick={loadHistory}
                disabled={loading}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Refresh history"
              >
                <span className="text-base">🔄</span>
              </button>
            </div>
          </div>
          
          {/* Filter Buttons - Mobile Optimized */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-[60px] ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-[90px] ${
                filter === 'completed'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              ✅ Done
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-[80px] ${
                filter === 'failed'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              ❌ Failed
            </button>
            <button
              onClick={() => setFilter('processing')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-[100px] ${
                filter === 'processing'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
              }`}
            >
              🔄 Active
            </button>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-600 text-base sm:text-lg font-medium mb-1">
              No upload history found
            </p>
            {filter !== 'all' && (
              <p className="text-gray-500 text-sm">
                Try selecting a different filter
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mobile: Card View */}
            <div className="md:hidden space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white shadow-sm"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm break-words">
                        {item.fileName}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.createdAt
                          ? formatDistanceToNow(item.createdAt, { addSuffix: true })
                          : 'Unknown time'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border flex-shrink-0 ${getStatusColor(
                        item.status
                      )}`}
                    >
                      {getStatusIcon(item.status)} {item.status}
                    </span>
                  </div>

                  {item.status === 'completed' && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
                            {item.success || 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">Success</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-red-600">
                            {item.failed || 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">Failed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-yellow-600">
                            {item.skipped || 0}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">Skipped</div>
                        </div>
                      </div>
                      {item.total > 0 && (
                        <div className="text-center mt-2 text-xs text-gray-500">
                          Total: {item.total} rows
                        </div>
                      )}
                    </div>
                  )}

                  {(item.status === 'processing' || item.status === 'importing') && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm font-bold text-blue-600">{item.progress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all shadow-sm"
                          style={{ width: `${item.progress || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{item.processed || 0} processed</span>
                        <span>{item.total || 0} total</span>
                      </div>
                    </div>
                  )}

                  {item.status === 'failed' && item.error && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-xs font-medium text-red-800 mb-1">Error:</p>
                        <p className="text-xs text-red-700 break-words">
                          {item.error}
                        </p>
                      </div>
                    </div>
                  )}

                  {item.message && (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
                        {item.message}
                      </p>
                    </div>
                  )}

                  {/* Date Info - Mobile */}
                  {item.createdAt && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{format(item.createdAt, 'MMM dd, yyyy')}</span>
                        <span>{format(item.createdAt, 'hh:mm a')}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Results
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.fileName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                            item.status
                          )}`}
                        >
                          {getStatusIcon(item.status)} {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(item.status === 'processing' ||
                          item.status === 'importing') && (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${item.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {item.progress || 0}%
                            </span>
                          </div>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-sm text-green-600 font-medium">
                            100%
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="text-sm text-red-600 font-medium">
                            Failed
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="text-sm text-yellow-600 font-medium">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.status === 'completed' && (
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="text-gray-600">Success: </span>
                              <span className="font-semibold text-green-600">
                                {item.success || 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Failed: </span>
                              <span className="font-semibold text-red-600">
                                {item.failed || 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Skipped: </span>
                              <span className="font-semibold text-yellow-600">
                                {item.skipped || 0}
                              </span>
                            </div>
                          </div>
                        )}
                        {item.status !== 'completed' && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.createdAt ? (
                          <div>
                            <div>{format(item.createdAt, 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-gray-400">
                              {format(item.createdAt, 'hh:mm a')}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                            </div>
                          </div>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

