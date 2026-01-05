'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut } from '@/lib/auth';

export default function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/signin');
      } else if (profile && profile.status === 'pending') {
        // Stay on current page but show pending state (handled below)
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (profile && profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Approval Pending</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Your account has been created successfully. Please wait for an administrator to approve your access and assign a role.
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
            >
              Check Status
            </button>
            <button 
              onClick={async () => {
                await signOut();
                window.location.href = '/auth/signin';
              }}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRoles.length > 0 && profile && !requiredRoles.includes(profile.role) && profile.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
          <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
          <button onClick={() => router.push('/')} className="mt-4 text-blue-600 hover:underline">Go Home</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

