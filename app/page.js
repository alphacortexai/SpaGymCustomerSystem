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

const NavCard = ({ onClick, icon, title, description, badge, isImage, fullBg }) => {
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
        <div className="absolute top-3 right-3 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-lg shadow-blue-500/30 z-10">
          {badge}
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
    loading: isDataLoading,
    refreshData
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
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Sync with cached data
  useEffect(() => {
    if (!isDataLoading) {
      setBranches(cachedBranches);
      setAllBirthdays(cachedAllBirthdays);
      setGlobalClients(cachedGlobalClients);
      
      // If no branch selected, use global data
      if (!selectedBranch) {
        setAllClients(cachedAllClients);
        setTodaysBirthdays(cachedTodaysBirthdays);
      }
      setIsInitialLoading(false);
    }
  }, [isDataLoading, cachedBranches, cachedAllBirthdays, cachedGlobalClients, cachedAllClients, cachedTodaysBirthdays, selectedBranch]);

  // Handle back button
  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState || currentState.tab !== activeTab || currentState.gymSub !== gymSubTab || currentState.spaSub !== spaSubTab) {
      window.history.pushState({ tab: activeTab, gymSub: gymSubTab, spaSub: spaSubTab }, '');
    }

    const handlePopState = (event) => {
      const state = event.state;
      if (activeTab === 'home') {
        setShowExitConfirm(true);
        window.history.pushState({ tab: 'home' }, '');
      } else {
        if (state && state.tab) {
          setActiveTab(state.tab);
          if (state.gymSub) setGymSubTab(state.gymSub);
          if (state.spaSub) setSpaSubTab(state.spaSub);
        } else {
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
        if (activeTab !== 'home') {
          window.history.pushState({ tab: activeTab }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, gymSubTab, spaSubTab, showAdminSection]);

  useEffect(() => {
    const getAffirmation = () => {
      const now = new Date();
      const intervalIndex = Math.floor(now.getTime() / (5 * 60 * 1000));
      const index = intervalIndex % affirmations.length;
      return affirmations[index];
    };
    setCurrentAffirmation(getAffirmation());
    const interval = setInterval(() => {
      setCurrentAffirmation(getAffirmation());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle branch changes separately
  useEffect(() => {
    if (user && selectedBranch) {
      const reloadBranchData = async () => {
        setIsInitialLoading(true);
        const branch = selectedBranch;
        const [birthdays, clients] = await Promise.all([
          getTodaysBirthdays(branch),
          getAllClients(branch),
        ]);
        setTodaysBirthdays(birthdays);
        setAllClients(clients);
        setIsInitialLoading(false);
      };
      reloadBranchData();
    } else if (user && !selectedBranch && !isDataLoading) {
      // Revert to cached global data
      setAllClients(cachedAllClients);
      setTodaysBirthdays(cachedTodaysBirthdays);
    }
  }, [selectedBranch, user, isDataLoading, cachedAllClients, cachedTodaysBirthdays]);

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
        const results = await searchClients(searchTerm, selectedBranch);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };
    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedBranch]);

  const filteredBirthdays = useMemo(() => {
    let filtered = allBirthdays;
    if (selectedBranch) {
      filtered = filtered.filter(c => c.branch === selectedBranch);
    }
    if (selectedMonth) {
      filtered = filtered.filter(c => c.birthMonth === parseInt(selectedMonth));
    }
    if (selectedDay) {
      filtered = filtered.filter(c => c.birthDay === parseInt(selectedDay));
    }
    return filtered;
  }, [allBirthdays, selectedBranch, selectedMonth, selectedDay]);

  const getPaginatedClients = (clients) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return clients.slice(startIndex, startIndex + clientsPerPage);
  };

  const getTotalPages = (clients) => Math.ceil(clients.length / clientsPerPage);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!user) return <ProtectedRoute />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🚪</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Exit Application?</h3>
              <p className="text-slate-500 dark:text-slate-400">Are you sure you want to leave the system?</p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-6 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  window.history.back();
                }}
                className="flex-1 px-6 py-3.5 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <span className="text-white text-xl font-bold">S</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none">SpaGym</h1>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">Management</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={refreshData}
              disabled={isDataLoading}
              className={`p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ${isDataLoading ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <span className="hidden md:block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {profile?.name || user?.email?.split('@')[0]}
                </span>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">{profile?.role || 'User'}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.email}</p>
                  </div>
                  <button onClick={() => { setActiveTab('profile'); setUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <span>👤</span> Profile Settings
                  </button>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'home' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* Welcome Section */}
            <div className="relative overflow-hidden bg-blue-600 rounded-[2rem] p-8 md:p-12 text-white shadow-2xl shadow-blue-500/20">
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-black/10 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="max-w-2xl">
                  <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                    Hello, {profile?.name?.split(' ')[0] || 'there'}! 👋
                  </h2>
                  <p className="text-blue-100 text-lg md:text-xl font-medium leading-relaxed mb-6 italic">
                    "{currentAffirmation}"
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">Total Clients</p>
                      <p className="text-2xl font-black">{globalClients.length}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">Today's Birthdays</p>
                      <p className="text-2xl font-black">{allBirthdays.length}</p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="w-48 h-48 relative animate-float">
                    <Image src="/spa.png" alt="Spa" fill className="object-contain drop-shadow-2xl" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Navigation Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <NavCard onClick={() => setActiveTab('dashboard')} icon="/clients.png" title="Clients" description="Manage database." isImage fullBg />
              <NavCard onClick={() => setActiveTab('birthdays')} icon="/birthday.png" title="Birthdays" description="Daily celebrations." badge={allBirthdays.length} isImage fullBg />
              <NavCard onClick={() => setActiveTab('gym')} icon="/gym_bg.jpg" title="Gym" description="Memberships & types." isImage fullBg />
              <NavCard onClick={() => setActiveTab('spa')} icon="/spa_bg.jpg" title="Spa" description="Services & bookings." isImage fullBg />
            </div>

            {/* Quick Actions */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center text-sm">⚡</span>
                  Quick Actions
                </h3>
                <button 
                  onClick={() => setShowAdminSection(!showAdminSection)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  {showAdminSection ? 'Hide Admin' : 'Show Admin'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {profile?.permissions?.clients?.add !== false && (
                  <NavCard onClick={() => setActiveTab('add-client')} icon="👤+" title="Add Client" description="New entry." />
                )}
                {profile?.permissions?.uploads?.view !== false && (
                  <NavCard onClick={() => setActiveTab('upload')} icon="📤" title="Upload" description="Excel import." />
                )}
                {profile?.permissions?.branches?.view !== false && (
                  <NavCard onClick={() => setActiveTab('branches')} icon="🏢" title="Branches" description="Manage locations." />
                )}
                <NavCard onClick={() => setActiveTab('duplicates')} icon="🔍" title="Duplicates" description="Find & merge." />
                {profile?.permissions?.unrecognized?.view !== false && (
                  <NavCard onClick={() => setActiveTab('unrecognized')} icon="⚠️" title="Review" description="Invalid data." />
                )}
                <NavCard onClick={() => setActiveTab('profile')} icon="⚙️" title="Settings" description="Your profile." />
              </div>

              {showAdminSection && (
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-4 duration-300">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Administrative Tools</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {profile?.permissions?.uploads?.view !== false && (
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
              onClientUpdated={refreshData}
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
              title={selectedMonth ? `Birthdays for ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth - 1]} ${selectedDay}` : "Today's Birthdays"}
              onClientUpdated={refreshData}
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
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Page {currentPage} of {getTotalPages(filteredBirthdays)}
                </span>
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

        {activeTab === 'gym' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Gym Management</h2>
                <p className="text-slate-500 mt-1">Manage memberships and enrollments.</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setGymSubTab('overview')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${gymSubTab === 'overview' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Overview</button>
                <button onClick={() => setGymSubTab('memberships')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${gymSubTab === 'memberships' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Memberships</button>
                <button onClick={() => setGymSubTab('types')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${gymSubTab === 'types' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Types</button>
                <button onClick={() => setGymSubTab('enroll')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${gymSubTab === 'enroll' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Enroll</button>
              </div>
            </div>
            {gymSubTab === 'overview' && <MembershipList />}
            {gymSubTab === 'memberships' && <MembershipForm />}
            {gymSubTab === 'types' && <MembershipTypeManager />}
            {gymSubTab === 'enroll' && <EnrollmentForm />}
          </div>
        )}

        {activeTab === 'spa' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Spa Management</h2>
                <p className="text-slate-500 mt-1">Manage spa services and memberships.</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button onClick={() => setSpaSubTab('overview')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${spaSubTab === 'overview' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Overview</button>
                <button onClick={() => setSpaSubTab('memberships')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${spaSubTab === 'memberships' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Memberships</button>
                <button onClick={() => setSpaSubTab('types')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${spaSubTab === 'types' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Types</button>
                <button onClick={() => setSpaSubTab('enroll')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${spaSubTab === 'enroll' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Enroll</button>
              </div>
            </div>
            {spaSubTab === 'overview' && <SpaMembershipList />}
            {spaSubTab === 'memberships' && <SpaMembershipForm />}
            {spaSubTab === 'types' && <SpaMembershipTypeManager />}
            {spaSubTab === 'enroll' && <SpaEnrollmentForm />}
          </div>
        )}

        {activeTab === 'add-client' && <ClientForm onClientAdded={() => { refreshData(); setActiveTab('dashboard'); }} onCancel={() => setActiveTab('home')} />}
        {activeTab === 'upload' && <ExcelUpload onUploadComplete={() => { refreshData(); setActiveTab('dashboard'); }} />}
        {activeTab === 'branches' && <BranchForm onBranchAdded={refreshData} />}
        {activeTab === 'unrecognized' && <UnrecognizedClientsList />}
        {activeTab === 'history' && <UploadHistory />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'profile' && <UserProfile />}
        {activeTab === 'timeline' && <ActionsTimeline />}
        {activeTab === 'duplicates' && <DuplicateSearch />}
      </main>
    </div>
  );
}
