'use client';

import { useState, useEffect } from 'react';
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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const branch = selectedBranch || null;
    const results = await searchClients(searchTerm, branch);
    setSearchResults(results);
    setIsSearching(false);
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">📊</div>
                  <div className="font-semibold text-base sm:text-lg">Dashboard</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">View and search clients</div>
                </button>
                <button
                  onClick={() => setActiveTab('add')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">➕</div>
                  <div className="font-semibold text-base sm:text-lg">Add Client</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Add new client manually</div>
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">📤</div>
                  <div className="font-semibold text-base sm:text-lg">Upload Excel</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Bulk import clients</div>
                </button>
                <button
                  onClick={() => setActiveTab('branches')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">🏢</div>
                  <div className="font-semibold text-base sm:text-lg">Manage Branches</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Create and manage branches</div>
                </button>
                <button
                  onClick={() => setActiveTab('birthdays')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">🎂</div>
                  <div className="font-semibold text-base sm:text-lg">Today's Birthdays</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">View today's birthdays</div>
                </button>
                <button
                  onClick={() => setActiveTab('unrecognized')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">⚠️</div>
                  <div className="font-semibold text-base sm:text-lg">Unrecognised Data</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Review unrecognized clients</div>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="p-6 rounded-lg shadow-md text-left transition-all bg-white text-gray-800 hover:bg-blue-50 hover:shadow-lg border-2 border-transparent hover:border-blue-200"
                >
                  <div className="text-3xl mb-2">📜</div>
                  <div className="font-semibold text-base sm:text-lg">Upload History</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">View recent uploads</div>
                </button>
              </div>
            </div>
          )}

          {/* Back Button (shown when not on home) */}
          {activeTab !== 'home' && (
            <div className="mb-6">
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Back to Home</span>
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
              {/* Branch Selector */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Select Branch</h2>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[200px]"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id || branch} value={branch.name || branch}>
                        {branch.name || branch}
                      </option>
                    ))}
                  </select>
                  {selectedBranch && (
                    <span className="text-sm text-gray-600">
                      Showing clients from: <strong>{selectedBranch}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Search Clients</h2>
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, phone number, or date of birth..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </form>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <ClientList clients={searchResults} title="Search Results" onClientUpdated={handleClientAdded} />
              )}

              {/* All Clients */}
              <ClientList clients={allClients} title="All Clients" onClientUpdated={handleClientAdded} />
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
              {/* Branch Selector for Birthdays */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Select Branch</h2>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 sm:min-w-[200px]"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id || branch} value={branch.name || branch}>
                        {branch.name || branch}
                      </option>
                    ))}
                  </select>
                  {selectedBranch && (
                    <span className="text-sm text-gray-600">
                      Showing birthdays from: <strong>{selectedBranch}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Today's Birthdays Display */}
              <div className={`rounded-lg p-4 sm:p-6 shadow-md ${
                todaysBirthdays.length > 0 
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                  <h2 className={`text-xl sm:text-2xl font-bold ${
                    todaysBirthdays.length > 0 ? 'text-yellow-800' : 'text-gray-800'
                  }`}>
                    {todaysBirthdays.length > 0 ? '🎉' : '📅'} Today's Birthdays
                    {todaysBirthdays.length > 0 && (
                      <span className="ml-2 text-base sm:text-lg">({todaysBirthdays.length})</span>
                    )}
                  </h2>
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
                      No birthdays today. Check back tomorrow! 🎂
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
