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
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black ${active
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
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

  const activeClientCount = directoryRows.filter((row) => row.memberships.some((membership) => membership.active)).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">{serviceName} directory</p>
          <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Client contact details</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{directoryRows.length} clients · {activeClientCount} active memberships</p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Search {serviceName.toLowerCase()} client contacts</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, phone, membership..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </label>
      </div>

      {filteredRows.length === 0 ? (
        <div className="p-10 text-center">
          <h4 className="font-bold text-slate-900 dark:text-white">No client contacts found</h4>
          <p className="mt-1 text-sm text-slate-500">{directoryRows.length ? 'Try a different search.' : `No ${serviceName.toLowerCase()} membership records are available yet.`}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                {['Client', 'Phone number', 'Membership', 'Status'].map((heading) => (
                  <th key={heading} className="px-5 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-4 text-sm font-black text-slate-900 dark:text-white">{row.clientName}</td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{row.phoneNumber}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      {row.memberships.map((membership, index) => (
                        <div key={`${membership.name}-${index}`} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{membership.name}</span>
                          {row.memberships.length > 1 && <StatusBadge active={membership.active} />}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge active={row.memberships.some((membership) => membership.active)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

