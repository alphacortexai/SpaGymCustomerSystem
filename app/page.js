'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { signOut } from '@/lib/auth';
import ClientForm from '@/components/ClientForm';
import ClientList from '@/components/ClientList';
import ExcelUpload from '@/components/ExcelUpload';
import { searchClients, getTodaysBirthdays, getAllClients } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';
import { affirmations } from '@/lib/affirmations';
import ProtectedRoute from '@/components/ProtectedRoute';
import BranchForm from '@/components/BranchForm';
import UnrecognizedClientsList from '@/components/UnrecognizedClientsList';
import UploadHistory from '@/components/UploadHistory';
import MembershipForm from '@/components/MembershipForm';
import MembershipTypeManager from '@/components/MembershipTypeManager';
import EnrollmentForm from '@/components/EnrollmentForm';
import MembershipList from '@/components/MembershipList';
import SpaMembershipForm from '@/components/SpaMembershipForm';
import SpaMembershipTypeManager from '@/components/SpaMembershipTypeManager';
import SpaEnrollmentForm from '@/components/SpaEnrollmentForm';
import SpaMembershipList from '@/components/SpaMembershipList';
import UserManagement from '@/components/UserManagement';
import UserProfile from '@/components/UserProfile';
import ActionsTimeline from '@/components/ActionsTimeline';
import DuplicateSearch from '@/components/DuplicateSearch';

const NavCard = ({ onClick, icon, title, description, badge, isImage, fullBg, centerBadge }) => {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center p-4 ${fullBg ? 'bg-transparent' : 'bg-white dark:bg-slate-900'} border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 text-center w-full aspect-square overflow-hidden`}
    >
      {fullBg && isImage && (
        <div className="absolute inset-0 z-0">
          <Image src={icon} alt={title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-1" />
        </div>
      )}
      {badge !== undefined && (
        <div className={centerBadge 
          ? "absolute inset-0 flex items-center justify-center z-10" 
          : "absolute top-3 right-3 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg shadow-blue-500/30 z-10"
        }>
          <div className={centerBadge 
            ? "text-white text-4xl md:text-5xl font-black drop-shadow-lg" 
            : ""
          }>
            {badge}
          </div>
        </div>
      )}
      {!fullBg && (
        <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors duration-300 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 flex items-center justify-center overflow-hidden">
          {isImage ? (
            <div className="w-8 h-8 relative">
              <Image src={icon} alt={title} fill className="object-contain" />
            </div>
          ) : (
            <span className="text-xl">{icon}</span>
          )}
        </div>
      )}
      <div className={`relative z-10 ${fullBg ? 'mt-auto' : ''}`}>
        <h3 className={`text-lg font-bold ${fullBg ? 'text-white' : 'text-slate-900 dark:text-white'} mb-1`}>{title}</h3>
        <p className={`text-sm ${fullBg ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'} leading-tight line-clamp-2 px-1`}>{description}</p>
      </div>
    </button>
  );
};

