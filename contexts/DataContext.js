'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';

const DataContext = createContext({});

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [allClients, setAllClients] = useState([]);
  const [globalClients, setGlobalClients] = useState([]);
  const [branches, setBranches] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allBirthdays, setAllBirthdays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const loadData = useCallback(async (force = false) => {
    // If not forced and we have data within the last 5 minutes, don't refetch
    const now = Date.now();
    if (!force && lastFetched && (now - lastFetched < 5 * 60 * 1000)) {
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const [birthdays, clients, allBranches, allBdays, allGlobalClients] = await Promise.all([
        getTodaysBirthdays(null), // Default to all branches for cache
        getAllClients(null),
        getAllBranches(),
        getTodaysBirthdays(null),
        getAllClients(null),
      ]);

      setTodaysBirthdays(birthdays);
      setAllClients(clients);
      setBranches(allBranches);
      setAllBirthdays(allBdays);
      setGlobalClients(allGlobalClients);
      setLastFetched(now);
    } catch (error) {
      console.error('Error loading data in DataContext:', error);
    } finally {
      setLoading(false);
    }
  }, [user, lastFetched]);

  // Initial load when user is available
  useEffect(() => {
    if (user && !lastFetched) {
      loadData();
    }
  }, [user, lastFetched, loadData]);

  const refreshData = () => loadData(true);

  return (
    <DataContext.Provider value={{
      allClients,
      globalClients,
      branches,
      todaysBirthdays,
      allBirthdays,
      loading,
      refreshData,
      lastFetched
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
