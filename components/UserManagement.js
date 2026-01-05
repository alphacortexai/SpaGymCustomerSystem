'use client';

import { useState, useEffect } from 'react';
import { getAllUsers, updateUserRole, updateUserStatus, updateUserPermissions, ROLES, ROLE_PERMISSIONS } from '@/lib/users';
import { format } from 'date-fns';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (uid, newRole) => {
    setUpdating(uid);
    const result = await updateUserRole(uid, newRole);
    if (result.success) {
      await loadUsers();
    } else {
      alert('Error updating role: ' + result.error);
    }
    setUpdating(null);
  };

  const handleStatusChange = async (uid, newStatus) => {
    setUpdating(uid);
    const result = await updateUserStatus(uid, newStatus);
    if (result.success) {
      await loadUsers();
    } else {
      alert('Error updating status: ' + result.error);
    }
    setUpdating(null);
  };

  const togglePermission = async (user, category, action) => {
    const newPermissions = { ...user.permissions };
    if (!newPermissions[category]) {
      newPermissions[category] = { view: false, edit: false, delete: false, add: false };
    }
    
    if (typeof newPermissions[category] === 'boolean') {
      newPermissions[category] = !newPermissions[category];
    } else {
      newPermissions[category] = {
        ...newPermissions[category],
        [action]: !newPermissions[category][action]
      };
    }
    
    setUpdating(user.uid);
    const result = await updateUserPermissions(user.uid, newPermissions);
    if (result.success) {
      await loadUsers();
    }
    setUpdating(null);
  };

  if (loading) return <div className="text-center py-10">Loading users...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h2>
        <button onClick={loadUsers} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Access Permissions</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {users.map((user) => (
              <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{user.displayName || 'No Name'}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    disabled={updating === user.uid || user.email === 'alphacortexai@gmail.com'}
                    onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                    className="bg-transparent text-sm font-medium focus:outline-none border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    {Object.values(ROLES).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {user.permissions && Object.entries(user.permissions).map(([category, perms]) => (
                      <div key={category} className="flex flex-col gap-1 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{category}</span>
                        <div className="flex gap-1">
                          {typeof perms === 'object' ? (
                            Object.entries(perms).map(([action, allowed]) => (
                              <button
                                key={action}
                                onClick={() => togglePermission(user, category, action)}
                                disabled={updating === user.uid || user.email === 'alphacortexai@gmail.com'}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                                  allowed 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                }`}
                                title={`${allowed ? 'Disable' : 'Enable'} ${action}`}
                              >
                                {action.charAt(0).toUpperCase()}
                              </button>
                            ))
                          ) : (
                            <button
                              onClick={() => togglePermission(user, category, 'view')}
                              disabled={updating === user.uid || user.email === 'alphacortexai@gmail.com'}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                                perms 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                              }`}
                            >
                              VIEW
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.status}
                    disabled={updating === user.uid || user.email === 'alphacortexai@gmail.com'}
                    onChange={(e) => handleStatusChange(user.uid, e.target.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium outline-none border-none cursor-pointer transition-all ${
                      user.status === 'approved' 
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {user.createdAt && format(user.createdAt.toDate(), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 text-right">
                  {user.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(user.uid, 'approved')}
                      disabled={updating === user.uid}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
