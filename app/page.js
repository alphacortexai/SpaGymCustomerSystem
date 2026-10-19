'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { signOut } from '@/lib/auth';
import { searchClients, getClientsPage, getBirthdayClientsByMonth } from '@/lib/clients';
import { affirmations } from '@/lib/affirmations';
import { getActiveNotesCount } from '@/lib/notes';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingState from '@/components/LoadingState';
import { NavCard, QuickActionIcon, TypedBirthdayReminder, TypedGreeting, WorkspaceRail } from '@/components/DashboardChrome';
import { usePageVisibility } from '@/lib/usePageVisibility';

const LazySectionFallback = () => (
  <div className="card-bg-doc rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
    Loading section...
  </div>
);

const ClientList = dynamic(() => import('@/components/ClientList'), { loading: LazySectionFallback });
const ClientForm = dynamic(() => import('@/components/ClientForm'), { loading: LazySectionFallback });
const ExcelUpload = dynamic(() => import('@/components/ExcelUpload'), { loading: LazySectionFallback });
const BranchForm = dynamic(() => import('@/components/BranchForm'), { loading: LazySectionFallback });
const UnrecognizedClientsList = dynamic(() => import('@/components/UnrecognizedClientsList'), { loading: LazySectionFallback });
const UploadHistory = dynamic(() => import('@/components/UploadHistory'), { loading: LazySectionFallback });
const MembershipForm = dynamic(() => import('@/components/MembershipForm'), { loading: LazySectionFallback });
const MembershipTypeManager = dynamic(() => import('@/components/MembershipTypeManager'), { loading: LazySectionFallback });
const PartnerCompanyManager = dynamic(() => import('@/components/PartnerCompanyManager'), { loading: LazySectionFallback });
const EnrollmentForm = dynamic(() => import('@/components/EnrollmentForm'), { loading: LazySectionFallback });
const MembershipList = dynamic(() => import('@/components/MembershipList'), { loading: LazySectionFallback });
const SpaMembershipForm = dynamic(() => import('@/components/SpaMembershipForm'), { loading: LazySectionFallback });
const SpaMembershipTypeManager = dynamic(() => import('@/components/SpaMembershipTypeManager'), { loading: LazySectionFallback });
const SpaEnrollmentForm = dynamic(() => import('@/components/SpaEnrollmentForm'), { loading: LazySectionFallback });
const SpaMembershipList = dynamic(() => import('@/components/SpaMembershipList'), { loading: LazySectionFallback });
const MembershipContactsDirectory = dynamic(() => import('@/components/MembershipContactsDirectory'), { loading: LazySectionFallback });
const UserManagement = dynamic(() => import('@/components/UserManagement'), { loading: LazySectionFallback });
const UserProfile = dynamic(() => import('@/components/UserProfile'), { loading: LazySectionFallback });
const ActionsTimeline = dynamic(() => import('@/components/ActionsTimeline'), { loading: LazySectionFallback });
const DuplicateSearch = dynamic(() => import('@/components/DuplicateSearch'), { loading: LazySectionFallback });
const NviewDashboard = dynamic(() => import('@/components/NviewDashboard'), { loading: LazySectionFallback });
const InvoiceGenerator = dynamic(() => import('@/components/InvoiceGenerator'), { loading: LazySectionFallback });
const InvoiceList = dynamic(() => import('@/components/InvoiceList'), { loading: LazySectionFallback });
const InvoiceTracking = dynamic(() => import('@/components/InvoiceTracking'), { loading: LazySectionFallback });
const NotesSection = dynamic(() => import('@/components/NotesSection'), { loading: LazySectionFallback });
const BirthdayCallersManager = dynamic(() => import('@/components/BirthdayCallersManager'), { loading: LazySectionFallback });
const BirthdayCommunicationsAnalytics = dynamic(() => import('@/components/BirthdayCommunicationsAnalytics'), { loading: LazySectionFallback });
const ReportsSection = dynamic(() => import('@/components/ReportsSection'), { loading: LazySectionFallback });
const CallerAnalyticsAdmin = dynamic(() => import('@/components/CallerAnalyticsAdmin'), { loading: LazySectionFallback });
const CheckInAnalyticsAdmin = dynamic(() => import('@/components/CheckInAnalyticsAdmin'), { loading: LazySectionFallback });
const NewClientsAnalyticsAdmin = dynamic(() => import('@/components/NewClientsAnalyticsAdmin'), { loading: LazySectionFallback });
const FeedbackAttentionAdmin = dynamic(() => import('@/components/FeedbackAttentionAdmin'), { loading: LazySectionFallback });
const AiFeedbackSettings = dynamic(() => import('@/components/AiFeedbackSettings'), { loading: LazySectionFallback });
const GuestFlowVisits = dynamic(() => import('@/components/GuestFlowVisits'), { loading: LazySectionFallback });
const GuestFlowDeviceAccess = dynamic(() => import('@/components/GuestFlowDeviceAccess'), { loading: LazySectionFallback });

const SectionBackArrow = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
  >
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
  </button>
);

const AdminBackButton = ({ onBack }) => (
  <button
    type="button"
    onClick={onBack}
    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
  >
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    Back to Admin
  </button>
);

const AnimatedCount = ({ value }) => {
  const targetValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 900;
    const startTime = performance.now();
    let frameId;
    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(targetValue * easedProgress));
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetValue]);

  return <span aria-live="polite">{displayValue.toLocaleString()}</span>;
};

const formatSummaryPercent = (value, denominator) => {
  if (!denominator) return '0%';
  return `${((value / denominator) * 100).toFixed(1).replace('.0', '')}%`;
};

const isBirthdayContacted = (client) => (
  (client.birthdayContactMethod && client.birthdayContactMethod !== 'not_contacted')
  || client.birthdayCallStatus === 'called'
  || client.birthdayCalledById
);

const isBirthdayOfferRedeemed = (client) => {
  const rawValue = client?.birthdayOfferRedeemedYear ?? client?.birthdayOfferRedeemed;
  if (rawValue === true || ['true', 'yes', 'redeemed'].includes(String(rawValue).trim().toLowerCase())) return true;
  const numericYear = Number(rawValue);
  if (Number.isFinite(numericYear) && numericYear >= 1900 && numericYear <= 2200) return true;
  return Boolean(client?.birthdayOfferRedeemedAt || client?.birthdayOfferRedeemedDate);
};

