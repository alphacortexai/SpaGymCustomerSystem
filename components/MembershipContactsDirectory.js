'use client';

import { useMemo, useState } from 'react';

function toDate(value) {
  if (!value) return null;
  const date = value.toDate?.() || (value instanceof Date ? value : new Date(value));
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function isActiveMembership(enrollment, today) {
  const expiryDate = toDate(enrollment.expiryDate);
  return enrollment.status === 'active' && Boolean(expiryDate && expiryDate >= today);
}

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ${active
      ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function MembershipContactsDirectory({ serviceName, enrollments = [], clients = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [today] = useState(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  });

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const clientByName = useMemo(() => new Map(clients.map((client) => [client.name?.trim().toLowerCase(), client])), [clients]);

  const directoryRows = useMemo(() => {
    const grouped = new Map();

    enrollments.forEach((enrollment) => {
      const client = clientById.get(enrollment.clientId) || clientByName.get(enrollment.clientName?.trim().toLowerCase());
      const clientName = client?.name || enrollment.clientName || 'Unnamed client';
      const key = client?.id || enrollment.clientId || clientName.toLowerCase();
      const membership = {
        name: enrollment.membershipType || 'Membership',
        active: isActiveMembership(enrollment, today),
      };
      const existing = grouped.get(key);

      if (existing) {
        if (!existing.memberships.some((item) => item.name === membership.name && item.active === membership.active)) {
          existing.memberships.push(membership);
        }
        return;
      }

      grouped.set(key, {
        id: key,
        clientName,
        phoneNumber: client?.phoneNumber || client?.phone || 'No phone number',
        memberships: [membership],
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [clientById, clientByName, enrollments, today]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return directoryRows;
    return directoryRows.filter((row) => [
      row.clientName,
      row.phoneNumber,
      ...row.memberships.map((membership) => membership.name),
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [directoryRows, searchTerm]);

  const activeMembershipCount = directoryRows.reduce(
    (total, row) => total + row.memberships.filter((membership) => membership.active).length,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Client contact details</h2>
          <p className="mt-1 text-sm text-slate-500">{directoryRows.length} clients · {activeMembershipCount} active memberships</p>
        </div>
        <label className="w-full md:w-72">
          <span className="sr-only">Search {serviceName.toLowerCase()} client contacts</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, phone, membership..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No client contacts found</h3>
          <p className="mt-1 text-slate-500">{directoryRows.length ? 'Try adjusting your search criteria.' : `No ${serviceName.toLowerCase()} membership records are available yet.`}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                {['Client', 'Phone number', 'Membership', 'Status'].map((heading) => (
                  <th key={heading} className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.clientName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{row.phoneNumber}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {row.memberships.map((membership, index) => (
                        <div key={`${membership.name}-${index}`} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{membership.name}</span>
                          {row.memberships.length > 1 && <StatusBadge active={membership.active} />}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4"><StatusBadge active={row.memberships.some((membership) => membership.active)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

