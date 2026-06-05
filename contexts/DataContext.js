'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays, getClientCountsByBranch, getBirthdayCountsByBranch } from '@/lib/clients';
import { getAllEnrollments, getActiveEnrollmentCount } from '@/lib/memberships';
import { getAllBranches } from '@/lib/branches';

const DataContext = createContext({});

export function DataProvider({ children }) {
  const { user } = useAuth();
  const loadingRef = useRef(false);
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
    activeGymEnrollmentCount: 0,
    activeSpaEnrollmentCount: 0,
    lastFetched: null
  });
  const [loading, setLoading] = useState(false);
  const [fullDataLoading, setFullDataLoading] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && data.lastFetched && (now - data.lastFetched < 5 * 60 * 1000)) {
      return;
    }

    if (!user || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setFullDataLoading(true);

    try {
      // Load lightweight home-card data first so refreshes can render the main page quickly.
      const allBranches = await getAllBranches();
      const [
        clientCounts,
        birthdayCounts,
        birthdays,
        activeGymEnrollmentCount,
        activeSpaEnrollmentCount,
      ] = await Promise.all([
        getClientCountsByBranch(allBranches),
        getBirthdayCountsByBranch(allBranches),
        getTodaysBirthdays(null),
        getActiveEnrollmentCount(false),
        getActiveEnrollmentCount(true),
      ]);

      setData(prev => ({
        ...prev,
        branches: allBranches,
        clientCountsByBranch: clientCounts,
        birthdayCountsByBranch: birthdayCounts,
        todaysBirthdays: birthdays,
        allBirthdays: birthdays,
        activeGymEnrollmentCount,
        activeSpaEnrollmentCount,
      }));
      setLoading(false);

      // Load large datasets after the cards have enough data to display.
      const [clients, gymEnrollments, spaEnrollments] = await Promise.all([
        getAllClients(null),
        getAllEnrollments(false),
        getAllEnrollments(true),
      ]);

      setData(prev => ({
        ...prev,
        allClients: clients,
        globalClients: clients,
        gymEnrollments,
        spaEnrollments,
        branches: allBranches,
        clientCountsByBranch: clientCounts,
        birthdayCountsByBranch: birthdayCounts,
        activeGymEnrollmentCount,
        activeSpaEnrollmentCount,
        lastFetched: now
      }));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setFullDataLoading(false);
    }
  }, [user, data.lastFetched]);

  useEffect(() => {
    if (user && !data.lastFetched) {
      loadData();
    }
  }, [user, data.lastFetched, loadData]);

  return (
    <DataContext.Provider value={{ ...data, loading, fullDataLoading, refreshData: () => loadData(true) }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
