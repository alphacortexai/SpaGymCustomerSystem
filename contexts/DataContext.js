'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays } from '@/lib/clients';
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
      const [birthdays, clients, allBranches, allBdays, allGlobalClients, gymEnrollments, spaEnrollments] = await Promise.all([
        getTodaysBirthdays(null),
        getAllClients(null),
        getAllBranches(),
        getTodaysBirthdays(null),
        getAllClients(null),
        getAllEnrollments(false),
        getAllEnrollments(true),
      ]);

      setData({
        todaysBirthdays: birthdays,
        allClients: clients,
        branches: allBranches,
        allBirthdays: allBdays,
        globalClients: allGlobalClients,
        gymEnrollments: gymEnrollments,
        spaEnrollments: spaEnrollments,
        lastFetched: now
      });
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
