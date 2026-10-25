'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getAllUsers, updateUserRole, updateUserStatus, updateUserPermissions, updateUserBranches, updateUserSpaIntakeBranches, ROLES } from '@/lib/users';
import { getAllBranches } from '@/lib/branches';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import LoadingState from '@/components/LoadingState';

const ROOT_EMAIL = 'alphacortexai@gmail.com';
const STATUS_OPTIONS = ['approved', 'pending', 'disabled'];
const STATUS_LABELS = { all: 'All', approved: 'Approved', pending: 'Pending', disabled: 'Disabled' };
const CATEGORY_ORDER = ['clients', 'gym', 'spa', 'birthdays', 'branches', 'users'];
const ACTION_ORDER = ['view', 'add', 'edit', 'delete'];
const ACTION_LABELS = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete' };

function isRootAccount(email) {
  return String(email || '').toLowerCase() === ROOT_EMAIL;
}

function joinedLabel(createdAt) {
  if (!createdAt) return 'Join date not recorded';
  const date = typeof createdAt.toDate === 'function' ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Join date not recorded';
  return `Joined ${format(date, 'MMM d, yyyy')}`;
}

function categoryLabel(category) {
  return category.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function orderedCategories(permissions = {}) {
  const extras = Object.keys(permissions).filter((category) => !CATEGORY_ORDER.includes(category));
  return [...CATEGORY_ORDER.filter((category) => category in permissions), ...extras];
}

function toggleValue(list, value) {
  const current = Array.isArray(list) ? list : [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function statusClass(status) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
}

function Chip({ pressed, disabled, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`max-w-full break-words rounded-full px-3 py-1.5 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        pressed
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export default function UserManagement() {
  const { toast } = useNotifications();
  const { user: authUser, profile } = useAuth();
  const isPlatformAdmin = authUser?.email?.toLowerCase() === ROOT_EMAIL;
  const canManageUsers = (profile?.role === ROLES.ADMIN || isPlatformAdmin) && profile?.status === 'approved';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [branches, setBranches] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadUsers = async ({ silent = false } = {}) => {
    if (!canManageUsers) return;
    if (!silent) setLoading(true);
    const [data, branchList] = await Promise.all([getAllUsers(), getAllBranches()]);
    setUsers(data);
    setBranches(branchList);
    setLoading(false);
  };

  useEffect(() => {
    if (!canManageUsers) return undefined;
    let cancelled = false;
    Promise.all([getAllUsers(), getAllBranches()]).then(([data, branchList]) => {
      if (cancelled) return;
      setUsers(data);
      setBranches(branchList);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [canManageUsers]);

  const applyResult = async (uid, result, failureMessage) => {
    if (result.success) await loadUsers({ silent: true });
    else toast(`${failureMessage}: ${result.error}`, 'error');
    setUpdating(null);
  };

  const handleRoleChange = async (uid, newRole) => {
    if (!isPlatformAdmin) return;
    setUpdating(uid);
    await applyResult(uid, await updateUserRole(uid, newRole), 'Error updating role');
  };

  const handleStatusChange = async (uid, newStatus) => {
    if (!isPlatformAdmin) return;
    setUpdating(uid);
    await applyResult(uid, await updateUserStatus(uid, newStatus), 'Error updating status');
  };

  const handleBranchChange = async (uid, assignedBranches) => {
    if (!canManageUsers) return;
    setUpdating(uid);
    await applyResult(uid, await updateUserBranches(uid, assignedBranches), 'Error updating branches');
  };

  const handleSpaIntakeBranchChange = async (uid, spaIntakeBranches) => {
    if (!isPlatformAdmin) return;
    setUpdating(uid);
    await applyResult(uid, await updateUserSpaIntakeBranches(uid, spaIntakeBranches), 'Error updating spa intake access');
  };

  const togglePermission = async (user, category, action) => {
    if (!isPlatformAdmin) return;
    const newPermissions = { ...user.permissions };
    if (!newPermissions[category]) {
      newPermissions[category] = { view: false, edit: false, delete: false, add: false };
    }

    if (typeof newPermissions[category] === 'object' && newPermissions[category][action] === undefined) {
      newPermissions[category][action] = false;
    }

    if (typeof newPermissions[category] === 'boolean') {
      newPermissions[category] = !newPermissions[category];
    } else {
      newPermissions[category] = {
        ...newPermissions[category],
        [action]: !newPermissions[category][action],
      };
    }

    setUpdating(user.uid);
    const result = await updateUserPermissions(user.uid, newPermissions);
    if (result.success) await loadUsers({ silent: true });
    setUpdating(null);
  };

  const statusCounts = useMemo(() => {
    const counts = { all: users.length, approved: 0, pending: 0, disabled: 0 };
    users.forEach((account) => {
      if (counts[account.status] !== undefined) counts[account.status] += 1;
    });
    return counts;
  }, [users]);

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((account) => {
      if (statusFilter !== 'all' && account.status !== statusFilter) return false;
      if (!term) return true;
      return [account.displayName, account.email, account.role, account.status]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [query, statusFilter, users]);

  if (!canManageUsers) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">You do not have permission to manage user access.</div>;
  }

  if (loading) return <LoadingState title="Loading users" description="Preparing user access settings." />;

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="sticky top-0 z-10 space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-4">
        <label className="block min-w-0">
          <span className="sr-only">Search people</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {['all', ...STATUS_OPTIONS].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === status
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {STATUS_LABELS[status] || status} {statusCounts[status] ?? 0}
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadUsers()}
            className="ml-auto rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {visibleUsers.length} {visibleUsers.length === 1 ? 'person' : 'people'}
        {isPlatformAdmin ? '. Click a permission or branch to change it.' : '. You can assign branches. Role, status, and permissions stay with the platform administrator.'}
      </p>

      {visibleUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No people match this search.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleUsers.map((account) => {
            const rootAccount = isRootAccount(account.email);
            const locked = updating === account.uid;
            const privilegeLocked = !isPlatformAdmin || locked || rootAccount;
            const statusOptions = STATUS_OPTIONS.includes(account.status) ? STATUS_OPTIONS : [account.status, ...STATUS_OPTIONS];
            return (
              <article key={account.uid} className={`min-w-0 max-w-full overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${account.status === 'pending' ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex flex-col gap-4 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {account.photoURL ? (
                      <img src={account.photoURL} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        {account.displayName?.charAt(0) || account.email?.charAt(0) || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-bold text-slate-900 dark:text-white">{account.displayName || 'No name'}</h3>
                        {rootAccount && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Platform admin</span>}
                      </div>
                      <p className="break-all text-sm text-slate-500">{account.email}</p>
                      <p className="mt-1 text-xs text-slate-400">{joinedLabel(account.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(account.status)}`}>{account.status || 'unknown'}</span>
                    {isPlatformAdmin && account.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(account.uid, 'approved')}
                        disabled={locked}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    )}
                    {locked && <span className="text-xs font-medium text-slate-400">Saving…</span>}
                  </div>
                </div>
                {rootAccount && (
                  <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">This account keeps full administrator access. Role, status, and permissions stay fixed.</p>
                )}

                <div className="grid grid-cols-2 gap-3 p-4">
                  <label className="min-w-0">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Role</span>
                    <select
                      value={account.role || ROLES.GENERAL}
                      disabled={privilegeLocked}
                      onChange={(event) => handleRoleChange(account.uid, event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {Object.values(ROLES).map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
                    <select
                      value={account.status || 'pending'}
                      disabled={privilegeLocked}
                      onChange={(event) => handleStatusChange(account.uid, event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium capitalize text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                </div>

                <section className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Access permissions</h4>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {orderedCategories(account.permissions).map((category) => {
                      const perms = account.permissions[category];
                      const actions = typeof perms === 'object' && perms ? ACTION_ORDER : ['view'];
                      return (
                        <div key={category} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{categoryLabel(category)}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {typeof perms === 'boolean' ? (
                              <Chip pressed={perms} disabled={privilegeLocked} onClick={() => togglePermission(account, category, 'view')}>View</Chip>
                            ) : (
                              actions.map((action) => (
                                <Chip
                                  key={action}
                                  pressed={Boolean(perms?.[action])}
                                  disabled={privilegeLocked}
                                  onClick={() => togglePermission(account, category, action)}
                                >
                                  {ACTION_LABELS[action] || action}
                                </Chip>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="grid gap-4 border-t border-slate-100 px-4 py-4 dark:border-slate-800 lg:grid-cols-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned branches</h4>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {branches.length === 0 && <p className="text-sm text-slate-500">No branches have been added yet.</p>}
                      {branches.map((branch) => (
                        <Chip
                          key={branch.id}
                          pressed={(account.assignedBranches || []).includes(branch.name)}
                          disabled={locked || rootAccount}
                          onClick={() => handleBranchChange(account.uid, toggleValue(account.assignedBranches, branch.name))}
                        >
                          {branch.name}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Spa intake and check-ins</h4>
                    {rootAccount ? (
                      <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">All branches</p>
                    ) : isPlatformAdmin ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {branches.map((branch) => (
                          <Chip
                            key={branch.id}
                            pressed={(account.spaIntakeBranches || []).includes(branch.name)}
                            disabled={locked}
                            onClick={() => handleSpaIntakeBranchChange(account.uid, toggleValue(account.spaIntakeBranches, branch.name))}
                          >
                            {branch.name}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 break-words text-sm text-slate-500">
                        {(account.spaIntakeBranches || []).join(', ') || 'No branch access'}
                      </p>
                    )}
                    {isPlatformAdmin && !rootAccount && (
                      <p className="mt-2 text-xs text-slate-400">Used for the spa membership list and spa check-ins.</p>
                    )}
                  </div>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
