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

export default function Home() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);

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
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-800">SPA Client Management</h1>
              <div className="flex items-center gap-4">
                {user && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">{user.displayName || 'User'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <button
                      onClick={async () => {
                        await signOut();
                        window.location.href = '/auth/signin';
                      }}
                      className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'add'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Add Client
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upload Excel
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'branches'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Manage Branches
              </button>
              <button
                onClick={() => setActiveTab('birthdays')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'birthdays'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Today's Birthdays
              </button>
            </nav>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Branch Selector */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Branch</h2>
                <div className="flex gap-4 items-center">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
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
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Search Clients</h2>
                <form onSubmit={handleSearch} className="flex gap-4">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, phone number, or date of birth..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Branch</h2>
                <div className="flex gap-4 items-center">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
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
              <div className={`rounded-lg p-6 shadow-md ${
                todaysBirthdays.length > 0 
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300' 
                  : 'bg-white border border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-2xl font-bold ${
                    todaysBirthdays.length > 0 ? 'text-yellow-800' : 'text-gray-800'
                  }`}>
                    {todaysBirthdays.length > 0 ? '🎉' : '📅'} Today's Birthdays
                    {todaysBirthdays.length > 0 && (
                      <span className="ml-2 text-lg">({todaysBirthdays.length})</span>
                    )}
                  </h2>
                  <span className="text-sm text-gray-600">
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
