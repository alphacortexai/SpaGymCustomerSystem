'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays, getClientCountsByBranch, getBirthdayCountsByBranch } from '@/lib/clients';
import { getAllEnrollments, getActiveEnrollmentCount } from '@/lib/memberships';
import { getAllBranches } from '@/lib/branches';
import { getBirthdayCallers } from '@/lib/birthdayCallers';

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
    birthdayCallers: [],
    gymEnrollments: [],
    spaEnrollments: [],
    clientCountsByBranch: {},
    birthdayCountsByBranch: {},
    activeGymEnrollmentCount: 0,
    activeSpaEnrollmentCount: 0,
    lastFetched: null,
  });
  const [loading, setLoading] = useState(false);
  const [fullDataLoading, setFullDataLoading] = useState(false);

  const patchClient = useCallback((clientId, patch) => {
    if (!clientId || !patch) return;
    const mergeClient = (client) => client?.id === clientId ? { ...client, ...patch } : client;
    setData((prev) => ({
      ...prev,
      allClients: prev.allClients.map(mergeClient),
      globalClients: prev.globalClients.map(mergeClient),
      todaysBirthdays: prev.todaysBirthdays.map(mergeClient),
      allBirthdays: prev.allBirthdays.map(mergeClient),
    }));
  }, []);

  const refreshBirthdayData = useCallback(async () => {
    if (!user) return;
    try {
      const [birthdays, birthdayCallers] = await Promise.all([
        getTodaysBirthdays(null),
        getBirthdayCallers(),
      ]);
      setData((prev) => ({
        ...prev,
        todaysBirthdays: birthdays,
        allBirthdays: birthdays,
        birthdayCallers,
      }));
    } catch (error) {
      console.error('Error refreshing birthday data:', error);
    }
  }, [user]);

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
      const allBranches = await getAllBranches();
      const [
        clientCounts,
        birthdayCounts,
        birthdays,
        birthdayCallers,
        activeGymEnrollmentCount,
        activeSpaEnrollmentCount,
      ] = await Promise.all([
        getClientCountsByBranch(allBranches),
        getBirthdayCountsByBranch(allBranches),
        getTodaysBirthdays(null),
        getBirthdayCallers(),
        getActiveEnrollmentCount(false),
        getActiveEnrollmentCount(true),
      ]);

      setData((prev) => ({
        ...prev,
        branches: allBranches,
        clientCountsByBranch: clientCounts,
        birthdayCountsByBranch: birthdayCounts,
        todaysBirthdays: birthdays,
        allBirthdays: birthdays,
        birthdayCallers,
        activeGymEnrollmentCount,
        activeSpaEnrollmentCount,
      }));
      setLoading(false);

      const [clients, gymEnrollments, spaEnrollments] = await Promise.all([
        getAllClients(null),
        getAllEnrollments(false),
        getAllEnrollments(true),
      ]);

      setData((prev) => ({
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
        lastFetched: now,
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
      Promise.resolve().then(() => loadData());
    }
  }, [user, data.lastFetched, loadData]);

  return (
    <DataContext.Provider value={{
      ...data,
      loading,
      fullDataLoading,
      patchClient,
      refreshBirthdayData,
      refreshData: () => loadData(true),
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