const SummaryPanel = ({ branches }) => {
  const now = new Date();
  const [birthdayMonth, setBirthdayMonth] = useState(now.getMonth() + 1);
  const [summaryBranch, setSummaryBranch] = useState('');
  const [birthdayMonthData, setBirthdayMonthData] = useState({ month: null, clients: [], error: false });

  useEffect(() => {
    let cancelled = false;
    getBirthdayClientsByMonth(birthdayMonth)
      .then((clients) => {
        if (!cancelled) setBirthdayMonthData({ month: birthdayMonth, clients, error: false });
      })
      .catch((error) => {
        console.error('Unable to load birthday summary:', error);
        if (!cancelled) setBirthdayMonthData({ month: birthdayMonth, clients: [], error: true });
      });
    return () => { cancelled = true; };
  }, [birthdayMonth]);

  const birthdayMonthLoading = birthdayMonthData.month !== birthdayMonth;
  const birthdayClients = useMemo(
    () => {
      if (birthdayMonthLoading || birthdayMonthData.error) return [];
      return summaryBranch
        ? birthdayMonthData.clients.filter((client) => client.branch === summaryBranch)
        : birthdayMonthData.clients;
    },
    [birthdayMonthData, birthdayMonthLoading, summaryBranch]
  );
  const birthdayMonthLabel = useMemo(() => new Date(2000, birthdayMonth - 1, 1).toLocaleDateString(undefined, { month: 'long' }), [birthdayMonth]);
  const contactedCount = useMemo(() => birthdayClients.filter(isBirthdayContacted).length, [birthdayClients]);
  const redeemedCount = useMemo(() => birthdayClients.filter(isBirthdayOfferRedeemed).length, [birthdayClients]);

  return (
    <section className="dashboard-summary rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">Birthday offers</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={summaryBranch} onChange={(event) => setSummaryBranch(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Summary branch">
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}
          </select>
          <select value={birthdayMonth} onChange={(event) => setBirthdayMonth(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Birthday month">
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })}</option>)}
          </select>
        </div>
      </div>
      {birthdayMonthLoading ? <p className="mt-5 text-sm text-slate-500">Loading birthday summary...</p> : birthdayMonthData.error ? (
        <p className="mt-5 text-sm text-rose-600" role="alert">Unable to load the birthday summary. Please refresh and try again.</p>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Offer redemptions compared with this month&apos;s birthday list and completed outreach.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right dark:bg-slate-800">
              <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"><AnimatedCount value={redeemedCount} /></div>
              <div className="text-xs font-medium text-slate-400">Redeemed</div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { label: `Birthday Babies in ${birthdayMonthLabel}`, value: birthdayClients.length, denominator: birthdayClients.length, percent: 100, color: 'bg-blue-400' },
              { label: 'Contacted', value: contactedCount, denominator: birthdayClients.length, percent: birthdayClients.length ? (contactedCount / birthdayClients.length) * 100 : 0, color: 'bg-pink-400' },
              { label: 'Redeemed offer (contacted or uncontacted)', value: redeemedCount, denominator: birthdayClients.length, percent: birthdayClients.length ? (redeemedCount / birthdayClients.length) * 100 : 0, color: 'bg-violet-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{item.label}</span><span className="shrink-0">{item.value} <span className="font-medium text-slate-400">({formatSummaryPercent(item.value, item.denominator)})</span></span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.color} transition-[width] duration-500`} style={{ width: `${Math.min(item.percent, 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500">{redeemedCount} total offer redemptions in the {birthdayMonthLabel} birthday population.</p>
        </div>
      )}
    </section>
  );
};

