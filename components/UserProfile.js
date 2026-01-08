'use client';

import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

export default function UserProfile() {
  const { user, profile } = useAuth();

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="p-1 bg-white dark:bg-slate-900 rounded-3xl">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-24 h-24 rounded-2xl object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-400">
                  {profile.displayName?.charAt(0) || profile.email?.charAt(0)}
                </div>
              )}
            </div>
            <div className="pb-2">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                profile.role === 'Admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                profile.role === 'Manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {profile.role}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.displayName || 'User'}</h2>
            <p className="text-slate-500">{profile.email}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Account Details</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-green-600 capitalize">{profile.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Member Since</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {profile.createdAt && format(profile.createdAt.toDate(), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">User ID</span>
                  <span className="font-mono text-[10px] text-slate-400">{profile.uid}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Your Access Permissions</h3>
              <div className="grid grid-cols-2 gap-3">
                {profile.permissions && Object.entries(profile.permissions)
                  .filter(([category, perms]) => {
                    // Only show permissions for categories that are visible on the dashboard
                    if (category === 'clients' && perms?.view === false) return false;
                    if (category === 'birthdays' && perms?.view === false) return false;
                    if (category === 'branches' && perms?.view === false) return false;
                    if (category === 'gym' && perms?.view === false) return false;
                    if (category === 'spa' && perms?.view === false) return false;
                    if (category === 'users' && perms?.view === false) return false;
                    return true;
                  })
                  .map(([category, perms]) => (
                  <div key={category} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-900 dark:text-white capitalize mb-2">{category}</div>
                    <div className="flex flex-wrap gap-1">
                      {typeof perms === 'object' ? (
                        Object.entries(perms).map(([action, allowed]) => (
                          <span key={action} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            allowed ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                          }`}>
                            {action.toUpperCase()}
                          </span>
                        ))
                      ) : (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          perms ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-200 text-slate-400 dark:bg-slate-700'
                        }`}>
                          VIEW
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
