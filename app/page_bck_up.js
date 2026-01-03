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
    if (activeTab === 'home') {
      // Keep admin section state when on home, but reset when switching from other tabs
    } else {
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

  // Filter clients by month and day
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
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">SPA Client Management</h1>
              {user && (
                <div className="relative">
                  {/* Mobile: Dropdown Button */}
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 sm:gap-3 focus:outline-none"
                  >
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                      />
                    )}
                    <div className="hidden sm:block text-right">
                      <p className="text-sm font-medium text-gray-700">{user.displayName || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setUserMenuOpen(false)}
                      ></div>
                      <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                          <div className="px-4 py-3 border-b border-gray-200 sm:hidden">
                            {user.photoURL && (
                              <img
                                src={user.photoURL}
                                alt={user.displayName || 'User'}
                                className="w-10 h-10 rounded-full mb-2"
                              />
                            )}
                            <p className="text-sm font-medium text-gray-900">{user.displayName || 'User'}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await signOut();
                              window.location.href = '/auth/signin';
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
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
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Home Page: Navigation Cards (Mobile & Desktop) */}
          {activeTab === 'home' && (
            <div className="mb-6">
              {!showAdminSection ? (
                /* Main Cards */
                <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-2">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="text-4xl sm:text-6xl mb-2">📊</div>
                    <div className="font-semibold text-base sm:text-2xl">Dashboard</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">View and search clients</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="text-4xl sm:text-6xl mb-2">➕</div>
                    <div className="font-semibold text-base sm:text-2xl">Add Client</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">Add new client manually</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('birthdays')}
                    className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="sm:mb-1">
                      <Image src="/cake.svg" alt="Birthdays" width={80} height={80} className="mb-2" />
                    </div>
                    <div className="font-semibold text-base sm:text-2xl">Today's Birthdays</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">View today's birthdays</div>
                  </button>
                  <button
                    onClick={() => setShowAdminSection(true)}
                    className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="text-4xl sm:text-6xl mb-2">⚙️</div>
                    <div className="font-semibold text-base sm:text-2xl">Admin</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">Administrative functions</div>
                  </button>
                </div>
              ) : (
                /* Admin Sub-section */
                <div className="space-y-4">
                  {/* Back Button */}
                  <button
                    onClick={() => setShowAdminSection(false)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-medium">Back to Main</span>
                  </button>

                  {/* Admin Section Title */}
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Admin</h2>
                    <p className="text-sm text-gray-600 mt-1">Administrative functions and settings</p>
                  </div>

                  {/* Admin Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="text-4xl sm:text-6xl mb-2">📤</div>
                      <div className="font-semibold text-base sm:text-2xl">Upload Excel</div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">Bulk import clients</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('unrecognized')}
                      className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="text-4xl sm:text-6xl mb-2">⚠️</div>
                      <div className="font-semibold text-base sm:text-2xl">Unrecognised Data</div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">Review unrecognized clients</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="text-4xl sm:text-6xl mb-2">📜</div>
                      <div className="font-semibold text-base sm:text-2xl">Upload History</div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">View recent uploads</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('branches')}
                      className="h-[150px] w-[150px] sm:h-[300px] sm:w-[300px] p-4 rounded-xl shadow-sm text-center transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-md border border-gray-100 hover:border-blue-200 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="text-4xl sm:text-6xl mb-2">🏢</div>
                      <div className="font-semibold text-base sm:text-2xl">Manage Branches</div>
                      <div className="text-xs sm:text-sm text-gray-500 mt-1 px-2">Create and manage branches</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Back Button (shown when not on home) */}
          {activeTab !== 'home' && (
            <div className="mb-6">
              <button
                onClick={() => {
                  // Check if current tab is an admin tab
                  const adminTabs = ['upload', 'unrecognized', 'history', 'branches'];
                  if (adminTabs.includes(activeTab)) {
                    // Navigate back to Admin section
                    setActiveTab('home');
                    setShowAdminSection(true);
                  } else {
                    // Navigate back to Home (main view)
                    setActiveTab('home');
                    setShowAdminSection(false);
                  }
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">
                  {['upload', 'unrecognized', 'history', 'branches'].includes(activeTab)
                    ? 'Back to Admin'
                    : 'Back to Home'}
                </span>
              </button>
            </div>
          )}

          {/* Admin Link - only show on dashboard */}
          {activeTab === 'dashboard' && (
            <div className="mb-4 text-right">
              <a
                href="/admin/migrate-phones"
                className="text-xs sm:text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Migrate Phone Numbers
              </a>
            </div>
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Branch Selector, Search, and Filters Combined */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="space-y-4">
                  {/* Branch Selector */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                    <label className="text-sm font-medium text-gray-700 sm:w-24 flex-shrink-0">Branch:</label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setSearchTerm('');
                        setSearchResults([]);
                        setCurrentPage(1);
                      }}
                      className="flex-1 sm:flex-initial w-full sm:w-auto px-3 sm:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[200px] text-sm sm:text-base"
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
                  <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                    <label className="text-sm font-medium text-gray-700 sm:w-24 flex-shrink-0">Search:</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Name or phone number..."
                      className="flex-1 w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap text-sm sm:text-base font-medium"
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>
                  </form>

                  {/* Birthday Filters */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                    <label className="text-sm font-medium text-gray-700 sm:w-24 flex-shrink-0">Birthday:</label>
                    <div className="flex flex-col sm:flex-row gap-2 flex-1 w-full">
                      <select
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="flex-1 w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      >
                        <option value="">All Months</option>
                        <option value="1">January</option>
                        <option value="2">February</option>
                        <option value="3">March</option>
                        <option value="4">April</option>
                        <option value="5">May</option>
                        <option value="6">June</option>
                        <option value="7">July</option>
                        <option value="8">August</option>
                        <option value="9">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                      <select
                        value={selectedDay}
                        onChange={(e) => {
                          setSelectedDay(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="flex-1 w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                      >
                        <option value="">All Days</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      {(selectedMonth || selectedDay) && (
                        <button
                          onClick={handleResetFilters}
                          className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 whitespace-nowrap text-sm sm:text-base"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Search Results or All Clients with Filters and Pagination */}
              {isSearching ? (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <p className="text-gray-600">Searching...</p>
                  </div>
                </div>
              ) : (() => {
                // Get base clients (search results or all clients)
                const baseClients = searchTerm.trim() ? searchResults : allClients;
                
                // Apply birthday filters
                const filteredClients = filterClientsByBirthday(baseClients);
                
                // Get paginated clients
                const paginatedClients = getPaginatedClients(filteredClients);
                const totalPages = getTotalPages(filteredClients);
                
                if (filteredClients.length === 0) {
                  return (
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                      <p className="text-gray-500">
                        {searchTerm.trim() 
                          ? `No clients found matching "${searchTerm}"`
                          : 'No clients found'}
                        {(selectedMonth || selectedDay) && ' with selected birthday filter'}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div>
                    {/* Results Info */}
                    <div className="mb-3 text-xs sm:text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span>
                          Showing <strong>{paginatedClients.length}</strong> of <strong>{filteredClients.length}</strong> client{filteredClients.length !== 1 ? 's' : ''}
                        </span>
                        {searchTerm.trim() && (
                          <span className="text-xs">matching "<strong>{searchTerm}</strong>"</span>
                        )}
                        {(selectedMonth || selectedDay) && (
                          <span className="text-xs">
                            {' '}• Birthday:{' '}
                            {selectedMonth && (
                              <span>
                                {new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'short' })}
                              </span>
                            )}
                            {selectedMonth && selectedDay && ' '}
                            {selectedDay && <span>{selectedDay}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Client List */}
                    <ClientList clients={paginatedClients} title="" onClientUpdated={handleClientAdded} />
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="mt-4 bg-white p-3 sm:p-4 rounded-lg shadow-md">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                          <div className="text-xs sm:text-sm text-gray-600">
                            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                            >
                              ← Prev
                            </button>
                            <div className="flex gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                  pageNum = totalPages - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`min-w-[36px] px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium ${
                                      currentPage === pageNum
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Add Client Tab */}
          {activeTab === 'add' && (
            <div className="max-w-2xl">
              <ClientForm onClientAdded={handleClientAdded} />
            </div>
          )}

          {/* Upload Excel Tab */}
          {activeTab === 'upload' && (
            <div className="max-w-2xl">
              <ExcelUpload onClientsAdded={handleClientAdded} />
            </div>
          )}

          {/* Manage Branches Tab */}
          {activeTab === 'branches' && (
            <div className="max-w-2xl">
              <BranchForm onBranchAdded={handleClientAdded} />
            </div>
          )}

          {/* Today's Birthdays Tab */}
          {activeTab === 'birthdays' && (
            <div className="space-y-6">
              {/* Today's Birthdays Display */}
              <div className={`rounded-lg p-4 sm:p-6 shadow-md ${
                todaysBirthdays.length > 0 
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className={`text-xl sm:text-2xl font-bold ${
                        todaysBirthdays.length > 0 ? 'text-yellow-800' : 'text-gray-800'
                      }`}>
                        <span className="inline-flex items-center gap-2">
                          <Image src="/cake.svg" alt="Birthdays" width={20} height={20} />
                          Today's Birthdays
                        </span>
                        {todaysBirthdays.length > 0 && (
                          <span className="ml-2 text-base sm:text-lg">({todaysBirthdays.length})</span>
                        )}
                      </h2>
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="ml-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50 backdrop-blur-sm"
                      >
                        <option value="">All Branches</option>
                        {branches.map((branch) => (
                          <option key={branch.id || branch} value={branch.name || branch}>
                            {branch.name || branch}
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedBranch && (
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        Showing birthdays from: <span className="font-medium">{selectedBranch}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm text-gray-600">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                {todaysBirthdays.length > 0 ? (
                  <ClientList clients={todaysBirthdays} title="" onClientUpdated={handleClientAdded} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">
                      <span className="inline-flex items-center gap-2">
                        No birthdays today. Check back tomorrow!
                        <Image src="/cake.svg" alt="Birthday" width={18} height={18} />
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Unrecognised Uploaded Client Data Tab */}
          {activeTab === 'unrecognized' && (
            <div className="space-y-6">
              <UnrecognizedClientsList onClientUpdated={handleClientAdded} />
            </div>
          )}

          {/* Upload History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <UploadHistory />
            </div>
          )}
      </main>
    </div>
    </ProtectedRoute>
  );
}
