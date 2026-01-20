'use client';

import { useState, useEffect } from 'react';
import { getUserActivityHeatmap, getUserActivitySummary } from '@/lib/userActivity';
import { format, subDays, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';

export default function UserActivityHeatmap() {
  const [heatmapData, setHeatmapData] = useState({});
  const [userSummary, setUserSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [heatmap, summary] = await Promise.all([
        getUserActivityHeatmap(30),
        getUserActivitySummary(30)
      ]);
      setHeatmapData(heatmap);
      setUserSummary(summary);
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIntensity = (count) => {
    if (!count || count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count <= 2) return 'bg-green-200 dark:bg-green-900/30';
    if (count <= 5) return 'bg-green-400 dark:bg-green-700';
    if (count <= 10) return 'bg-green-600 dark:bg-green-600';
    return 'bg-green-800 dark:bg-green-500';
  };

  const getMaxActivity = () => {
    let max = 0;
    Object.values(heatmapData).forEach(dayData => {
      Object.values(dayData).forEach(count => {
        if (count > max) max = count;
      });
    });
    return max;
  };

  const generateHeatmapGrid = () => {
    const days = 30;
    const hours = 24;
    const startDate = subDays(new Date(), days - 1);
    const grid = [];

    // Generate date labels (one per day)
    const dateLabels = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dateLabels.push(date);
    }

    // Generate hour labels
    const hourLabels = Array.from({ length: hours }, (_, i) => i);

    // Build grid data
    dateLabels.forEach((date, dayIdx) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = heatmapData[dateStr] || {};
      
      hourLabels.forEach((hour) => {
        const count = dayData[hour] || 0;
        grid.push({
          date,
          dateStr,
          hour,
          count,
          dayIdx,
          hourIdx: hour
        });
      });
    });

    return { grid, dateLabels, hourLabels };
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const { grid, dateLabels, hourLabels } = generateHeatmapGrid();
  const maxActivity = getMaxActivity();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">User Activity Heatmap</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Login and activity patterns over the last 30 days</p>
      </div>

      {/* User Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {userSummary.map((user) => {
          const totalHours = Object.values(user.hours || {}).reduce((sum, count) => sum + count, 0);
          return (
            <div
              key={user.userId}
              onClick={() => setSelectedUser(selectedUser === user.userId ? null : user.userId)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedUser === user.userId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900 dark:text-white">{user.userName || user.userEmail}</div>
                <div className="text-xs text-slate-500">{totalHours} sessions</div>
              </div>
              <div className="text-xs text-slate-500">{user.userEmail}</div>
              <div className="text-xs text-slate-400 mt-1">
                Last active: {user.lastActive ? format(user.lastActive, 'MMM d, HH:mm') : 'Never'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex mb-2">
            <div className="w-24 text-xs text-slate-500 dark:text-slate-400 font-medium">Date/Hour</div>
            <div className="flex-1 flex gap-0.5">
              {hourLabels.map((hour) => (
                <div key={hour} className="flex-1 text-[10px] text-slate-400 text-center">
                  {hour % 6 === 0 ? hour : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap grid */}
          <div className="space-y-0.5">
            {dateLabels.map((date, dayIdx) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayData = heatmapData[dateStr] || {};
              
              return (
                <div key={dateStr} className="flex items-center">
                  <div className="w-24 text-xs text-slate-600 dark:text-slate-400 font-medium pr-2">
                    {format(date, 'MMM d')}
                  </div>
                  <div className="flex-1 flex gap-0.5">
                    {hourLabels.map((hour) => {
                      const count = dayData[hour] || 0;
                      const intensity = getIntensity(count);
                      return (
                        <div
                          key={`${dateStr}-${hour}`}
                          className={`flex-1 h-6 rounded ${intensity} border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform cursor-pointer`}
                          title={`${format(date, 'MMM d, yyyy')} ${hour}:00 - ${count} ${count === 1 ? 'session' : 'sessions'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800"></div>
            <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/30"></div>
            <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-700"></div>
            <div className="w-3 h-3 rounded bg-green-600 dark:bg-green-600"></div>
            <div className="w-3 h-3 rounded bg-green-800 dark:bg-green-500"></div>
          </div>
          <span>More</span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Max: {maxActivity} sessions
        </div>
      </div>
    </div>
  );
}