export default function Home() {
  const { user, profile } = useAuth();
  const isPageVisible = usePageVisibility();
  const {
    allClients: cachedAllClients,
    globalClients: cachedGlobalClients,
    branches: cachedBranches,
    todaysBirthdays: cachedTodaysBirthdays,
    allBirthdays: cachedAllBirthdays,
    gymEnrollments: cachedGymEnrollments,
    spaEnrollments: cachedSpaEnrollments,
    clientCountsByBranch: cachedClientCounts,
    birthdayCountsByBranch: cachedBirthdayCounts,
    birthdayCallers: cachedBirthdayCallers,
    patchClient,
    refreshBirthdayData,
    coreDataReady,
    clientDataLoaded,
    loadClientData,
    loadEnrollmentData,
    enrollmentDataLoaded,
    fullDataLoading: isFullDataLoading,
    activeGymEnrollmentCount,
    activeSpaEnrollmentCount,
    refreshData
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [globalClients, setGlobalClients] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [gymSubTab, setGymSubTab] = useState('overview');
  const [spaSubTab, setSpaSubTab] = useState('overview');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 20;
  const [dashboardClients, setDashboardClients] = useState([]);
  const [dashboardTotalCount, setDashboardTotalCount] = useState(0);
  const [dashboardHasMore, setDashboardHasMore] = useState(false);
  const [dashboardPageLoading, setDashboardPageLoading] = useState(false);
  const dashboardCursorsRef = useRef([]);
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [returnToAdmin, setReturnToAdmin] = useState(false);
  const [showBranchPrompt, setShowBranchPrompt] = useState(false);
  const [allBirthdays, setAllBirthdays] = useState([]);
  const [currentAffirmation, setCurrentAffirmation] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeNotesCount, setActiveNotesCount] = useState(0);
  const [birthdayReminderIndex, setBirthdayReminderIndex] = useState(null);
  const workspaceRestoredRef = useRef(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const isRootAdmin = user?.email?.toLowerCase() === 'alphacortexai@gmail.com';

  // Mobile browsers may suspend and later recreate this client component after a
  // phone call, app switch, or memory-pressure eviction. Keep the user's current
  // workspace in sessionStorage so a remount does not silently send them to Home.
  useEffect(() => {
    workspaceRestoredRef.current = false;
    setWorkspaceReady(false);
    setIsInitialLoading(true);
    setDataLoaded(false);
    setBranches([]);
    setAllBirthdays([]);
    setTodaysBirthdays([]);
    setAllClients([]);
    setGlobalClients([]);
    if (!user?.uid) return undefined;

    const storageKey = `spa-ems-workspace:${user.uid}`;
    try {
      const savedWorkspace = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
      if (savedWorkspace && typeof savedWorkspace === 'object') {
        if (typeof savedWorkspace.activeTab === 'string') setActiveTab(savedWorkspace.activeTab);
        if (typeof savedWorkspace.gymSubTab === 'string') setGymSubTab(savedWorkspace.gymSubTab);
        if (typeof savedWorkspace.spaSubTab === 'string') setSpaSubTab(savedWorkspace.spaSubTab);
        if (typeof savedWorkspace.selectedBranch === 'string') setSelectedBranch(savedWorkspace.selectedBranch);
        if (typeof savedWorkspace.selectedMonth === 'string') setSelectedMonth(savedWorkspace.selectedMonth);
        if (typeof savedWorkspace.selectedDay === 'string') setSelectedDay(savedWorkspace.selectedDay);
        if (Number.isInteger(savedWorkspace.currentPage) && savedWorkspace.currentPage > 0) setCurrentPage(savedWorkspace.currentPage);
        if (typeof savedWorkspace.showAdminSection === 'boolean') setShowAdminSection(savedWorkspace.showAdminSection);
        if (typeof savedWorkspace.returnToAdmin === 'boolean') setReturnToAdmin(savedWorkspace.returnToAdmin);
        if (typeof savedWorkspace.searchTerm === 'string') setSearchTerm(savedWorkspace.searchTerm);
      }
    } catch (error) {
      console.warn('Unable to restore workspace state:', error);
    } finally {
      workspaceRestoredRef.current = true;
      setWorkspaceReady(true);
    }

    return undefined;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !workspaceRestoredRef.current || !workspaceReady) return;
    const workspace = {
      activeTab,
      gymSubTab,
      spaSubTab,
      selectedBranch,
      selectedMonth,
      selectedDay,
      currentPage,
      showAdminSection,
      returnToAdmin,
      searchTerm,
      savedAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(`spa-ems-workspace:${user.uid}`, JSON.stringify(workspace));
    } catch (error) {
      console.warn('Unable to save workspace state:', error);
    }
  }, [user?.uid, workspaceReady, activeTab, gymSubTab, spaSubTab, selectedBranch, selectedMonth, selectedDay, currentPage, showAdminSection, returnToAdmin, searchTerm]);

  const handleExportAllClients = async () => {
    if (!isRootAdmin) return;
    const clients = globalClients.length ? globalClients : cachedGlobalClients;
    try {
      const [exportableClients, XLSX] = await Promise.all([
        clients.length ? Promise.resolve(clients) : loadClientData(),
        import('xlsx'),
      ]);
      if (!exportableClients.length) return;
      const formatDateOfBirth = (client) => {
        const month = Number(client.birthMonth);
        const day = Number(client.birthDay);
        if (!month || !day) return 'Not provided';
        return new Date(2000, month - 1, day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      };
      const rows = exportableClients.map((client) => ({
        'Name of Client': client.name || 'Not provided',
        'Date of Birth': formatDateOfBirth(client),
        Branch: client.branch || 'Not provided',
        'Phone Number': client.phoneNumber || 'Not provided',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 20 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'All Clients');
      XLSX.writeFile(workbook, `clients-database-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Unable to export clients:', error);
    }
  };

  useEffect(() => {
    if (!user) return;
    getActiveNotesCount(user, profile).then(setActiveNotesCount);
  }, [profile, user]);

  // Show the dashboard as soon as lightweight data is ready; large client lists load on demand.
  useEffect(() => {
    if (coreDataReady) {
      setBranches(cachedBranches);
      setAllBirthdays(cachedAllBirthdays);
      setTodaysBirthdays(selectedBranch ? cachedTodaysBirthdays.filter(c => c.branch === selectedBranch) : cachedTodaysBirthdays);
      if (clientDataLoaded) {
        setGlobalClients(cachedGlobalClients);
        setAllClients(selectedBranch ? cachedAllClients.filter(c => c.branch === selectedBranch) : cachedAllClients);
      }
      setIsInitialLoading(false);
      setDataLoaded(true);
    }
  }, [coreDataReady, clientDataLoaded, cachedBranches, cachedAllBirthdays, cachedGlobalClients, cachedAllClients, cachedTodaysBirthdays, selectedBranch]);

  useEffect(() => {
    if (['birthdays', 'birthday-analytics', 'reports', 'check-ins', 'new-clients-analytics', 'gym', 'spa'].includes(activeTab)) {
      void loadClientData();
    }
  }, [activeTab, loadClientData]);

  useEffect(() => {
    if (activeTab === 'gym' || activeTab === 'spa') void loadEnrollmentData();
  }, [activeTab, loadEnrollmentData]);

  const birthdayReminderMessages = useMemo(() => {
    const assignedBranches = Array.isArray(profile?.assignedBranches) ? profile.assignedBranches.filter(Boolean) : [];
    const branchNames = assignedBranches.length > 0
      ? assignedBranches
      : isRootAdmin
        ? branches.map((branch) => branch.name).filter(Boolean)
        : [];
    const birthdaySource = allBirthdays.length ? allBirthdays : cachedAllBirthdays;
    return branchNames.map((branchName) => {
      const branchBirthdays = birthdaySource.filter((client) => client.branch === branchName);
      const contactedCount = branchBirthdays.filter((client) => (
        client.birthdayContactMethod && client.birthdayContactMethod !== 'not_contacted'
      ) || client.birthdayCallStatus === 'called' || client.birthdayCalledById).length;
      return {
        branchName,
        totalCount: branchBirthdays.length,
        contactedCount,
        remainingCount: branchBirthdays.length - contactedCount,
      };
    }).filter((message) => message.totalCount > 0);
  }, [allBirthdays, branches, cachedAllBirthdays, isRootAdmin, profile?.assignedBranches]);

  useEffect(() => {
    setBirthdayReminderIndex(null);
    if (activeTab !== 'home' || birthdayReminderMessages.length === 0) return undefined;
    const reminderTimers = birthdayReminderMessages.map((_, index) => setTimeout(() => {
      setBirthdayReminderIndex(index);
    }, 20000 + (index * 15000)));
    const finishTimer = setTimeout(() => setBirthdayReminderIndex(null), 20000 + (birthdayReminderMessages.length * 15000));
    return () => {
      reminderTimers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [activeTab, birthdayReminderMessages]);

  // Handle back button
  useEffect(() => {
    // Only push state if it's different from current to avoid history bloat
    const currentState = window.history.state;
    if (!currentState || currentState.tab !== activeTab || currentState.gymSub !== gymSubTab || currentState.spaSub !== spaSubTab) {
      window.history.pushState({ tab: activeTab, gymSub: gymSubTab, spaSub: spaSubTab }, '');
    }

    const handlePopState = (event) => {
      const state = event.state;

      if (activeTab === 'home') {
        setShowExitConfirm(true);
        window.history.pushState({ tab: 'home', gymSub: 'overview', spaSub: 'overview' }, '');
        return;
      }

      if (state && state.tab) {
        setActiveTab(state.tab);
        setGymSubTab(state.gymSub ?? 'overview');
        setSpaSubTab(state.spaSub ?? 'overview');
        if (state.tab === 'home') setShowAdminSection(false);
        return;
      }

      // Fallback when state is null or missing (e.g. initial load or external back)
      if (activeTab === 'gym' && gymSubTab !== 'overview') {
        setGymSubTab('overview');
      } else if (activeTab === 'spa' && spaSubTab !== 'overview') {
        setSpaSubTab('overview');
      } else if (showAdminSection) {
        setShowAdminSection(false);
      } else {
        setActiveTab('home');
        setGymSubTab('overview');
        setSpaSubTab('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, gymSubTab, spaSubTab, showAdminSection]);

  const handleExitApp = () => {
    // In a web app, we can't truly "close" the window unless it was opened by script
    // But we can try or redirect to a blank page/close
    if (typeof window !== 'undefined') {
      window.close();
      // Fallback if window.close() is blocked
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
    }
  };

  useEffect(() => {
    if (!isPageVisible) return undefined;
    const getAffirmation = () => {
      const now = new Date();
      // Use 5-minute intervals for rotation
      const intervalIndex = Math.floor(now.getTime() / (5 * 60 * 1000));
      const index = intervalIndex % affirmations.length;
      return affirmations[index];
    };

    setCurrentAffirmation(getAffirmation());

    const interval = setInterval(() => {
      setCurrentAffirmation(getAffirmation());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isPageVisible]);

  const adminSubsectionTabs = ['upload', 'unrecognized', 'history', 'users', 'birthday-callers', 'branches', 'duplicates', 'timeline', 'caller-analytics', 'new-clients-analytics', 'check-in-analytics', 'guestflow-devices', 'feedback-attention', 'ai-settings', 'invoice-list'];

  const openAdminTool = (tab) => {
    setReturnToAdmin(true);
    setShowAdminSection(true);
    setActiveTab(tab);
  };

  const openAdminOverview = () => {
    setActiveTab('home');
    setShowAdminSection(true);
    setReturnToAdmin(false);
  };

  const selectWorkspaceTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setShowAdminSection(false);
      setReturnToAdmin(false);
    }
  }, []);

  const goBackFromSection = () => {
    const shouldReturnToAdmin = returnToAdmin || adminSubsectionTabs.includes(activeTab);
    if (shouldReturnToAdmin) {
      openAdminOverview();
      return;
    }
    setActiveTab('home');
    setShowAdminSection(false);
    setReturnToAdmin(false);
  };

  useEffect(() => {
    if (activeTab !== 'home' && !returnToAdmin) setShowAdminSection(false);

    if (activeTab === 'birthdays' && coreDataReady) {
      const defaultBranch = localStorage.getItem('defaultBirthdayBranch');
      if (defaultBranch && !selectedBranch) {
        setSelectedBranch(defaultBranch);
      } else if (!defaultBranch && !selectedBranch) {
        setShowBranchPrompt(true);
      }
    }

    // Only reset page if we're actually switching to a list view
    if (['dashboard', 'birthdays', 'unrecognized'].includes(activeTab)) {
      setCurrentPage(1);
      if (activeTab === 'dashboard') dashboardCursorsRef.current = [];
    }
  }, [activeTab, selectedBranch, returnToAdmin, coreDataReady]);

  const handleSetDefaultBranch = (branchName) => {
    localStorage.setItem('defaultBirthdayBranch', branchName);
    setSelectedBranch(branchName);
    setShowBranchPrompt(false);
  };

  const loadDashboardPage = useCallback(async (page, branch, search) => {
    setDashboardPageLoading(true);
    try {
      if (search.trim()) {
        const results = await searchClients(search, branch || null);
        setDashboardClients(results || []);
        setDashboardTotalCount((results || []).length);
        setDashboardHasMore(false);
        return;
      }
      const cursor = page > 1 ? dashboardCursorsRef.current[page - 2] : null;
      const result = await getClientsPage(branch || null, clientsPerPage, cursor);
      dashboardCursorsRef.current[page - 1] = result.cursor;
      dashboardCursorsRef.current.length = page;
      setDashboardClients(result.clients);
      setDashboardTotalCount(result.totalCount);
      setDashboardHasMore(result.hasMore);
    } catch (error) {
      console.error('Client database loading error:', error);
      setDashboardClients([]);
      setDashboardTotalCount(0);
      setDashboardHasMore(false);
    } finally {
      setDashboardPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const timeoutId = setTimeout(() => {
      void loadDashboardPage(currentPage, selectedBranch, searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [activeTab, currentPage, selectedBranch, searchTerm, loadDashboardPage]);

  const refreshDashboardPage = useCallback(async () => {
    if (activeTab === 'dashboard') {
      await loadDashboardPage(currentPage, selectedBranch, searchTerm);
    }
    await refreshData();
  }, [activeTab, currentPage, loadDashboardPage, refreshData, searchTerm, selectedBranch]);

  // Handle search with debouncing for other client-dependent sections
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const branch = selectedBranch || null;
        const results = await searchClients(searchTerm, branch);
        setSearchResults(results || []);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
        setCurrentPage(1);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [allClients, cachedAllClients, searchTerm, selectedBranch]);

  const filteredBirthdays = useMemo(() => {
    // Use all clients for month/day searches, today’s branch-filtered birthdays for a specific branch, and the unfiltered birthday dataset for all branches.
    const useAllClients = selectedMonth || selectedDay;
    const baseClients = useAllClients ? allClients : (selectedBranch ? todaysBirthdays : allBirthdays);
    return baseClients.filter((client) => {
      const monthMatch = !selectedMonth || (client.birthMonth && parseInt(client.birthMonth) === parseInt(selectedMonth));
      const dayMatch = !selectedDay || (client.birthDay && parseInt(client.birthDay) === parseInt(selectedDay));
      const branchMatch = !selectedBranch || (client.branch === selectedBranch);
      return monthMatch && dayMatch && branchMatch;
    });
  }, [todaysBirthdays, allBirthdays, allClients, selectedMonth, selectedDay, selectedBranch]);

  const isFullDatasetLoading = !clientDataLoaded || (isFullDataLoading && cachedAllClients.length === 0);

  const activeGymMembers = useMemo(() => {
    if (typeof activeGymEnrollmentCount === 'number') return activeGymEnrollmentCount;
    return cachedGymEnrollments.filter(e => e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= new Date()).length;
  }, [activeGymEnrollmentCount, cachedGymEnrollments]);

  const activeSpaMembers = useMemo(() => {
    if (typeof activeSpaEnrollmentCount === 'number') return activeSpaEnrollmentCount;
    return cachedSpaEnrollments.filter(e => e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= new Date()).length;
  }, [activeSpaEnrollmentCount, cachedSpaEnrollments]);

  const getBranchInitials = (name) => {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Optimized badge calculations using pre-computed counts
  // For centerBadge (large display), show total count
  // For regular badge (small corner), show branch breakdown
  const clientBadgeTotal = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedClientCounts && Object.keys(cachedClientCounts).length > 0) {
      if (typeof cachedClientCounts.total === 'number') return cachedClientCounts.total.toString();
      return Object.values(cachedClientCounts).reduce((sum, count) => sum + count, 0).toString();
    }

    // Fallback to counting from array
    return globalClients.length.toString();
  }, [cachedClientCounts, globalClients]);

  const clientBadge = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedClientCounts && Object.keys(cachedClientCounts).length > 0 && branches.length > 0) {
      return branches
        .map(b => {
          const count = cachedClientCounts[b.name] || 0;
          return count > 0 ? `${getBranchInitials(b.name)}: ${count}` : null;
        })
        .filter(Boolean)
        .join(', ') || '0';
    }

    // Fallback to counting from array (slower, but works if counts not loaded)
    if (!branches.length || !globalClients.length) {
      return globalClients.length.toString();
    }

    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    globalClients.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => count > 0 ? `${getBranchInitials(name)}: ${count}` : null)
      .filter(Boolean)
      .join(', ') || '0';
  }, [cachedClientCounts, globalClients, branches]);

  const birthdayBadgeTotal = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedBirthdayCounts && Object.keys(cachedBirthdayCounts).length > 0) {
      // The aggregate includes a `total` as well as per-branch subtotals.
      // Adding every value counts the same birthdays twice.
      if (Number.isFinite(cachedBirthdayCounts.total)) {
        return cachedBirthdayCounts.total.toString();
      }
      return Object.entries(cachedBirthdayCounts)
        .filter(([key]) => key !== 'total')
        .reduce((sum, [, count]) => sum + (Number(count) || 0), 0)
        .toString();
    }

    // Fallback to counting from array
    return allBirthdays.length.toString();
  }, [cachedBirthdayCounts, allBirthdays]);

  const birthdayBadge = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedBirthdayCounts && Object.keys(cachedBirthdayCounts).length > 0 && branches.length > 0) {
      return branches
        .map(b => {
          const count = cachedBirthdayCounts[b.name] || 0;
          return count > 0 ? `${getBranchInitials(b.name)}: ${count}` : null;
        })
        .filter(Boolean)
        .join(', ') || '0';
    }

    // Fallback to counting from array (slower)
    if (!branches.length || !allBirthdays.length) {
      return allBirthdays.length.toString();
    }

    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    allBirthdays.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => count > 0 ? `${getBranchInitials(name)}: ${count}` : null)
      .filter(Boolean)
      .join(', ') || '0';
  }, [cachedBirthdayCounts, allBirthdays, branches]);

  const getPaginatedClients = (list) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return list.slice(startIndex, startIndex + clientsPerPage);
  };

  const getTotalPages = (list) => Math.ceil(list.length / clientsPerPage);

  return (
    <ProtectedRoute>
      <div className="dashboard-shell min-h-screen text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
        {/* Exit Confirmation Modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 text-2xl">
                  🚪
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Exit App?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Are you sure you want to exit the application?</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExitApp}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/20 transition-all"
                >
                  Yes, Exit
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="dashboard-frame">
        {/* Navigation */}
        <header className="dashboard-nav border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="relative flex min-h-16 flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto sm:flex-nowrap sm:gap-8">
              <button onClick={() => setActiveTab('home')} aria-label="Go to home" className="flex items-center gap-3 group">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-20">
                    <Image src="/logo1.png" alt="Logo 1" fill className="object-contain p-1" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-10">
                    <Image src="/logo2.png" alt="Logo 2" fill className="object-contain p-1" />
                  </div>
                </div>
                <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Spa EMS</span>
              </button>

                <nav aria-label="Primary navigation" className="mobile-primary-nav order-3 flex basis-full items-center gap-1 overflow-x-auto pb-0.5 sm:order-none sm:w-auto sm:basis-auto sm:max-w-[58vw]">
                {['home', 'dashboard', 'check-ins', 'birthdays', 'reports', 'gym', 'spa', 'profile'].map((tab) => {
                  // Check permissions for each tab
                  if (tab === 'check-ins' && profile?.role !== 'Admin' && profile?.permissions?.clients?.view !== true) return null;
                  if (tab === 'dashboard' && profile?.permissions?.clients?.view === false) return null;
                  if (tab === 'birthdays' && profile?.permissions?.birthdays?.view === false) return null;
                  if (tab === 'gym' && profile?.permissions?.gym?.view === false) return null;
                  if (tab === 'spa' && profile?.permissions?.spa?.view === false) return null;

                  const navLabel = tab === 'gym' ? 'GYM' : tab === 'spa' ? 'SPA' : tab === 'check-ins' ? 'Check-ins' : tab === 'reports' ? 'Reports & Feedback' : tab.charAt(0).toUpperCase() + tab.slice(1);
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`mobile-primary-nav-link px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <span className="mobile-primary-nav-label">{navLabel}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="w-8 h-8 rounded-full bg-[#4f6ef7] text-white flex items-center justify-center font-semibold text-xs relative">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    {profile?.role === 'Admin' && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 border-2 border-white dark:border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <span className="hidden max-w-[9rem] truncate text-sm font-semibold text-slate-800 dark:text-slate-100 sm:inline">{user.displayName?.split(' ')[0] || 'Account'}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-md uppercase tracking-wider">
                            {profile?.role || 'General'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { setActiveTab('profile'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                          My Profile
                        </button>
                        <button
                          onClick={async () => { await signOut(); window.location.href = '/auth/signin'; }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {isInitialLoading && !workspaceReady ? (
            <div className="mx-auto max-w-2xl py-16">
              <LoadingState title="Preparing your dashboard..." description="Loading your workspaces and latest information." />
            </div>
          ) : (
          <div className={`dashboard-page-layout grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] ${activeTab === 'home' && !showAdminSection && !(profile?.preferences?.nviewEnabled && profile?.role === 'Admin') ? 'dashboard-home-shell' : ''}`}>
            <div className="dashboard-desktop-rail"><WorkspaceRail activeTab={activeTab} setActiveTab={selectWorkspaceTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} /></div>
            <div className="dashboard-page-content min-w-0">
          {(activeTab !== 'home' || showAdminSection) && <div className="mobile-quick-actions mobile-quick-actions-global">
            <WorkspaceRail activeTab={activeTab} setActiveTab={selectWorkspaceTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} />
          </div>}
          {activeTab === 'home' && profile?.preferences?.nviewEnabled && profile?.role === 'Admin' ? (
            <NviewDashboard />
          ) : activeTab === 'home' && (
            <div className="dashboard-reveal min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!showAdminSection && <section className="dashboard-greeting px-1 pt-1">
                <div className="min-w-0">
                  {birthdayReminderIndex === null ? (
                    <TypedGreeting firstName={user?.displayName?.split(' ')[0] || 'there'} />
                  ) : (
                    <div key={`${birthdayReminderMessages[birthdayReminderIndex].branchName}-${birthdayReminderMessages[birthdayReminderIndex].contactedCount}-${birthdayReminderMessages[birthdayReminderIndex].remainingCount}`} className="animate-in fade-in duration-500" aria-live="polite">
                      <TypedBirthdayReminder contactedCount={birthdayReminderMessages[birthdayReminderIndex].contactedCount} remainingCount={birthdayReminderMessages[birthdayReminderIndex].remainingCount} branchName={birthdayReminderMessages[birthdayReminderIndex].branchName} />
                    </div>
                  )}
                  <p className="dashboard-greeting-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}.</p>
                </div>
              </section>}

              {!showAdminSection && <div className="mobile-quick-actions">
                <WorkspaceRail activeTab={activeTab} setActiveTab={selectWorkspaceTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} />
              </div>}

                  {!showAdminSection ? (
                <>
                <section>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {profile?.permissions?.clients?.view !== false && (
                    <NavCard onClick={() => setActiveTab('dashboard')} title="Clients" description="In the database" metric={cachedClientCounts ? clientBadgeTotal : (dataLoaded ? '...' : '—')} accentCard={profile?.permissions?.gym?.view === false} />
                  )}
                  {profile?.permissions?.birthdays?.view !== false && (
                    <NavCard onClick={() => setActiveTab('birthdays')} title="Birthdays" description="Celebrating today" metric={cachedBirthdayCounts ? birthdayBadgeTotal : (dataLoaded ? '...' : '—')} />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard onClick={() => setActiveTab('gym')} title="GYM" description="Active members" metric={dataLoaded ? activeGymMembers : '—'} accentCard />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard onClick={() => setActiveTab('spa')} title="SPA" description="Active members" metric={dataLoaded ? activeSpaMembers : '—'} />
                  )}
                  </div>
                </section>
                <div className="hidden md:block">
                  <SummaryPanel branches={branches} />
                </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3"><SectionBackArrow onClick={() => setShowAdminSection(false)} label="Back to Home" /><h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Admin tools</h2></div>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Imports, audits, locations, users, and billing.</p>
                    </div>
                    <button onClick={() => setShowAdminSection(false)} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Back to main</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {profile?.permissions?.clients?.add !== false && (
                      <NavCard onClick={() => openAdminTool('upload')} icon={<QuickActionIcon name="upload" />} title="Upload" description="Bulk data import." accent="blue" eyebrow="Import" />
                    )}
                    {profile?.permissions?.clients?.edit !== false && (
                      <NavCard onClick={() => openAdminTool('unrecognized')} icon={<QuickActionIcon name="issues" />} title="Issues" description="Fix failed imports." accent="amber" eyebrow="Review" />
                    )}
                    {profile?.permissions?.clients?.view !== false && (
                      <NavCard onClick={() => openAdminTool('history')} icon={<QuickActionIcon name="history" />} title="History" description="View upload logs." accent="slate" eyebrow="Audit" />
                    )}
                    {profile?.permissions?.users?.view !== false && (
                      <NavCard onClick={() => openAdminTool('users')} icon={<QuickActionIcon name="users" />} title="Users" description="Manage roles." accent="violet" eyebrow="Access" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('birthday-callers')} icon={<QuickActionIcon name="birthdays" />} title="Birthday Callers" description="Manage call names." accent="rose" eyebrow="Marketing" />
                    )}
                    {profile?.permissions?.branches?.view !== false && (
                      <NavCard onClick={() => openAdminTool('branches')} icon={<QuickActionIcon name="branches" />} title="Branches" description="Manage locations." badge={dataLoaded ? branches.length : undefined} accent="emerald" eyebrow="Network" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('duplicates')} icon={<QuickActionIcon name="duplicates" />} title="Duplicates" description="Find duplicate phones." accent="rose" eyebrow="Cleanse" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('timeline')} icon={<QuickActionIcon name="timeline" />} title="Timeline" description="Activity logs." accent="blue" eyebrow="Monitor" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('caller-analytics')} icon={<QuickActionIcon name="analytics" />} title="Caller Analytics" description="Birthday, feedback and WhatsApp totals." accent="violet" eyebrow="Reporting" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('new-clients-analytics')} icon={<QuickActionIcon name="analytics" />} title="New Clients Analytics" description="Clients added in a selected period." accent="emerald" eyebrow="Reporting" />
                    )}
                    {isRootAdmin && (
                      <NavCard onClick={() => openAdminTool('check-in-analytics')} icon={<QuickActionIcon name="analytics" />} title="Check-in Analytics" description="Clients per day, compared by branch." accent="blue" eyebrow="Top admin only" />
                    )}
                    {isRootAdmin && (
                      <NavCard onClick={() => openAdminTool('guestflow-devices')} icon={<QuickActionIcon name="admin" />} title="GuestFlow Devices" description="Approve branch check-in phones and tablets." accent="emerald" eyebrow="Top admin only" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('feedback-attention')} icon={<QuickActionIcon name="issues" />} title="Feedback Attention" description="Find client feedback that may need follow-up." accent="rose" eyebrow="AI review" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('ai-settings')} icon={<QuickActionIcon name="analytics" />} title="AI Key Settings" description="Securely add or replace the AI provider key." accent="violet" eyebrow="Configuration" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('invoice-list')} icon={<QuickActionIcon name="invoices" />} title="All Invoices" description="View, search and recreate PDFs." accent="emerald" eyebrow="Finance" />
                    )}
                    {isRootAdmin && (
                      <NavCard onClick={handleExportAllClients} icon={<QuickActionIcon name="export" />} title="Export Clients" description="Download the complete database." accent="blue" eyebrow="Root admin only" badge={globalClients.length ? globalClients.length : undefined} />
                    )}
                  </div>
                </div>
              )}
                {!showAdminSection && <p className="dashboard-quote">“{currentAffirmation}”</p>}
              </div>
          )}

          {activeTab === 'reports' && (
            <ReportsSection
              user={user}
              profile={profile}
              clients={globalClients.length ? globalClients : cachedGlobalClients}
              clientsLoading={!clientDataLoaded}
              birthdayCallers={cachedBirthdayCallers}
              onBack={goBackFromSection}
            />
          )}

          {activeTab === 'check-ins' && (profile?.role === 'Admin' || profile?.permissions?.clients?.view === true) && (
            <GuestFlowVisits
              onBack={() => setActiveTab('home')}
              clients={globalClients.length ? globalClients : cachedGlobalClients}
              branches={branches.length ? branches : cachedBranches}
            />
          )}

          {activeTab === 'notes' && (
            <NotesSection onActiveCountChange={setActiveNotesCount} onBack={goBackFromSection} />
          )}

          {activeTab === 'invoice-list' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">All Invoices</h2>
                  <p className="text-slate-500 mt-1">View invoice records, search by number, client or phone, and recreate PDFs. Admin only.</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceList />
            </div>
          )}

          {activeTab === 'invoice-tracking' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Admin" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Invoice Tracking</h2></div>
                  <p className="text-slate-500 mt-1">Import invoices, track status (Issued, Sent to client, Completed) and upload proof of payment. Managers and Admins.</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceTracking />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Client workspace</p><div className="mt-1 flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Home" /><h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Client Database</h2></div><p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">Search, filter, and manage every client record from one place.</p></div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  {profile?.permissions?.clients?.add !== false && (
                    <button onClick={() => setActiveTab('add-client')} className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Add Client
                    </button>
                  )}
                </div>
              </div>

              <div className="dashboard-surface rounded-[24px] p-3 sm:p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  {isSearching ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search by name or phone number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg"
                />
              </div>
              </div>

              <ClientList
                clients={dashboardClients}
                totalCount={dashboardTotalCount}
                title={searchTerm ? `Search Results for "${searchTerm}"` : "All Clients"}
                onClientUpdated={refreshDashboardPage}
                onClientPatched={patchClient}
                isLoading={isInitialLoading || dashboardPageLoading}
                disableLocalSearch
              />

              {!searchTerm && dashboardTotalCount > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Page {currentPage} of {Math.max(1, Math.ceil(dashboardTotalCount / clientsPerPage))}
                  </span>
                  <button
                    disabled={!dashboardHasMore}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'birthday-analytics' && (
            <BirthdayCommunicationsAnalytics
              clients={globalClients.length ? globalClients : cachedGlobalClients}
              branches={branches.length ? branches : cachedBranches}
              birthdayCallers={cachedBirthdayCallers}
              isLoading={!clientDataLoaded}
              onBack={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'birthdays' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {showBranchPrompt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Set Default Branch</h3>
                      <p className="text-sm text-slate-500 mt-1">Select a branch to show birthdays for by default.</p>
                    </div>
                    <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                      <button
                        onClick={() => handleSetDefaultBranch('')}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 font-medium"
                      >
                        All Branches
                      </button>
                      {branches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => handleSetDefaultBranch(branch.name)}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 font-medium"
                        >
                          {branch.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                      <button
                        onClick={() => setShowBranchPrompt(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Home" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Birthdays</h2></div>
                  <p className="text-slate-500 mt-1">Celebrate with your customers.</p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Branches</option>
                      {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Months</option>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Days</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50/80 via-white to-lime-50/80 p-4 dark:border-slate-800 dark:from-pink-950/20 dark:via-slate-900 dark:to-lime-950/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600 dark:text-pink-300">Contact verification</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-pink-200 align-middle" />Pink means a call or message has been recorded. <span className="ml-2 mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-200 align-middle" />Amber means the number was unavailable and not on WhatsApp. <span className="ml-2 mr-1 inline-block h-2.5 w-2.5 rounded-full bg-lime-200 align-middle" />Lemon green means the client has not been contacted yet. Choose <strong>Called</strong>, <strong>Message sent</strong>, <strong>Called + message sent</strong>, or <strong>Unavailable / Not on WhatsApp</strong>.</p>
                </div>
                {profile?.role === 'Admin' && <button type="button" onClick={() => openAdminTool('birthday-callers')} className="shrink-0 rounded-xl border border-pink-200 bg-white px-3.5 py-2 text-xs font-black text-pink-700 shadow-sm transition hover:bg-pink-50 dark:border-pink-900/50 dark:bg-slate-900 dark:text-pink-200 dark:hover:bg-pink-950/30">Manage caller names</button>}
              </div>
              <ClientList
                clients={getPaginatedClients(filteredBirthdays)}
                totalCount={filteredBirthdays.length}
                title={selectedMonth || selectedDay ? "Filtered Birthdays" : "Today's Birthdays"}
                onClientUpdated={refreshBirthdayData}
                onClientPatched={patchClient}
                birthdayCallers={cachedBirthdayCallers}
                isBirthdayView
                isLoading={isInitialLoading || ((selectedMonth || selectedDay) && isFullDatasetLoading)}
              />

              {filteredBirthdays.length > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Page {currentPage} of {getTotalPages(filteredBirthdays)}</span>
                  <button
                    disabled={currentPage === getTotalPages(filteredBirthdays)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
                  <p className="text-slate-500 mt-1">Import clients from Excel files.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <ExcelUpload onClientsAdded={refreshData} />
            </div>
          )}

          {activeTab === 'unrecognized' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Data Issues</h2>
                  <p className="text-slate-500 mt-1">Fix clients with unrecognized phone numbers.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UnrecognizedClientsList onApproved={refreshData} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Upload History</h2>
                  <p className="text-slate-500 mt-1">Track and manage your data imports.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UploadHistory />
            </div>
          )}

          {activeTab === 'add-client' && (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Add New Client</h2>
                <p className="text-slate-500 mt-1">Register a new customer to the system.</p>
              </div>
              <ClientForm onClientAdded={() => { refreshData(); setActiveTab('dashboard'); }} />
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Branch Management</h2>
                  <p className="text-slate-500 mt-1">Manage your business locations.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <BranchForm onBranchAdded={refreshData} />
            </div>
          )}

          {activeTab === 'birthday-callers' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Birthday Callers</h2>
                  <p className="mt-1 text-slate-500">Set the marketing and management names that staff can use to verify birthday calls.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <BirthdayCallersManager onChanged={refreshData} />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h2>
                  <p className="mt-1 text-slate-500">Manage access, roles, and branch assignments.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UserManagement />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Activity Timeline</h2>
                  <p className="text-slate-500 mt-1">Track all system actions and changes.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <ActionsTimeline />
            </div>
          )}

          {activeTab === 'caller-analytics' && profile?.role === 'Admin' && (
            <CallerAnalyticsAdmin profile={profile} onBack={goBackFromSection} />
          )}
          {activeTab === 'new-clients-analytics' && profile?.role === 'Admin' && (
            <NewClientsAnalyticsAdmin
              clients={globalClients.length ? globalClients : cachedGlobalClients}
              loadClientData={loadClientData}
              onBack={goBackFromSection}
            />
          )}
          {activeTab === 'check-in-analytics' && isRootAdmin && (
            <CheckInAnalyticsAdmin user={user} profile={profile} onBack={goBackFromSection} />
          )}
          {activeTab === 'guestflow-devices' && isRootAdmin && (
            <GuestFlowDeviceAccess user={user} onBack={goBackFromSection} />
          )}

          {activeTab === 'feedback-attention' && profile?.role === 'Admin' && (
            <FeedbackAttentionAdmin user={user} profile={profile} onBack={goBackFromSection} onOpenSettings={() => openAdminTool('ai-settings')} />
          )}

          {activeTab === 'ai-settings' && profile?.role === 'Admin' && (
            <AiFeedbackSettings user={user} profile={profile} onBack={goBackFromSection} />
          )}

          {activeTab === 'duplicates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Duplicate Search</h2>
                  <p className="text-slate-500 mt-1">Find and resolve duplicate client records.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <DuplicateSearch onMerged={refreshData} />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <UserProfile />
            </div>
          )}

          {activeTab === 'gym' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <SectionBackArrow onClick={() => gymSubTab === 'overview' ? setActiveTab('home') : setGymSubTab('overview')} label={gymSubTab === 'overview' ? 'Back to Home' : 'Back to Overview'} />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{gymSubTab === 'client-contacts' ? 'Gym directory' : 'GYM Memberships'}</h2>
                  </div>
                  <p className="text-slate-500">
                    {gymSubTab === 'overview' ? 'Manage membership types and client enrollments.' :
                     gymSubTab === 'create-type' ? 'Define new membership packages.' :
                     gymSubTab === 'partner-companies' ? 'Manage companies available on invoices.' :
                     gymSubTab === 'enroll' ? 'Register a client for a membership.' :
                     gymSubTab === 'client-contacts' ? 'Client contact details.' : 'View active gym members.'}
                  </p>
                </div>
              </div>

              {gymSubTab === 'overview' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('create-type')}
                      icon={<QuickActionIcon name="create" />}
                      title="Create Type"
                      description="Define new membership packages."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setGymSubTab('manage-types')}
                      icon={<QuickActionIcon name="manage" />}
                      title="Manage Types"
                      description="Edit or delete membership types."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setGymSubTab('partner-companies')}
                      icon={<QuickActionIcon name="partner" />}
                      title="Partner Companies"
                      description="Manage invoice company options."
                    />
                  )}
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('enroll')}
                      icon={<QuickActionIcon name="enroll" />}
                      title="Enroll Client"
                      description="Enroll a client in a Membership."
                    />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('active-members')}
                      icon={<QuickActionIcon name="active" />}
                      title="Active Members"
                      description="View and manage active memberships."
                    />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('client-contacts')}
                      icon={<QuickActionIcon name="clients" />}
                      title="Client Contacts"
                      description="Names, phone numbers, memberships, and status."
                      accent="blue"
                    />
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {gymSubTab === 'create-type' && (
                    <div className="max-w-2xl mx-auto">
                      <MembershipForm onMembershipAdded={() => setGymSubTab('overview')} />
                    </div>
                  )}
                  {gymSubTab === 'manage-types' && (
                    <div className="max-w-4xl mx-auto">
                      <MembershipTypeManager />
                    </div>
                  )}
                  {gymSubTab === 'partner-companies' && (
                    <div className="max-w-4xl mx-auto">
                      <PartnerCompanyManager />
                    </div>
                  )}
                  {gymSubTab === 'enroll' && (
                    <div className="max-w-2xl mx-auto">
                      <EnrollmentForm onEnrolled={() => setGymSubTab('active-members')} />
                    </div>
                  )}
                  {gymSubTab === 'active-members' && (
                    <MembershipList />
                  )}
                  {gymSubTab === 'client-contacts' && (
                    <MembershipContactsDirectory
                      serviceName="Gym"
                      enrollments={cachedGymEnrollments}
                      clients={globalClients.length ? globalClients : cachedGlobalClients}
                      isLoading={!enrollmentDataLoaded || !clientDataLoaded}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'spa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <SectionBackArrow onClick={() => spaSubTab === 'overview' ? setActiveTab('home') : setSpaSubTab('overview')} label={spaSubTab === 'overview' ? 'Back to Home' : 'Back to Overview'} />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{spaSubTab === 'client-contacts' ? 'Spa directory' : 'SPA Memberships'}</h2>
                  </div>
                  <p className="text-slate-500">
                    {spaSubTab === 'overview' ? 'Manage spa membership types and client enrollments.' :
                     spaSubTab === 'create-type' ? 'Define new spa membership packages.' :
                     spaSubTab === 'enroll' ? 'Register a client for a spa membership.' :
                     spaSubTab === 'client-contacts' ? 'Client contact details.' : 'View active spa members.'}
                  </p>
                </div>
              </div>

              {spaSubTab === 'overview' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('create-type')}
                      icon={<QuickActionIcon name="spa" />}
                      title="Create Type"
                      description="Define new spa membership packages."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setSpaSubTab('manage-types')}
                      icon={<QuickActionIcon name="manage" />}
                      title="Manage Types"
                      description="Edit or delete spa membership types."
                    />
                  )}
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('enroll')}
                      icon={<QuickActionIcon name="enroll" />}
                      title="Enroll Client"
                      description="Enroll a client in a spa membership."
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('active-members')}
                      icon={<QuickActionIcon name="active" />}
                      title="Active Members"
                      description="View and manage active spa memberships."
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('client-contacts')}
                      icon={<QuickActionIcon name="clients" />}
                      title="Client Contacts"
                      description="Names, phone numbers, memberships, and status."
                      accent="violet"
                    />
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {spaSubTab === 'create-type' && (
                    <div className="max-w-2xl mx-auto">
                      <SpaMembershipForm onMembershipAdded={() => setSpaSubTab('overview')} />
                    </div>
                  )}
                  {spaSubTab === 'manage-types' && (
                    <div className="max-w-4xl mx-auto">
                      <SpaMembershipTypeManager />
                    </div>
                  )}
                  {spaSubTab === 'enroll' && (
                    <div className="max-w-2xl mx-auto">
                      <SpaEnrollmentForm onEnrolled={() => setSpaSubTab('active-members')} />
                    </div>
                  )}
                  {spaSubTab === 'active-members' && (
                    <SpaMembershipList />
                  )}
                  {spaSubTab === 'client-contacts' && (
                    <MembershipContactsDirectory
                      serviceName="Spa"
                      enrollments={cachedSpaEnrollments}
                      clients={globalClients.length ? globalClients : cachedGlobalClients}
                      isLoading={!enrollmentDataLoaded || !clientDataLoaded}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Admin" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Proforma Invoice Generator</h2></div>
                  <p className="text-slate-500 mt-1">Create invoices for GYM and SPA (PE &amp; SSS).</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceGenerator />
            </div>
          )}
            </div>
          </div>
          )}
        </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
