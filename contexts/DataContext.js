'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getAllClients, getTodaysBirthdays, getClientCountsByBranch, getBirthdayCountsByBranch } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';
import { getBirthdayCallers } from '@/lib/birthdayCallers';
import { getAllEnrollments } from '@/lib/memberships';

const DataContext = createContext({});

function createEmptyData() {
  return {
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
  };
}

export function DataProvider({ children }) {
  const { user } = useAuth();
  const loadingRef = useRef(false);
  const activeUserIdRef = useRef(null);
  const requestGenerationRef = useRef(0);
  const clientLoadPromiseRef = useRef(null);
  const enrollmentLoadPromiseRef = useRef(null);
  const clientDataLoadedRef = useRef(false);
  const enrollmentDataLoadedRef = useRef(false);
  const [data, setData] = useState(createEmptyData);
  const [loading, setLoading] = useState(false);
  const [coreDataReady, setCoreDataReady] = useState(false);
  const [clientDataLoaded, setClientDataLoaded] = useState(false);
  const [enrollmentDataLoaded, setEnrollmentDataLoaded] = useState(false);
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

  const loadClientData = useCallback(async (force = false) => {
    if (!user) return [];
    if (clientLoadPromiseRef.current) return clientLoadPromiseRef.current;
    if (!force && clientDataLoadedRef.current) return data.allClients;

    const generation = requestGenerationRef.current;
    setFullDataLoading(true);
    const request = getAllClients(null)
      .then((clients) => {
        if (generation === requestGenerationRef.current) {
          clientDataLoadedRef.current = true;
          setData((prev) => ({ ...prev, allClients: clients, globalClients: clients }));
          setClientDataLoaded(true);
        }
        return clients;
      })
      .catch((error) => {
        console.error('Error loading client list:', error);
        if (generation === requestGenerationRef.current) {
          clientDataLoadedRef.current = true;
          setClientDataLoaded(true);
        }
        return [];
      })
      .finally(() => {
        if (generation === requestGenerationRef.current) setFullDataLoading(false);
        if (clientLoadPromiseRef.current === request) clientLoadPromiseRef.current = null;
      });
    clientLoadPromiseRef.current = request;
    return request;
  }, [user, data.allClients]);

  const refreshBirthdayData = useCallback(async () => {
    if (!user) return;
    const generation = requestGenerationRef.current;
    try {
      const [birthdays, birthdayCallers, clients] = await Promise.all([
        getTodaysBirthdays(null),
        getBirthdayCallers(),
        clientDataLoadedRef.current ? getAllClients(null) : Promise.resolve(null),
      ]);
      if (generation !== requestGenerationRef.current) return;
      setData((prev) => ({
        ...prev,
        todaysBirthdays: birthdays,
        allBirthdays: birthdays,
        birthdayCallers,
        ...(clients !== null ? { allClients: clients, globalClients: clients } : {}),
      }));
    } catch (error) {
      console.error('Error refreshing birthday data:', error);
    }
  }, [user]);

  const loadEnrollmentData = useCallback(async (force = false) => {
    if (!user) return;
    if (enrollmentLoadPromiseRef.current) return enrollmentLoadPromiseRef.current;
    if (!force && enrollmentDataLoadedRef.current) return;

    const generation = requestGenerationRef.current;
    const request = Promise.all([getAllEnrollments(false), getAllEnrollments(true)])
      .then(([gymEnrollments, spaEnrollments]) => {
        if (generation !== requestGenerationRef.current) return;
        enrollmentDataLoadedRef.current = true;
        setEnrollmentDataLoaded(true);
        setData((prev) => ({ ...prev, gymEnrollments, spaEnrollments }));
      })
      .catch((error) => console.error('Error loading enrollment data:', error))
      .finally(() => {
        if (enrollmentLoadPromiseRef.current === request) enrollmentLoadPromiseRef.current = null;
      });
    enrollmentLoadPromiseRef.current = request;
    return request;
  }, [user]);

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && data.lastFetched && (now - data.lastFetched < 5 * 60 * 1000)) return;
    if (!user || loadingRef.current) return;

    const generation = requestGenerationRef.current;
    loadingRef.current = true;
    setLoading(true);

    try {
      const [allBranches, birthdays, birthdayCallers] = await Promise.all([
        getAllBranches(),
        getTodaysBirthdays(null),
        getBirthdayCallers(),
      ]);

      if (generation !== requestGenerationRef.current) return;
      setData((prev) => ({
        ...prev,
        branches: allBranches,
        todaysBirthdays: birthdays,
        allBirthdays: birthdays,
        birthdayCallers,
        lastFetched: Date.now(),
      }));
      setCoreDataReady(true);

      // Counts (including active-membership aggregates) hydrate badges after the shell is usable.
      Promise.all([
        getClientCountsByBranch(allBranches),
        getBirthdayCountsByBranch(allBranches),
        import('@/lib/memberships').then(({ getActiveEnrollmentCount }) => Promise.all([
          getActiveEnrollmentCount(false),
          getActiveEnrollmentCount(true),
        ])),
      ]).then(([clientCounts, birthdayCounts, activeEnrollmentCounts]) => {
        if (generation !== requestGenerationRef.current) return;
        const [activeGymEnrollmentCount, activeSpaEnrollmentCount] = activeEnrollmentCounts;
        setData((prev) => ({
          ...prev,
          clientCountsByBranch: clientCounts,
          birthdayCountsByBranch: birthdayCounts,
          activeGymEnrollmentCount,
          activeSpaEnrollmentCount,
        }));
      }).catch((error) => console.error('Error loading dashboard counts:', error));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      if (generation === requestGenerationRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [user, data.lastFetched]);

  const refreshData = useCallback(async () => {
    await loadData(true);
    if (clientDataLoadedRef.current) await loadClientData(true);
  }, [loadData, loadClientData]);

  useEffect(() => {
    const nextUserId = user?.uid || null;
    if (activeUserIdRef.current === nextUserId) return;

    activeUserIdRef.current = nextUserId;
    requestGenerationRef.current += 1;
    loadingRef.current = false;
    clientLoadPromiseRef.current = null;
    enrollmentLoadPromiseRef.current = null;
    clientDataLoadedRef.current = false;
    enrollmentDataLoadedRef.current = false;
    setData(createEmptyData());
    setCoreDataReady(false);
    setClientDataLoaded(false);
    setEnrollmentDataLoaded(false);
    setLoading(false);
    setFullDataLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    if (user && !data.lastFetched) {
      Promise.resolve().then(() => loadData());
    }
  }, [user, data.lastFetched, loadData]);

  return (
    <DataContext.Provider value={{
      ...data,
      loading,
      coreDataReady,
      clientDataLoaded,
      fullDataLoading,
      loadClientData,
      loadEnrollmentData,
      enrollmentDataLoaded,
      patchClient,
      refreshBirthdayData,
      refreshData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
