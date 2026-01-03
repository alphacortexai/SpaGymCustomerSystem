'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/auth';
import ClientForm from '@/components/ClientForm';
import ClientList from '@/components/ClientList';
import ExcelUpload from '@/components/ExcelUpload';
import { searchClients, getTodaysBirthdays, getAllClients } from '@/lib/clients';
import { getAllBranches } from '@/lib/branches';
import ProtectedRoute from '@/components/ProtectedRoute';
import BranchForm from '@/components/BranchForm';
import UnrecognizedClientsList from '@/components/UnrecognizedClientsList';
import UploadHistory from '@/components/UploadHistory';

const NavCard = ({ onClick, icon, title, description, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50/50 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200",
    amber: "bg-amber-50/50 border-amber-100 text-amber-600 hover:bg-amber-50 hover:border-amber-200",
    indigo: "bg-indigo-50/50 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200",
    rose: "bg-rose-50/50 border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200",
    emerald: "bg-emerald-50/50 border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200",
    slate: "bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200",
  };

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-start p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 text-left w-full`}
    >
      <div className={`mb-4 p-3 rounded-xl ${colorClasses[color]} transition-colors duration-300`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
        Open module
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  );
};

export default function Home() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 20;
  const [showAdminSection, setShowAdminSection] = useState(false);

  const loadData = async () => {
    const branch = selectedBranch || null;
    const [birthdays, clients, allBranches] = await Promise.all([
      getTodaysBirthdays(branch),
      getAllClients(branch),
      getAllBranches(),
    ]);
    setTodaysBirthdays(birthdays);
    setAllClients(clients);
    setBranches(allBranches);
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, selectedBranch]);

  useEffect(() => {
    if (activeTab !== 'home') setShowAdminSection(false);
  }, [activeTab]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setCurrentPage(1);
      return;
    }
    setIsSearching(true);
    const branch = selectedBranch || null;
    const results = await searchClients(searchTerm, branch);
    setSearchResults(results);
    setIsSearching(false);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setCurrentPage(1);
    }
  }, [searchTerm]);

  const filterClientsByBirthday = (clients) => {
    if (!selectedMonth && !selectedDay) return clients;
    return clients.filter((client) => {
      const monthMatch = !selectedMonth || (client.birthMonth && parseInt(client.birthMonth) === parseInt(selectedMonth));
      const dayMatch = !selectedDay || (client.birthDay && parseInt(client.birthDay) === parseInt(selectedDay));
      return monthMatch && dayMatch;
    });
  };

  const handleResetFilters = () => {
    setSelectedMonth('');
    setSelectedDay('');
    setSearchTerm('');
    setSearchResults([]);
    setCurrentPage(1);
  };

  const getPaginatedClients = (clients) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return clients.slice(startIndex, startIndex + clientsPerPage);
  };

  const getTotalPages = (clients) => Math.ceil(clients.length / clientsPerPage);

  const handleClientAdded = () => {
    loadData();
    setSearchTerm('');
    setSearchResults([]);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
        {/* Navigation */}
        <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button onClick={() => setActiveTab('home')} className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">SpaManager</span>
              </button>

              <nav className="hidden md:flex items-center gap-1">
                {['home', 'dashboard', 'birthdays', 'upload'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>
            
            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{user.displayName || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={async () => { await signOut(); window.location.href = '/auth/signin'; }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="max-w-2xl">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                  Welcome back, <span className="text-blue-600">{user?.displayName?.split(' ')[0] || 'User'}</span>
                </h1>
                <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                  Manage your spa and gym customers with ease. Track birthdays, handle bulk uploads, and keep your database organized.
                </p>
              </div>

              {!showAdminSection ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <NavCard onClick={() => setActiveTab('dashboard')} icon="👥" title="Client Database" description="Search, edit, and manage your entire customer list." color="blue" />
                  <NavCard onClick={() => setActiveTab('birthdays')} icon="🎂" title="Birthdays" description="See who's celebrating today and send them wishes." color="amber" />
                  <NavCard onClick={() => setActiveTab('upload')} icon="📤" title="Bulk Upload" description="Import client data from Excel or CSV files instantly." color="emerald" />
                  <NavCard onClick={() => setActiveTab('add-client')} icon="➕" title="New Client" description="Manually register a single customer to the system." color="indigo" />
                  <NavCard onClick={() => setActiveTab('branches')} icon="🏢" title="Branches" description="Manage your different locations and facilities." color="slate" />
                  <NavCard onClick={() => setShowAdminSection(true)} icon="⚙️" title="Administration" description="Advanced tools and system configuration settings." color="rose" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Tools</h2>
                    <button onClick={() => setShowAdminSection(false)} className="text-sm font-medium text-blue-600 hover:text-blue-700">Back to main</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <NavCard onClick={() => setActiveTab('unrecognized')} icon="⚠️" title="Unrecognized Data" description="Review and fix client data that failed to import." color="rose" />
                    <NavCard onClick={() => setActiveTab('history')} icon="📜" title="Upload History" description="View logs of all previous bulk data imports." color="slate" />
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
                    className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <button onClick={() => setActiveTab('add-client')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Add Client
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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
                clients={searchTerm ? searchResults : getPaginatedClients(allClients)}
                title={searchTerm ? `Search Results for "${searchTerm}"` : "All Clients"}
                onClientUpdated={loadData}
              />

              {!searchTerm && allClients.length > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Page {currentPage} of {getTotalPages(allClients)}</span>
                  <button
                    disabled={currentPage === getTotalPages(allClients)}
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Birthdays</h2>
                  <p className="text-slate-500 mt-1">Celebrate with your customers.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option value="">All Months</option>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <button onClick={handleResetFilters} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Reset</button>
                </div>
              </div>

              <ClientList
                clients={filterClientsByBirthday(selectedMonth || selectedDay ? allClients : todaysBirthdays)}
                title={selectedMonth || selectedDay ? "Filtered Birthdays" : "Today's Birthdays"}
                onClientUpdated={loadData}
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
                <p className="text-slate-500 mt-1">Import your customer database from Excel or CSV.</p>
              </div>
              <ExcelUpload onUploadComplete={loadData} />
            </div>
          )}

          {activeTab === 'add-client' && (
            <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">New Client</h2>
                <p className="text-slate-500 mt-1">Add a single customer to your database.</p>
              </div>
              <ClientForm onClientAdded={handleClientAdded} />
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Branches</h2>
                <p className="text-slate-500 mt-1">Manage your facility locations.</p>
              </div>
              <BranchForm onBranchAdded={loadData} />
            </div>
          )}

          {activeTab === 'unrecognized' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Unrecognized Data</h2>
              <UnrecognizedClientsList onClientProcessed={loadData} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Upload History</h2>
              <UploadHistory />
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
