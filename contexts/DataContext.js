'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays, getClientCountsByBranch, getBirthdayCountsByBranch } from '@/lib/clients';
import { getAllEnrollments } from '@/lib/memberships';
import { getAllBranches } from '@/lib/branches';

const DataContext = createContext({});

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState({
    allClients: [],
    globalClients: [],
    branches: [],
    todaysBirthdays: [],
    allBirthdays: [],
    gymEnrollments: [],
    spaEnrollments: [],
    clientCountsByBranch: {},
    birthdayCountsByBranch: {},
    lastFetched: null
  });
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && data.lastFetched && (now - data.lastFetched < 5 * 60 * 1000)) {
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Load counts first (lightweight) for badges
      const [clientCounts, birthdayCounts, allBranches] = await Promise.all([
        getClientCountsByBranch(),
        getBirthdayCountsByBranch(),
        getAllBranches(),
      ]);

      // Update counts immediately for fast badge rendering
      setData(prev => ({
        ...prev,
        clientCountsByBranch: clientCounts,
        birthdayCountsByBranch: birthdayCounts,
        branches: allBranches,
      }));

      // Load full data in parallel (no duplicate fetches)
      const [birthdays, clients, gymEnrollments, spaEnrollments] = await Promise.all([
        getTodaysBirthdays(null),
        getAllClients(null),
        getAllEnrollments(false),
        getAllEnrollments(true),
      ]);

      setData(prev => ({
        ...prev,
        todaysBirthdays: birthdays,
        allClients: clients,
        allBirthdays: birthdays,
        globalClients: clients,
        gymEnrollments,
        spaEnrollments,
        branches: allBranches,
        clientCountsByBranch: clientCounts,
        birthdayCountsByBranch: birthdayCounts,
        lastFetched: now
      }));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, data.lastFetched]);

  useEffect(() => {
    if (user && !data.lastFetched) {
      loadData();
    }
  }, [user, data.lastFetched, loadData]);

  return (
    <DataContext.Provider value={{ ...data, loading, refreshData: () => loadData(true) }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
