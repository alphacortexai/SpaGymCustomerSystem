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

// Improved Card Component for better reusability and clean UI
const NavCard = ({ onClick, icon, title, description, color = "blue" }) => {
  const colorClasses = {
    blue: "hover:border-blue-200 hover:bg-blue-50/50 text-blue-600",
    amber: "hover:border-amber-200 hover:bg-amber-50/50 text-amber-600",
    indigo: "hover:border-indigo-200 hover:bg-indigo-50/50 text-indigo-600",
    rose: "hover:border-rose-200 hover:bg-rose-50/50 text-rose-600",
    emerald: "hover:border-emerald-200 hover:bg-emerald-50/50 text-emerald-600",
    slate: "hover:border-slate-300 hover:bg-slate-50/50 text-slate-600",
  };

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center p-6 sm:p-8 bg-white border border-gray-100 rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${colorClasses[color] || colorClasses.blue}`}
    >
      <div className="mb-4 p-4 rounded-2xl bg-gray-50 group-hover:bg-white transition-colors duration-300">
        {typeof icon === 'string' ? (
          <span className="text-4xl sm:text-5xl">{icon}</span>
        ) : (
          icon
        )}
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-500 text-center max-w-[200px]">{description}</p>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
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
    if (user) {
      loadData();
    }
  }, [user, selectedBranch]);

  // Reset admin section when navigating back to home
  useEffect(() => {
    if (activeTab !== 'home') {
      setShowAdminSection(false);
    }
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

  // Clear search when search term is cleared
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setCurrentPage(1);
    }
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedDay]);

  // Filter clients by birthday
  const filterClientsByBirthday = (clients) => {
    if (!selectedMonth && !selectedDay) {
      return clients;
    }
    
    return clients.filter((client) => {
      const monthMatch = !selectedMonth || (client.birthMonth && parseInt(client.birthMonth) === parseInt(selectedMonth));
      const dayMatch = !selectedDay || (client.birthDay && parseInt(client.birthDay) === parseInt(selectedDay));
      return monthMatch && dayMatch;
    });
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedMonth('');
    setSelectedDay('');
    setSearchTerm('');
    setSearchResults([]);
    setCurrentPage(1);
  };

  // Get paginated clients
  const getPaginatedClients = (clients) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    const endIndex = startIndex + clientsPerPage;
    return clients.slice(startIndex, endIndex);
  };

  // Calculate total pages
  const getTotalPages = (clients) => {
    return Math.ceil(clients.length / clientsPerPage);
  };

  const handleClientAdded = () => {
    loadData();
    setSearchTerm('');
    setSearchResults([]);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F9FAFB] text-gray-900 font-sans">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900">SPA Manager</h1>
              </div>
              
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-3 p-1 pr-3 rounded-full hover:bg-gray-50 transition-colors focus:outline-none border border-transparent hover:border-gray-200"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-semibold text-gray-900 leading-none">{user.displayName || 'User'}</p>
                      <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl ring-1 ring-black ring-opacity-5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-gray-100 sm:hidden">
                          <p className="text-sm font-bold text-gray-900">{user.displayName || 'User'}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <div className="p-2">
                          <button
                            onClick={async () => {
                              await signOut();
                              window.location.href = '/auth/signin';
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 font-medium hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Home Page: Navigation Cards */}
          {activeTab === 'home' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!showAdminSection ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <NavCard 
                    onClick={() => setActiveTab('dashboard')}
                    icon="📊"
                    title="Dashboard"
                    description="Manage and search through your client database"
                    color="blue"
                  />
                  <NavCard 
                    onClick={() => setActiveTab('add')}
                    icon="➕"
                    title="Add Client"
                    description="Register a new client to the system manually"
                    color="emerald"
                  />
                  <NavCard 
                    onClick={() => setActiveTab('birthdays')}
                    icon={<Image src="/cake.svg" alt="Birthdays" width={48} height={48} className="sm:w-14 sm:h-14" />}
                    title="Birthdays"
                    description="See who is celebrating their birthday today"
                    color="amber"
                  />
                  <NavCard 
                    onClick={() => setShowAdminSection(true)}
                    icon="⚙️"
                    title="Admin"
                    description="System settings and administrative tools"
                    color="slate"
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Administration</h2>
                      <p className="text-gray-500 mt-1">Manage system data and branch settings</p>
                    </div>
                    <button
                      onClick={() => setShowAdminSection(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to Main
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <NavCard 
                      onClick={() => setActiveTab('upload')}
                      icon="📤"
                      title="Upload Excel"
                      description="Bulk import client data from Excel files"
                      color="indigo"
                    />
                    <NavCard 
                      onClick={() => setActiveTab('unrecognized')}
                      icon="⚠️"
                      title="Unrecognized"
                      description="Review and fix data from failed imports"
                      color="rose"
                    />
                    <NavCard 
                      onClick={() => setActiveTab('history')}
                      icon="📜"
                      title="History"
                      description="View logs of all previous data uploads"
                      color="slate"
                    />
                    <NavCard 
                      onClick={() => setActiveTab('branches')}
                      icon="🏢"
                      title="Branches"
                      description="Configure and manage business locations"
                      color="blue"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Back Button (shown when not on home) */}
          {activeTab !== 'home' && (
            <div className="mb-8">
              <button
                onClick={() => {
                  const adminTabs = ['upload', 'unrecognized', 'history', 'branches'];
                  if (adminTabs.includes(activeTab)) {
                    setActiveTab('home');
                    setShowAdminSection(true);
                  } else {
                    setActiveTab('home');
                    setShowAdminSection(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {['upload', 'unrecognized', 'history', 'branches'].includes(activeTab)
                  ? 'Back to Admin'
                  : 'Back to Home'}
              </button>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Branch Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setSearchTerm('');
                        setSearchResults([]);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                    >
                      <option value="">All Branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id || branch} value={branch.name || branch}>
                          {branch.name || branch}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search */}
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Search Clients</label>
                    <form onSubmit={handleSearch} className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search by name or phone number..."
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                      >
                        {isSearching ? '...' : 'Search'}
                      </button>
                    </form>
                  </div>

                  {/* Birthday Filters */}
                  <div className="lg:col-span-3 space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter by Birthday</label>
                    <div className="flex flex-wrap gap-3">
                      <select
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="flex-1 min-w-[140px] px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                      >
                        <option value="">All Months</option>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={selectedDay}
                        onChange={(e) => {
                          setSelectedDay(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="flex-1 min-w-[100px] px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                      >
                        <option value="">All Days</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      {(selectedMonth || selectedDay) && (
                        <button
                          onClick={handleResetFilters}
                          className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Section */}
              <div className="space-y-4">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500 font-medium">Searching database...</p>
                  </div>
                ) : (() => {
                  const filteredClients = filterClientsByBirthday(searchTerm.trim() ? searchResults : allClients);
                  const paginatedClients = getPaginatedClients(filteredClients);
                  const totalPages = getTotalPages(filteredClients);

                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {searchTerm.trim() ? 'Search Results' : 'All Clients'}
                          <span className="ml-2 text-sm font-normal text-gray-500">({filteredClients.length})</span>
                        </h3>
                        {(selectedMonth || selectedDay) && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            {selectedMonth && ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][selectedMonth - 1]}
                            {selectedMonth && selectedDay && ' '}
                            {selectedDay}
                          </div>
                        )}
                      </div>
                      
                      <ClientList clients={paginatedClients} title="" onClientUpdated={handleClientAdded} />
                      
                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                          <p className="text-sm text-gray-500">
                            Showing page <span className="font-bold text-gray-900">{currentPage}</span> of <span className="font-bold text-gray-900">{totalPages}</span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                                      currentPage === pageNum
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Other Tabs */}
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'add' && <ClientForm onClientAdded={handleClientAdded} />}
            {activeTab === 'upload' && <ExcelUpload onClientsAdded={handleClientAdded} />}
            {activeTab === 'branches' && <BranchForm onBranchAdded={handleClientAdded} />}
            {activeTab === 'unrecognized' && <UnrecognizedClientsList onClientUpdated={handleClientAdded} />}
            {activeTab === 'history' && <UploadHistory />}
            
            {activeTab === 'birthdays' && (
              <div className="space-y-6">
                <div className={`rounded-2xl p-6 sm:p-8 shadow-sm border-2 transition-all ${
                  todaysBirthdays.length > 0 
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
                    : 'bg-white border-gray-100'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Image src="/cake.svg" alt="Birthdays" width={28} height={28} />
                        Today's Birthdays
                        {todaysBirthdays.length > 0 && (
                          <span className="px-2.5 py-0.5 bg-amber-200 text-amber-800 text-sm rounded-full">{todaysBirthdays.length}</span>
                        )}
                      </h2>
                      <p className="text-gray-500 text-sm font-medium">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="px-4 py-2 bg-white/50 backdrop-blur-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none text-sm font-medium"
                    >
                      <option value="">All Branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id || branch} value={branch.name || branch}>{branch.name || branch}</option>
                      ))}
                    </select>
                  </div>

                  {todaysBirthdays.length > 0 ? (
                    <ClientList clients={todaysBirthdays} title="" onClientUpdated={handleClientAdded} />
                  ) : (
                    <div className="text-center py-16 bg-white/40 rounded-xl border border-dashed border-gray-200">
                      <div className="text-4xl mb-4">✨</div>
                      <p className="text-gray-500 font-medium">No birthdays today. Check back tomorrow!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