export default function Home() {
  const { user, profile } = useAuth();
  const { 
    allClients: cachedAllClients, 
    globalClients: cachedGlobalClients, 
    branches: cachedBranches, 
    todaysBirthdays: cachedTodaysBirthdays, 
    allBirthdays: cachedAllBirthdays,
    gymEnrollments: cachedGymEnrollments,
    spaEnrollments: cachedSpaEnrollments,
    loading: isDataLoading
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [globalClients, setGlobalClients] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
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
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [showBranchPrompt, setShowBranchPrompt] = useState(false);
  const [allBirthdays, setAllBirthdays] = useState([]);
  const [currentAffirmation, setCurrentAffirmation] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Sync with cached data
  useEffect(() => {
    if (!isDataLoading && cachedBranches.length > 0) {
      setBranches(cachedBranches);
      setAllBirthdays(cachedAllBirthdays);
      setGlobalClients(cachedGlobalClients);
      
      if (!selectedBranch) {
        setAllClients(cachedAllClients);
        setTodaysBirthdays(cachedTodaysBirthdays);
      }
      setIsInitialLoading(false);
      setDataLoaded(true);
    }
  }, [isDataLoading, cachedBranches, cachedAllBirthdays, cachedGlobalClients, cachedAllClients, cachedTodaysBirthdays, selectedBranch]);

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
        // Push state back to prevent actual back navigation
        window.history.pushState({ tab: 'home' }, '');
      } else {
        if (state && state.tab) {
          // If we have state, use it
          setActiveTab(state.tab);
          if (state.gymSub) setGymSubTab(state.gymSub);
          if (state.spaSub) setSpaSubTab(state.spaSub);
        } else {
          // Fallback logic
          if (activeTab === 'gym' && gymSubTab !== 'overview') {
            setGymSubTab('overview');
          } else if (activeTab === 'spa' && spaSubTab !== 'overview') {
            setSpaSubTab('overview');
          } else if (showAdminSection) {
            setShowAdminSection(false);
          } else {
            setActiveTab('home');
          }
        }
        // Push state back to keep intercepting if we're not at home
        if (activeTab !== 'home') {
          window.history.pushState({ tab: activeTab }, '');
        }
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
  }, []);

  const loadData = useCallback(async (force = false) => {
    // If we have cached data and not forcing, don't do anything here
    // The useEffect above will handle syncing from DataContext
    if (!force && cachedGlobalClients.length > 0) {
      return;
    }

    setIsInitialLoading(true);
    try {
      const branch = selectedBranch || null;
      const [birthdays, clients, allBranches, allBdays, allGlobalClients] = await Promise.all([
        getTodaysBirthdays(branch),
        getAllClients(branch),
        getAllBranches(),
        getTodaysBirthdays(null),
        getAllClients(null),
      ]);
      setTodaysBirthdays(birthdays);
      setAllClients(clients);
      setBranches(allBranches);
      setAllBirthdays(allBdays);
      setGlobalClients(allGlobalClients);
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [selectedBranch, cachedGlobalClients.length]);

  // Initial load - only if cache is empty
  useEffect(() => {
    if (user && cachedGlobalClients.length === 0) {
      loadData();
    }
  }, [user, cachedGlobalClients.length, loadData]);

  // Handle branch changes separately to avoid reloading everything on tab switch
  useEffect(() => {
    if (user && selectedBranch) {
      const reloadBranchData = async () => {
        const branch = selectedBranch;
        // Check if we already have this branch's data to avoid redundant fetches
        // This is a simple check, could be more robust
        const [birthdays, clients] = await Promise.all([
          getTodaysBirthdays(branch),
          getAllClients(branch),
        ]);
        setTodaysBirthdays(birthdays);
        setAllClients(clients);
      };
      reloadBranchData();
    }
  }, [selectedBranch, user]);

  useEffect(() => {
    if (activeTab !== 'home') setShowAdminSection(false);
    
    if (activeTab === 'birthdays') {
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
    }
  }, [activeTab]);

  const handleSetDefaultBranch = (branchName) => {
    localStorage.setItem('defaultBirthdayBranch', branchName);
    setSelectedBranch(branchName);
    setShowBranchPrompt(false);
  };

  // Handle search with debouncing
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
  }, [searchTerm, selectedBranch]);

  const filteredBirthdays = useMemo(() => {
    setIsFiltering(true);
    
    // If a specific month or day is selected, we search through all clients.
    // If only a branch is selected (or nothing), we use todaysBirthdays (which are already filtered by branch in loadData).
    const useAllClients = selectedMonth || selectedDay;
    const baseClients = useAllClients ? allClients : todaysBirthdays;
    
    const filtered = baseClients.filter((client) => {
      const monthMatch = !selectedMonth || (client.birthMonth && parseInt(client.birthMonth) === parseInt(selectedMonth));
      const dayMatch = !selectedDay || (client.birthDay && parseInt(client.birthDay) === parseInt(selectedDay));
      const branchMatch = !selectedBranch || (client.branch === selectedBranch);
      return monthMatch && dayMatch && branchMatch;
    });
    
    // Simulate a small delay for "processing" feel if needed, or just set it back
    setTimeout(() => setIsFiltering(false), 100);
    return filtered;
  }, [todaysBirthdays, allClients, selectedMonth, selectedDay, selectedBranch]);

  const getBranchInitials = (name) => {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  const clientBadge = useMemo(() => {
    if (!branches.length || !globalClients.length) return globalClients.length;
    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    globalClients.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${getBranchInitials(name)}: ${count}`)
      .join(', ');
  }, [globalClients, branches]);

  const birthdayBadge = useMemo(() => {
    if (!branches.length || !allBirthdays.length) return allBirthdays.length;
    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    allBirthdays.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${getBranchInitials(name)}: ${count}`)
      .join(', ');
  }, [allBirthdays, branches]);

  const getPaginatedClients = (list) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return list.slice(startIndex, startIndex + clientsPerPage);
  };

  const getTotalPages = (list) => Math.ceil(list.length / clientsPerPage);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
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
        {/* Navigation */}
        <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button onClick={() => setActiveTab('home')} className="flex items-center gap-3 group">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-20">
                    <Image src="/logo1.png" alt="Logo 1" fill className="object-contain p-1" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-10">
                    <Image src="/logo2.png" alt="Logo 2" fill className="object-contain p-1" />
                  </div>
                </div>
                <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">SpaManager</span>
              </button>

                <nav className="hidden md:flex items-center gap-1">
                {['home', 'dashboard', 'birthdays', 'gym', 'spa', 'profile'].map((tab) => {
                  // Check permissions for each tab
                  if (tab === 'dashboard' && profile?.permissions?.clients?.view === false) return null;
                  if (tab === 'birthdays' && profile?.permissions?.birthdays?.view === false) return null;
                  if (tab === 'gym' && profile?.permissions?.gym?.view === false) return null;
                  if (tab === 'spa' && profile?.permissions?.spa?.view === false) return null;
                  
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      {tab === 'gym' ? 'GYM' : tab === 'spa' ? 'SPA' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm relative">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    {profile?.role === 'Admin' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white dark:border-slate-900 rounded-full"></div>
                    )}
                  </div>
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {activeTab === 'home' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-2xl">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Hi, <span className="text-blue-600">{user?.displayName?.split(' ')[0] || 'User'}</span>
                </h1>
                <div className="mt-4 p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">Power Quotes</h2>
                  <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed italic font-medium">
                    "{currentAffirmation}"
                  </p>
                </div>
              </div>

                  {!showAdminSection ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {profile?.permissions?.clients?.view !== false && (
                    <NavCard onClick={() => setActiveTab('dashboard')} icon="/clients_bg.png" title="Clients" description="Manage customer list." badge={dataLoaded ? clientBadge : undefined} isImage={true} fullBg={true} />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard onClick={() => setActiveTab('duplicates')} icon="🔍" title="Duplicates" description="Find duplicate phones." />
                  )}
                  {profile?.permissions?.birthdays?.view !== false && (
                    <NavCard onClick={() => setActiveTab('birthdays')} icon="/birthday.png" title="Birthdays" description="Today's celebrations." badge={dataLoaded ? birthdayBadge : undefined} isImage={true} fullBg={true} />
                  )}
                  {profile?.permissions?.branches?.view !== false && (
                    <NavCard onClick={() => setActiveTab('branches')} icon="🏢" title="Branches" description="Manage locations." badge={dataLoaded ? branches.length : undefined} />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard 
                      onClick={() => setActiveTab('gym')} 
                      icon="/gym_bg.jpg" 
                      title="GYM" 
                      description="Memberships." 
                      isImage={true} 
                      fullBg={true} 
                      badge={dataLoaded ? cachedGymEnrollments.filter(e => e.status === 'active' && new Date() <= e.expiryDate).length : undefined}
                      centerBadge={true}
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard 
                      onClick={() => setActiveTab('spa')} 
                      icon="/spa_bg.jpg" 
                      title="SPA" 
                      description="Memberships." 
                      isImage={true} 
                      fullBg={true} 
                      badge={dataLoaded ? cachedSpaEnrollments.filter(e => e.status === 'active' && new Date() <= e.expiryDate).length : undefined}
                      centerBadge={true}
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard onClick={() => setShowAdminSection(true)} icon="⚙️" title="Admin" description="System tools." />
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Tools</h2>
                    <button onClick={() => setShowAdminSection(false)} className="text-sm font-medium text-blue-600 hover:text-blue-700">Back to main</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {profile?.permissions?.clients?.add !== false && (
                      <NavCard onClick={() => setActiveTab('upload')} icon="📤" title="Upload" description="Bulk data import." />
                    )}
                    {profile?.permissions?.clients?.edit !== false && (
                      <NavCard onClick={() => setActiveTab('unrecognized')} icon="⚠️" title="Issues" description="Fix failed imports." />
                    )}
                    {profile?.permissions?.clients?.view !== false && (
                      <NavCard onClick={() => setActiveTab('history')} icon="📜" title="History" description="View upload logs." />
                    )}
                    {profile?.permissions?.users?.view !== false && (
                      <NavCard onClick={() => setActiveTab('users')} icon="👥" title="Users" description="Manage roles." />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => setActiveTab('timeline')} icon="🕒" title="Timeline" description="Activity logs." />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Client Database</h2>
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

              <ClientList
                clients={getPaginatedClients(searchTerm ? searchResults : allClients)}
                totalCount={searchTerm ? searchResults.length : allClients.length}
                title={searchTerm ? `Search Results for "${searchTerm}"` : "All Clients"}
                onClientUpdated={loadData}
                isLoading={isInitialLoading}
              />

              {(searchTerm ? searchResults.length : allClients.length) > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Page {currentPage} of {getTotalPages(searchTerm ? searchResults : allClients)}
                  </span>
                  <button
                    disabled={currentPage === getTotalPages(searchTerm ? searchResults : allClients)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
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
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Birthdays</h2>
                  <p className="text-slate-500 mt-1">Celebrate with your customers.</p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                  {isFiltering && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm font-medium animate-pulse mb-2 md:mb-0">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  )}
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

              <ClientList
                clients={getPaginatedClients(filteredBirthdays)}
                totalCount={filteredBirthdays.length}
                title={selectedMonth || selectedDay ? "Filtered Birthdays" : "Today's Birthdays"}
                onClientUpdated={loadData}
                isLoading={isInitialLoading}
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
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
                <p className="text-slate-500 mt-1">Import clients from Excel files.</p>
              </div>
              <ExcelUpload onUploadComplete={loadData} />
            </div>
          )}

          {activeTab === 'unrecognized' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Data Issues</h2>
                <p className="text-slate-500 mt-1">Fix clients with unrecognized phone numbers.</p>
              </div>
              <UnrecognizedClientsList onApproved={loadData} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Upload History</h2>
                <p className="text-slate-500 mt-1">Track and manage your data imports.</p>
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
              <ClientForm onClientAdded={() => { loadData(true); setActiveTab('dashboard'); }} />
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Branch Management</h2>
                <p className="text-slate-500 mt-1">Manage your business locations.</p>
              </div>
              <BranchForm onBranchAdded={loadData} />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <UserManagement />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Activity Timeline</h2>
                <p className="text-slate-500 mt-1">Track all system actions and changes.</p>
              </div>
              <ActionsTimeline />
            </div>
          )}

          {activeTab === 'duplicates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Duplicate Search</h2>
                <p className="text-slate-500 mt-1">Find and resolve duplicate client records.</p>
              </div>
              <DuplicateSearch onMerged={loadData} />
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
                  <div className="flex items-center gap-2 mb-1">
                    {gymSubTab !== 'overview' && (
                      <button 
                        onClick={() => setGymSubTab('overview')}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">GYM Memberships</h2>
                  </div>
                  <p className="text-slate-500">
                    {gymSubTab === 'overview' ? 'Manage membership types and client enrollments.' : 
                     gymSubTab === 'create-type' ? 'Define new membership packages.' :
                     gymSubTab === 'enroll' ? 'Register a client for a membership.' : 'View active gym members.'}
                  </p>
                </div>
              </div>
              
              {gymSubTab === 'overview' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard 
                      onClick={() => setGymSubTab('create-type')} 
                      icon="📋" 
                      title="Create Type" 
                      description="Define new membership packages." 
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard 
                      onClick={() => setGymSubTab('manage-types')} 
                      icon="⚙️" 
                      title="Manage Types" 
                      description="Edit or delete membership types." 
                    />
                  )}
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard 
                      onClick={() => setGymSubTab('enroll')} 
                      icon="✍️" 
                      title="Enroll Client" 
                      description="Enroll a client in a membership." 
                    />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard 
                      onClick={() => setGymSubTab('active-members')} 
                      icon="🏃" 
                      title="Active Members" 
                      description="View and manage active memberships." 
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
                  {gymSubTab === 'enroll' && (
                    <div className="max-w-2xl mx-auto">
                      <EnrollmentForm onEnrolled={() => setGymSubTab('active-members')} />
                    </div>
                  )}
                  {gymSubTab === 'active-members' && (
                    <MembershipList />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'spa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {spaSubTab !== 'overview' && (
                      <button 
                        onClick={() => setSpaSubTab('overview')}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">SPA Memberships</h2>
                  </div>
                  <p className="text-slate-500">
                    {spaSubTab === 'overview' ? 'Manage spa membership types and client enrollments.' : 
                     spaSubTab === 'create-type' ? 'Define new spa membership packages.' :
                     spaSubTab === 'enroll' ? 'Register a client for a spa membership.' : 'View active spa members.'}
                  </p>
                </div>
              </div>
              
              {spaSubTab === 'overview' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard 
                      onClick={() => setSpaSubTab('create-type')} 
                      icon="💆‍♀️" 
                      title="Create Type" 
                      description="Define new spa membership packages." 
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard 
                      onClick={() => setSpaSubTab('manage-types')} 
                      icon="⚙️" 
                      title="Manage Types" 
                      description="Edit or delete spa membership types." 
                    />
                  )}
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard 
                      onClick={() => setSpaSubTab('enroll')} 
                      icon="✍️" 
                      title="Enroll Client" 
                      description="Enroll a client in a spa membership." 
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard 
                      onClick={() => setSpaSubTab('active-members')} 
                      icon="✨" 
                      title="Active Members" 
                      description="View and manage active spa memberships." 
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
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
