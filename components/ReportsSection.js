'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteReport, getAllReports, getReportForDate, createEmptyReport, saveReport, toDateKey } from '@/lib/reports';
import { generateReportPdf } from '@/lib/reportPdf';
import { getAllClients, getClientSearchHints } from '@/lib/clients';

const REPORT_TYPE = 'feedback-birthdays-whatsapp-calls';
const REPORT_TYPE_LABEL = 'Feedback, Birthdays, WhatsApp & Calls Report';
const todayKey = () => toDateKey(new Date());

const formatDate = (dateKey) => {
  if (!dateKey) return 'No date';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (date) => (date ? new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';
const makeRow = (overrides = {}) => ({ rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, clientId: '', clientName: '', phoneNumber: '', branch: '', contactMethod: '', callerName: '', comment: '', customFields: {}, source: 'manual', ...overrides });

const sectionMeta = [
  { key: 'birthdayClients', label: 'A. Birthday Clients Contacted', description: 'Birthday outreach already recorded for the selected caller.', accent: 'blue' },
  { key: 'previousDayVisits', label: 'B. Clients from Prev Day Visits', description: 'Clients contacted after their previous visit, including follow-ups and solutions.', accent: 'emerald' },
  { key: 'whatsappMessages', label: 'C. WhatsApp Messages', description: 'Important client messages, replies, and conversations.', accent: 'violet' },
];

const emptySections = Object.fromEntries(sectionMeta.map(({ key }) => [key, [makeRow()]]));

const normalizeUser = (record = {}) => ({
  id: record.id || record.uid || '',
  name: record.name || record.displayName || record.email || 'Unnamed user',
  email: record.email || '',
  roleLabel: record.roleLabel || record.role || 'Staff member',
});

const normalizeAutoBirthdayRows = (clients, dateKey, caller) => {
  if (!caller?.id) return [];
  return clients.filter((client) => {
    const calledByCaller = client.birthdayCalledById === caller.id || (caller.name && client.birthdayCalledByName === caller.name);
    const contactDate = client.birthdayCalledAt?.toDate?.() || client.birthdayCalledAt;
    const wasContactedOnDate = contactDate && toDateKey(contactDate) === dateKey;
    const birthdayOnDate = Number(client.birthMonth) === Number(dateKey.slice(5, 7)) && Number(client.birthDay) === Number(dateKey.slice(8, 10));
    return calledByCaller && (wasContactedOnDate || birthdayOnDate);
  }).map((client) => makeRow({
    clientId: client.id,
    clientName: client.name || 'Unnamed client',
    phoneNumber: client.phoneNumber || '',
    branch: client.branch || '',
    contactMethod: client.birthdayContactMethod || 'Called',
    callerName: client.birthdayCalledByName || caller.name || '',
    comment: client.birthdayFeedback || client.birthdayComment || '',
    source: 'birthday-auto',
  }));
};

const enrichReportRows = (report, clients) => {
  const clientList = Array.isArray(clients) ? clients : [];
  const hydrate = (row) => {
    const client = clientList.find((candidate) => candidate.id === row.clientId || (candidate.name && row.clientName && candidate.name.trim().toLowerCase() === row.clientName.trim().toLowerCase()));
    return client ? { ...row, clientId: row.clientId || client.id, clientName: row.clientName || client.name || '', phoneNumber: row.phoneNumber || client.phoneNumber || '', branch: row.branch || client.branch || '' } : row;
  };
  return {
    ...report,
    birthdayClients: (report.birthdayClients || []).map(hydrate),
    previousDayVisits: [...(report.previousDayVisits || []), ...(report.followUps || [])].map(hydrate),
    followUps: [],
    whatsappMessages: (report.whatsappMessages || []).map(hydrate),
  };
};

const unavailableContactModes = new Set(['', 'unavailable', 'not available', 'n/a', 'na', 'none', 'unknown']);
const hasAvailableContactMode = (row) => !unavailableContactModes.has(String(row.contactMethod || '').trim().toLowerCase());
const orderRowsByContactMode = (rows = []) => rows.map((row, originalIndex) => ({ row, originalIndex })).sort((a, b) => Number(hasAvailableContactMode(b.row)) - Number(hasAvailableContactMode(a.row)));
const rowHasContent = (row, customColumns = []) => Boolean(row.clientName || row.phoneNumber || row.contactMethod || row.comment || customColumns.some((column) => row.customFields?.[column.id]));
const reportEntryCount = (report) => sectionMeta.reduce((total, section) => total + (report?.[section.key]?.filter((row) => rowHasContent(row, report.customColumns)).length || 0), 0);

function CellButton({ value, placeholder, onClick, readOnly }) {
  return <button type="button" onClick={onClick} className={`min-h-11 w-full rounded-lg px-2 py-2 text-left text-xs transition ${value ? 'font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-blue-950/30' : 'font-medium italic text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'} ${readOnly ? '' : 'cursor-pointer'}`}><span className="line-clamp-3">{value || placeholder}</span></button>;
}

function ReportTable({ section, rows, customColumns, readOnly, onCellClick, onAddRow, onRemoveRow, onAddColumn }) {
  const columns = [
    { id: 'clientName', label: 'Client name' },
    { id: 'phoneNumber', label: 'Phone' },
    { id: 'contactMethod', label: 'Contact mode' },
    { id: 'comment', label: 'Feedback / comments' },
    ...customColumns,
  ];
  const orderedRows = orderRowsByContactMode(rows);
  return (
    <section className={`overflow-hidden rounded-2xl border ${section.accent === 'blue' ? 'border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/10' : section.accent === 'emerald' ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10' : section.accent === 'amber' ? 'border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10' : 'border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/10'}`}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black text-slate-900 dark:text-white">{section.label}</h3><p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{section.description}</p></div><div className="flex flex-wrap gap-2">{!readOnly && <button type="button" onClick={onAddRow} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">+ Add row</button>}{!readOnly && <button type="button" onClick={onAddColumn} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">+ New column</button>}</div></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/85 dark:border-slate-800 dark:bg-slate-950/60"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-b border-slate-100 dark:border-slate-800"><th className="w-12 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">No.</th>{columns.map((column) => <th key={column.id} className="min-w-40 px-2 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{column.label}</th>)}{!readOnly && <th className="w-12 px-2 py-3" />}</tr></thead><tbody>{orderedRows.map(({ row, originalIndex }, displayIndex) => <tr key={row.rowId || originalIndex} className="border-b border-slate-100 align-top last:border-b-0 dark:border-slate-800"><td className="px-3 py-2 text-xs font-black text-slate-400">{displayIndex + 1}</td>{columns.map((column) => <td key={column.id} className="px-1 py-1"><CellButton value={column.id === 'clientName' ? row.clientName : column.id === 'phoneNumber' ? row.phoneNumber : column.id === 'contactMethod' ? row.contactMethod : column.id === 'comment' ? row.comment : row.customFields?.[column.id]} placeholder={column.id === 'comment' ? 'Enter feedback or comments' : `Enter ${column.label.toLowerCase()}`} readOnly={readOnly} onClick={() => onCellClick(originalIndex, ['clientName', 'phoneNumber', 'contactMethod', 'comment'].includes(column.id) ? column.id : `custom:${column.id}`, column.label)} /></td>)}{!readOnly && <td className="px-2 py-2"><button type="button" onClick={() => onRemoveRow(originalIndex)} aria-label="Remove row" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30">×</button></td>}</tr>)}</tbody></table></div>
    </section>
  );
}

function ReportHistoryTable({ reports, user, profile, onOpen, onDelete }) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60"><th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Report date</th><th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Caller</th><th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Branch</th><th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Entries</th><th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status</th><th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actions</th></tr></thead><tbody>{reports.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"><td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100">{formatDate(item.reportDateKey)}</td><td className="px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">{item.callerName || item.ownerName || 'Caller'}</td><td className="px-4 py-3 text-sm font-semibold text-slate-500">{item.branch || 'All branches'}</td><td className="px-4 py-3 text-sm font-semibold text-slate-500">{reportEntryCount(item)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.ownerId === user?.uid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{item.ownerId === user?.uid ? 'Mine' : 'View only'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => onOpen(item)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700">Open</button>{(item.ownerId === user?.uid || profile?.role === 'Admin') && <button type="button" onClick={() => onDelete(item)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20">Delete</button>}</div></td></tr>)}</tbody></table></div>;
}

function CellDialog({ cell, readOnly, clients, onClose, onSave }) {
  const [value, setValue] = useState(cell?.value || '');
  const [clientMatch, setClientMatch] = useState(null);
  if (!cell) return null;
  const isClient = cell.field === 'clientName';
  const searchResults = isClient && value.trim() ? getClientSearchHints(clients, value, null, 50) : [];
  const save = () => {
    const matchedClient = isClient ? clients.find((client) => client.name && client.name.trim().toLowerCase() === value.trim().toLowerCase()) : null;
    onSave(value, matchedClient);
  };
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-cell-title"><div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Table cell entry</p><h3 id="report-cell-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{cell.columnLabel}</h3><p className="mt-1 text-xs font-medium text-slate-500">{cell.sectionLabel} · Row {cell.rowIndex + 1}</p></div><button type="button" onClick={onClose} aria-label="Close dialog" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">×</button></div><div className="mt-5">{isClient ? <><input autoFocus value={value} onChange={(event) => { setValue(event.target.value); setClientMatch(clients.find((client) => client.name && client.name.trim().toLowerCase() === event.target.value.trim().toLowerCase()) || null); }} disabled={readOnly} placeholder="Search any client by name or phone" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800" />{!readOnly && searchResults.length > 0 && <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950">{searchResults.map((client) => <button type="button" key={client.id} onClick={() => { setValue(client.name || ''); setClientMatch(client); }} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/30"><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">{client.name}</span><span className="block truncate text-[11px] font-medium text-slate-500">{client.phoneNumber || 'No phone saved'}{client.branch ? ` · ${client.branch}` : ''}</span></span><span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Select</span></button>)}</div>}{clientMatch && <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">Phone will auto-fill: {clientMatch.phoneNumber || 'No phone saved'}</p>}</> : cell.field === 'contactMethod' ? <select autoFocus value={value} onChange={(event) => setValue(event.target.value)} disabled={readOnly} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"><option value="">Select contact mode</option><option value="Phone call">Phone call</option><option value="WhatsApp">WhatsApp</option><option value="SMS">SMS</option><option value="In person">In person</option><option value="Called">Called</option><option value="Not reached">Not reached</option></select> : <textarea autoFocus value={value} onChange={(event) => setValue(event.target.value)} disabled={readOnly} rows={cell.field === 'comment' ? 6 : 3} placeholder={`Enter ${cell.columnLabel.toLowerCase()}`} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800" />}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{readOnly ? 'Close' : 'Cancel'}</button>{!readOnly && <button type="button" onClick={save} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Save cell</button>}</div></div></div>;
}

function ColumnDialog({ onClose, onSave }) {
  const [label, setLabel] = useState('');
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-column-title"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">Customize table</p><h3 id="new-column-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">Add a new column</h3><p className="mt-1 text-sm text-slate-500">Create a field for any extra detail your team needs to record.</p><input autoFocus value={label} onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(label); }} placeholder="For example: Action owner" className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button><button type="button" onClick={() => onSave(label)} disabled={!label.trim()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">Add column</button></div></div></div>;
}

export default function ReportsSection({ user, profile, clients = [], birthdayCallers = [], onBack }) {
  const [workspaceStep, setWorkspaceStep] = useState('users');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reportType, setReportType] = useState(REPORT_TYPE);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedBranch, setSelectedBranch] = useState(profile?.assignedBranches?.[0] || '');
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportClients, setReportClients] = useState([]);
  const [cellDialog, setCellDialog] = useState(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const defaultUser = useMemo(() => normalizeUser({ id: user?.uid, name: user?.displayName, email: user?.email, role: profile?.role }), [profile?.role, user?.displayName, user?.email, user?.uid]);
  const callerOptions = useMemo(() => birthdayCallers.map(normalizeUser).filter((candidate) => candidate.id), [birthdayCallers]);
  const selectedUser = callerOptions.find((candidate) => candidate.id === selectedUserId) || defaultUser;
  const canEdit = Boolean(report && report.ownerId === user?.uid);
  const canDelete = Boolean(report && (report.ownerId === user?.uid || profile?.role === 'Admin'));
  const assignedBranches = Array.isArray(profile?.assignedBranches) ? profile.assignedBranches.filter(Boolean) : [];
  const clientDirectory = reportClients.length ? reportClients : clients;
  const visibleBranches = assignedBranches.length ? assignedBranches : [...new Set(clientDirectory.map((client) => client.branch).filter(Boolean))];

  useEffect(() => {
    let active = true;
    Promise.all([getAllReports(), getAllClients(null)]).then(([allReports, allClients]) => {
      if (!active) return;
      setReports(allReports);
      setReportClients(allClients);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const historyReports = useMemo(() => reports.filter((item) => {
    const callerMatch = !selectedUserId || item.callerId === selectedUserId || item.ownerId === selectedUserId;
    const branchMatch = !selectedBranch || item.branch === selectedBranch;
    return callerMatch && branchMatch;
  }), [reports, selectedBranch, selectedUserId]);

  const goToUsers = () => { setWorkspaceStep('users'); setReport(null); setSelectedUserId(''); setError(''); };
  const chooseUser = (candidate) => { setSelectedUserId(candidate.id); setWorkspaceStep('types'); setError(''); setNotice(`${candidate.name}'s report workspace is ready.`); };
  const chooseReportType = () => setWorkspaceStep('history');

  const startNewReport = async (dateKey = selectedDate) => {
    setError('');
    setSelectedDate(dateKey);
    const existing = await getReportForDate(dateKey, user?.uid);
    const autoRows = normalizeAutoBirthdayRows(clientDirectory, dateKey, selectedUser);
    const nextReport = existing || createEmptyReport({ dateKey, ownerId: user?.uid, ownerName: user?.displayName || user?.email, callerId: selectedUser.id, callerName: selectedUser.name, branch: selectedBranch });
    const hydrated = enrichReportRows({ ...nextReport, reportType: nextReport.reportType || REPORT_TYPE }, clientDirectory);
    setReport({ ...hydrated, callerId: hydrated.callerId || selectedUser.id, callerName: hydrated.callerName || selectedUser.name, branch: hydrated.branch || selectedBranch, birthdayClients: hydrated.birthdayClients?.length ? hydrated.birthdayClients : autoRows, previousDayVisits: hydrated.previousDayVisits?.length ? hydrated.previousDayVisits : emptySections.previousDayVisits, whatsappMessages: hydrated.whatsappMessages?.length ? hydrated.whatsappMessages : emptySections.whatsappMessages });
    setWorkspaceStep('editor');
  };

  const openReport = (item) => { setSelectedDate(item.reportDateKey); setReport(enrichReportRows(item, clientDirectory)); setWorkspaceStep('editor'); setNotice(item.ownerId === user?.uid ? 'Your report is ready to continue editing.' : 'Viewing another user’s report in read-only mode.'); };

  const handleCellSave = (value, matchedClient) => {
    const { sectionKey, rowIndex, field } = cellDialog;
    setReport((current) => {
      const nextRows = current[sectionKey].map((row, index) => {
        if (index !== rowIndex) return row;
        const patch = field === 'clientName' && matchedClient ? { clientName: value, clientId: matchedClient.id, phoneNumber: matchedClient.phoneNumber || '', branch: matchedClient.branch || '' } : field.startsWith('custom:') ? { customFields: { ...row.customFields, [field.slice(7)]: value } } : { [field]: value };
        return { ...row, ...patch };
      });
      return { ...current, [sectionKey]: nextRows };
    });
    setCellDialog(null);
  };

  const openCell = (sectionKey, rowIndex, field, columnLabel) => {
    const row = report?.[sectionKey]?.[rowIndex] || {};
    const value = field === 'clientName' ? row.clientName : field === 'phoneNumber' ? row.phoneNumber : field === 'contactMethod' ? row.contactMethod : field === 'comment' ? row.comment : row.customFields?.[field.slice(7)] || '';
    setCellDialog({ sectionKey, rowIndex, field, value, columnLabel, sectionLabel: sectionMeta.find((section) => section.key === sectionKey)?.label || '' });
  };

  const addRow = (sectionKey) => setReport((current) => ({ ...current, [sectionKey]: [...(current[sectionKey] || []), makeRow()] }));
  const removeRow = (sectionKey, rowIndex) => setReport((current) => ({ ...current, [sectionKey]: current[sectionKey].filter((_, index) => index !== rowIndex) }));
  const addColumn = (label) => { const normalizedLabel = label.trim(); if (!normalizedLabel) return; const id = `${normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`; setReport((current) => ({ ...current, customColumns: [...(current.customColumns || []), { id, label: normalizedLabel }] })); setColumnDialogOpen(false); };

  const saveCurrentReport = async () => {
    if (!report || !canEdit) return;
    setIsSaving(true);
    setError('');
    const result = await saveReport({ ...report, reportType }, user, profile);
    setIsSaving(false);
    if (!result.success) { setError(result.error || 'Unable to save this report.'); return; }
    setReport(result.report);
    setReports((current) => [result.report, ...current.filter((item) => item.id !== result.report.id)]);
    setNotice('Report saved. You can return to it anytime from this workspace.');
  };

  const removeReport = async (item) => {
    if (!window.confirm(`Delete the report for ${formatDate(item.reportDateKey)}? This cannot be undone.`)) return;
    const result = await deleteReport(item.id, user, profile?.role === 'Admin');
    if (!result.success) { setError(result.error || 'Unable to delete report.'); return; }
    setReports((current) => current.filter((candidate) => candidate.id !== item.id));
    if (report?.id === item.id) { setReport(null); setWorkspaceStep('history'); }
    setNotice('Report deleted.');
  };

  const downloadCurrentReport = () => { if (!report) return; const link = document.createElement('a'); link.href = generateReportPdf(report); link.download = `spa-ems-report-${report.reportDateKey || todayKey()}.pdf`; link.click(); };
  const loadBirthdayCalls = () => { if (!report || !canEdit) return; const autoRows = normalizeAutoBirthdayRows(clientDirectory, report.reportDateKey, selectedUser); setReport((current) => ({ ...current, callerId: selectedUser.id, callerName: selectedUser.name, birthdayClients: autoRows })); setNotice(autoRows.length ? `${autoRows.length} birthday call${autoRows.length === 1 ? '' : 's'} loaded for ${selectedUser.name}.` : 'No matching birthday calls found for this date and caller.'); };

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to Home" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Operations workspace</p><h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Reports Workspace</h2></div></div><p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">Choose a user, choose the report type, and keep every daily caller record organized in one place.</p></div><div className="flex flex-wrap gap-2">{workspaceStep !== 'users' && <button type="button" onClick={goToUsers} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">Change user</button>}{workspaceStep === 'editor' && report && <button type="button" onClick={downloadCurrentReport} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">↓ Download PDF</button>}{workspaceStep === 'editor' && canEdit && <button type="button" onClick={saveCurrentReport} disabled={isSaving} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{isSaving ? 'Saving...' : 'Save report'}</button>}</div></div>
    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">{notice}</div>}{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{error}</div>}

    {workspaceStep === 'users' && <div className="space-y-5"><div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-slate-900 dark:to-violet-950/20"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Step 1</p><h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Select name to make report</h3><p className="mt-1 max-w-xl text-sm font-medium text-slate-500">Select a caller name to open that report workspace. You can view saved reports here and continue with the report operations for that caller.</p></div>{isLoading ? <div className="dashboard-surface rounded-2xl p-12 text-center text-sm font-semibold text-slate-500">Loading caller names...</div> : callerOptions.length === 0 ? <div className="dashboard-surface rounded-2xl p-10 text-center"><h3 className="text-lg font-black text-slate-900 dark:text-white">No caller names available</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">An Admin must create an active caller name before reports can be prepared.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{callerOptions.map((candidate) => <button type="button" key={candidate.id} onClick={() => chooseUser(candidate)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-black text-white">{initials(candidate.name)}</span><span className="min-w-0"><span className="block truncate text-base font-black text-slate-900 dark:text-white">{candidate.name}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{candidate.roleLabel}</span></span><span className="ml-auto text-lg text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600">→</span></button>)}</div>}</div>}

    {workspaceStep === 'types' && <div className="space-y-5"><div className="dashboard-surface rounded-2xl p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-black text-white">{initials(selectedUser.name)}</span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Selected user</p><h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedUser.name}</h3></div></div></div><div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 dark:border-violet-900/40 dark:from-violet-950/20 dark:via-slate-900 dark:to-blue-950/20"><p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Step 2</p><h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Choose a report type</h3><p className="mt-1 text-sm font-medium text-slate-500">The first workspace combines the current feedback, birthday, WhatsApp, and calls format.</p></div><button type="button" onClick={chooseReportType} className="group w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-2xl text-white">▤</span><span className="flex-1"><span className="block text-xl font-black text-slate-900 dark:text-white">{REPORT_TYPE_LABEL}</span><span className="mt-1 block text-sm font-medium text-slate-500">Daily caller records with separate phone, contact mode, feedback, and expandable custom columns.</span></span><span className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white group-hover:bg-blue-700">Open workspace →</span></div></button></div>}

    {workspaceStep === 'history' && <div className="space-y-5"><div className="dashboard-surface rounded-2xl p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{REPORT_TYPE_LABEL}</p><h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{selectedUser.name} Report History</h3><p className="mt-1 text-sm font-medium text-slate-500">Open, edit, download, or delete saved daily reports for this caller.</p></div><div className="grid gap-2 sm:grid-cols-3"><label className="text-xs font-bold text-slate-500">Branch<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="mt-1 block w-full min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">All branches</option>{visibleBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Jump to date<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); const match = historyReports.find((item) => item.reportDateKey === event.target.value); if (match) openReport(match); }} className="mt-1 block w-full min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" /></label><button type="button" onClick={() => startNewReport()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">+ New report</button></div></div></div>{historyReports.length === 0 ? <div className="dashboard-surface rounded-2xl p-12 text-center"><h3 className="text-lg font-black text-slate-900 dark:text-white">No reports for this user yet</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Start a new daily report to create the first organized record for this workspace.</p><button type="button" onClick={() => startNewReport()} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Create today’s report</button></div> : <ReportHistoryTable reports={historyReports} user={user} profile={profile} onOpen={openReport} onDelete={removeReport} />}</div>}

    {workspaceStep === 'editor' && report && <div className="space-y-5"><div className="dashboard-surface rounded-2xl p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{REPORT_TYPE_LABEL}</p><h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatDate(report.reportDateKey)}</h3><p className="mt-1 text-sm font-medium text-slate-500">{canEdit ? 'Click any table cell to enter or update details.' : 'This report belongs to another user and is available in read-only mode.'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setWorkspaceStep('history')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">← History</button>{canDelete && <button type="button" onClick={() => removeReport(report)} className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20">Delete report</button>}</div></div></div><div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><div className="dashboard-surface rounded-2xl p-4 sm:p-5"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">{initials(report.callerName)}</div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Selected user / caller</p><p className="font-black text-slate-900 dark:text-white">{report.callerName || selectedUser.name}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Report date<input type="date" value={report.reportDateKey} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, reportDateKey: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900" /></label><label className="text-xs font-bold text-slate-500">Branch<select value={report.branch || ''} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, branch: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900"><option value="">All branches</option>{visibleBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label></div></div><div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4 sm:p-5 dark:border-blue-900/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-violet-950/20"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Report overview</p><div className="mt-2 flex items-end justify-between"><div><div className="text-4xl font-black text-slate-900 dark:text-white">{reportEntryCount(report)}</div><p className="text-xs font-semibold text-slate-500">recorded entries</p></div>{canEdit && <button type="button" onClick={loadBirthdayCalls} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50 dark:bg-slate-900 dark:ring-blue-900/50">↻ Load birthdays</button>}</div><p className="mt-4 text-xs font-medium leading-5 text-slate-500">Phone numbers are linked automatically when a saved client is selected. Add extra columns whenever your team needs another field.</p></div></div>{sectionMeta.map((section) => <ReportTable key={section.key} section={section} rows={report[section.key] || []} customColumns={report.customColumns || []} readOnly={!canEdit} onCellClick={(rowIndex, field, columnLabel) => openCell(section.key, rowIndex, field, columnLabel)} onAddRow={() => addRow(section.key)} onRemoveRow={(rowIndex) => removeRow(section.key, rowIndex)} onAddColumn={() => setColumnDialogOpen(true)} />)}<section className="dashboard-surface rounded-2xl p-4 sm:p-5"><label className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Additional notes<textarea value={report.notes || ''} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Add handover notes, unresolved actions, or observations for the team..." className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900" /></label></section></div>}

    {cellDialog && <CellDialog key={`${cellDialog.sectionKey}-${cellDialog.rowIndex}-${cellDialog.field}`} cell={cellDialog} readOnly={!canEdit} clients={clientDirectory} onClose={() => setCellDialog(null)} onSave={handleCellSave} />}{columnDialogOpen && <ColumnDialog onClose={() => setColumnDialogOpen(false)} onSave={addColumn} />}
  </div>;
}
