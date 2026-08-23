'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllReports, getReportForDate, createEmptyReport, saveReport, toDateKey } from '@/lib/reports';
import { generateReportPdf } from '@/lib/reportPdf';

const todayKey = () => toDateKey(new Date());

const formatDate = (dateKey) => {
  if (!dateKey) return 'No date';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (date) => (date ? new Date(date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'S';

const makeRow = (overrides = {}) => ({
  rowId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  clientId: '',
  clientName: '',
  branch: '',
  contactMethod: '',
  callerName: '',
  comment: '',
  source: 'manual',
  ...overrides,
});

const emptySections = {
  previousDayVisits: [makeRow()],
  followUps: [makeRow()],
  whatsappMessages: [makeRow()],
};

const sectionMeta = [
  { key: 'previousDayVisits', label: 'Previous-day visits', description: 'Clients you contacted after their previous visit.', accent: 'emerald' },
  { key: 'followUps', label: 'Follow-up & complaints', description: 'Clients needing solutions, escalation, or a return call.', accent: 'amber' },
  { key: 'whatsappMessages', label: 'WhatsApp messages', description: 'Client messages, replies, and important conversations.', accent: 'violet' },
];

const normalizeAutoBirthdayRows = (clients, dateKey, caller) => {
  if (!caller?.id) return [];
  return clients
    .filter((client) => {
      const calledByCaller = client.birthdayCalledById === caller.id || (caller.name && client.birthdayCalledByName === caller.name);
      const contactDate = client.birthdayCalledAt?.toDate?.() || client.birthdayCalledAt;
      const wasContactedOnDate = contactDate && toDateKey(contactDate) === dateKey;
      const birthdayOnDate = Number(client.birthMonth) === Number(dateKey.slice(5, 7)) && Number(client.birthDay) === Number(dateKey.slice(8, 10));
      return calledByCaller && (wasContactedOnDate || birthdayOnDate);
    })
    .map((client) => makeRow({
      clientId: client.id,
      clientName: client.name || 'Unnamed client',
      branch: client.branch || '',
      contactMethod: client.birthdayContactMethod || 'Called',
      callerName: client.birthdayCalledByName || caller.name || '',
      comment: client.birthdayFeedback || client.birthdayComment || '',
      source: 'birthday-auto',
    }));
};

const getUserCaller = (user) => ({
  id: user?.uid || '',
  name: user?.displayName || user?.email || 'My calls',
  roleLabel: 'Signed-in caller',
});

function ReportRow({ row, index, readOnly, onChange, onRemove, clients }) {
  return (
    <div className="grid gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 dark:border-slate-800 sm:grid-cols-[38px_minmax(0,0.75fr)_minmax(0,1.45fr)_34px] sm:items-start">
      <div className="pt-2 text-xs font-black text-slate-400">{index + 1}</div>
      <div>
        <label className="sr-only" htmlFor={`client-${row.rowId}`}>Client name</label>
        <input
          id={`client-${row.rowId}`}
          list="report-client-options"
          value={row.clientName}
          disabled={readOnly}
          onChange={(event) => onChange({ clientName: event.target.value })}
          placeholder="Client name"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-default disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
        />
        {row.branch && <div className="mt-1 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{row.branch}</div>}
      </div>
      <div>
        <label className="sr-only" htmlFor={`comment-${row.rowId}`}>Comment or feedback</label>
        <textarea
          id={`comment-${row.rowId}`}
          value={row.comment}
          disabled={readOnly}
          onChange={(event) => onChange({ comment: event.target.value })}
          placeholder="Add comment, feedback, action taken, or next step..."
          rows={2}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-default disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900"
        />
        {row.contactMethod && <div className="mt-1 px-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">{row.contactMethod}</div>}
      </div>
      {!readOnly && (
        <button type="button" onClick={onRemove} aria-label="Remove row" className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30">×</button>
      )}
    </div>
  );
}

function ReportSectionCard({ meta, rows, readOnly, onChange, onAdd, onRemove }) {
  const accent = {
    emerald: 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10',
    amber: 'border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10',
    violet: 'border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/10',
  }[meta.accent];
  return (
    <section className={`overflow-hidden rounded-2xl border ${accent}`}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{meta.label}</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{meta.description}</p>
        </div>
        {!readOnly && <button type="button" onClick={onAdd} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">+ Add row</button>}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="hidden grid-cols-[38px_minmax(0,0.75fr)_minmax(0,1.45fr)_34px] gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 sm:grid"><span>No.</span><span>Client name</span><span>Comment or feedback</span><span /></div>
        {rows.map((row, index) => <ReportRow key={row.rowId || index} row={row} index={index} readOnly={readOnly} clients={[]} onChange={(patch) => onChange(index, patch)} onRemove={() => onRemove(index)} />)}
      </div>
    </section>
  );
}

export default function ReportsSection({ user, profile, clients = [], birthdayCallers = [], onBack }) {
  const defaultCaller = getUserCaller(user);
  const [mode, setMode] = useState('history');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedCallerId, setSelectedCallerId] = useState(defaultCaller.id);
  const [selectedBranch, setSelectedBranch] = useState(profile?.assignedBranches?.[0] || '');
  const [report, setReport] = useState(null);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const callerOptions = useMemo(() => {
    const combined = [...birthdayCallers, defaultCaller];
    const seen = new Set();
    return combined.filter((caller) => caller?.id && !seen.has(caller.id) && seen.add(caller.id));
  }, [birthdayCallers, defaultCaller]);

  const selectedCaller = callerOptions.find((caller) => caller.id === selectedCallerId) || defaultCaller;
  const canEdit = Boolean(report && report.ownerId === user?.uid);
  const assignedBranches = Array.isArray(profile?.assignedBranches) ? profile.assignedBranches.filter(Boolean) : [];
  const visibleBranches = assignedBranches.length ? assignedBranches : [...new Set(clients.map((client) => client.branch).filter(Boolean))];

  useEffect(() => {
    let active = true;
    getAllReports().then((data) => {
      if (!active) return;
      setReports(data);
      setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const historyReports = useMemo(() => reports.filter((item) => {
    const callerMatch = selectedCallerId === 'all' || !selectedCallerId || item.callerId === selectedCallerId || item.ownerId === selectedCallerId;
    const branchMatch = !selectedBranch || item.branch === selectedBranch;
    return callerMatch && branchMatch;
  }), [reports, selectedCallerId, selectedBranch]);

  const startNewReport = async (dateKey = selectedDate) => {
    setError('');
    setNotice('');
    setSelectedDate(dateKey);
    const existing = await getReportForDate(dateKey, user?.uid);
    const autoRows = normalizeAutoBirthdayRows(clients, dateKey, selectedCaller);
    const nextReport = existing || createEmptyReport({ dateKey, ownerId: user?.uid, ownerName: user?.displayName || user?.email, callerId: selectedCaller.id, callerName: selectedCaller.name, branch: selectedBranch });
    setReport({
      ...nextReport,
      callerId: nextReport.callerId || selectedCaller.id,
      callerName: nextReport.callerName || selectedCaller.name,
      branch: nextReport.branch || selectedBranch,
      birthdayClients: nextReport.birthdayClients?.length ? nextReport.birthdayClients : autoRows,
      previousDayVisits: nextReport.previousDayVisits?.length ? nextReport.previousDayVisits : emptySections.previousDayVisits,
      followUps: nextReport.followUps?.length ? nextReport.followUps : emptySections.followUps,
      whatsappMessages: nextReport.whatsappMessages?.length ? nextReport.whatsappMessages : emptySections.whatsappMessages,
    });
    setMode('editor');
  };

  const openReport = (item) => {
    setSelectedDate(item.reportDateKey);
    setReport(item);
    setMode('editor');
    setNotice(item.ownerId === user?.uid ? 'Your report is ready to continue editing.' : 'Viewing another caller’s report in read-only mode.');
  };

  const updateSectionRow = (sectionKey, index, patch) => {
    setReport((current) => ({ ...current, [sectionKey]: current[sectionKey].map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }));
  };

  const addSectionRow = (sectionKey) => setReport((current) => ({ ...current, [sectionKey]: [...current[sectionKey], makeRow()] }));
  const removeSectionRow = (sectionKey, index) => setReport((current) => ({ ...current, [sectionKey]: current[sectionKey].filter((_, rowIndex) => rowIndex !== index) }));

  const saveCurrentReport = async () => {
    if (!report || !canEdit) return;
    setIsSaving(true);
    setError('');
    const result = await saveReport(report, user, profile);
    setIsSaving(false);
    if (!result.success) {
      setError(result.error || 'Unable to save this report.');
      return;
    }
    setReport(result.report);
    setReports((current) => [result.report, ...current.filter((item) => item.id !== result.report.id)]);
    setNotice('Report saved. You can return to it anytime from Report history.');
  };

  const downloadCurrentReport = () => {
    if (!report) return;
    const dataUri = generateReportPdf(report);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `spa-ems-report-${report.reportDateKey || todayKey()}.pdf`;
    link.click();
  };

  const loadBirthdayCalls = () => {
    if (!report || !canEdit) return;
    const autoRows = normalizeAutoBirthdayRows(clients, report.reportDateKey, selectedCaller);
    setReport((current) => ({ ...current, callerId: selectedCaller.id, callerName: selectedCaller.name, birthdayClients: autoRows }));
    setNotice(autoRows.length ? `${autoRows.length} birthday call${autoRows.length === 1 ? '' : 's'} loaded for ${selectedCaller.name}.` : 'No matching birthday calls found for this date and caller.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <datalist id="report-client-options">{clients.slice(0, 300).map((client) => <option key={client.id} value={client.name}>{client.phoneNumber || ''}</option>)}</datalist>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to Home" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Operations workspace</p><h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Reports</h2></div></div>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">Create a clear daily record of birthday calls, feedback, follow-ups, and WhatsApp conversations — organized by caller and date.</p>
        </div>
        <div className="flex gap-2"><button type="button" onClick={() => setMode('history')} className={`rounded-xl px-3 py-2 text-xs font-black transition ${mode === 'history' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' : 'border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'}`}>History</button><button type="button" onClick={() => startNewReport()} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700">+ New report</button></div>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">{notice}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{error}</div>}

      {mode === 'history' ? (
        <div className="space-y-5">
          <div className="dashboard-surface rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Report archive</p><h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Find a report by caller or branch</h3></div><div className="grid gap-2 sm:grid-cols-3"><label className="text-xs font-bold text-slate-500">Caller<select value={selectedCallerId} onChange={(event) => setSelectedCallerId(event.target.value)} className="mt-1 block min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="all">All callers</option>{callerOptions.map((caller) => <option key={caller.id} value={caller.id}>{caller.name}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Branch<select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)} className="mt-1 block min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">All branches</option>{visibleBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label><label className="text-xs font-bold text-slate-500">Jump to date<input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); const match = reports.find((item) => item.reportDateKey === event.target.value); if (match) openReport(match); }} className="mt-1 block min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" /></label></div></div>
          </div>
          {isLoading ? <div className="dashboard-surface rounded-2xl p-12 text-center text-sm font-semibold text-slate-500">Loading reports...</div> : historyReports.length === 0 ? <div className="dashboard-surface rounded-2xl p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl text-blue-600 dark:bg-blue-950/30">▤</div><h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">No reports yet</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Start today’s report, then return here to review previous days or download a PDF copy.</p><button type="button" onClick={() => startNewReport()} className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Create today’s report</button></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{historyReports.map((item) => { const totals = [item.birthdayClients, item.previousDayVisits, item.followUps, item.whatsappMessages].reduce((sum, section) => sum + (section?.filter((row) => row.clientName || row.comment).length || 0), 0); return <button key={item.id} type="button" onClick={() => openReport(item)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">{formatDate(item.reportDateKey)}</p><h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">{item.callerName || item.ownerName || 'Caller report'}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.ownerId === user?.uid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{item.ownerId === user?.uid ? 'Mine' : 'View only'}</span></div><div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500"><span>{item.branch || 'All branches'}</span><span>{totals} recorded {totals === 1 ? 'entry' : 'entries'}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-black text-blue-600 dark:border-slate-800">{item.updatedAt ? `Updated ${formatTime(item.updatedAt)}` : 'Open report'}<span className="transition group-hover:translate-x-1">→</span></div></button>; })}</div>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="dashboard-surface rounded-2xl p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Daily report</p><h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{report ? formatDate(report.reportDateKey) : 'New report'}</h3><p className="mt-1 text-sm font-medium text-slate-500">{canEdit ? 'Your report is editable and autosets the caller record you choose.' : 'This report belongs to another caller and is available for reference.'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setMode('history')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">← History</button>{report && <button type="button" onClick={downloadCurrentReport} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">↓ Download PDF</button>}{canEdit && <button type="button" onClick={saveCurrentReport} disabled={isSaving} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60">{isSaving ? 'Saving...' : 'Save report'}</button>}</div></div></div>
          {report && <>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><div className="dashboard-surface rounded-2xl p-4 sm:p-5"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">{initials(report.callerName)}</div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Report owner / caller</p><p className="font-black text-slate-900 dark:text-white">{report.callerName || 'Caller'}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-500">Report date<input type="date" value={report.reportDateKey} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, reportDateKey: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900" /></label><label className="text-xs font-bold text-slate-500">Branch<select value={report.branch || ''} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, branch: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900"><option value="">All branches</option>{visibleBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select></label></div></div><div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4 sm:p-5 dark:border-blue-900/30 dark:from-blue-950/20 dark:via-slate-900 dark:to-violet-950/20"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">Birthday calls</p><div className="mt-2 flex items-end justify-between gap-3"><div><div className="text-4xl font-black text-slate-900 dark:text-white">{report.birthdayClients.filter((row) => row.clientName || row.comment).length}</div><p className="text-xs font-semibold text-slate-500">entries loaded for this caller</p></div>{canEdit && <button type="button" onClick={loadBirthdayCalls} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50 dark:bg-slate-900 dark:ring-blue-900/50">↻ Load calls</button>}</div><p className="mt-4 text-xs font-medium leading-5 text-slate-500">Pulls from birthday communications already recorded in the client database, then leaves comments open for feedback and next steps.</p></div></div>
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/10"><div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-black text-slate-900 dark:text-white">A. Birthday clients contacted</h3><p className="mt-0.5 text-xs font-medium text-slate-500">Auto-loaded from the caller’s recorded birthday communications.</p></div>{canEdit && <button type="button" onClick={() => setReport((current) => ({ ...current, birthdayClients: [...current.birthdayClients, makeRow()] }))} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">+ Add row</button>}</div><div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60">{report.birthdayClients.length ? report.birthdayClients.map((row, index) => <ReportRow key={row.rowId || index} row={row} index={index} readOnly={!canEdit} onChange={(patch) => updateSectionRow('birthdayClients', index, patch)} onRemove={() => removeSectionRow('birthdayClients', index)} clients={clients} />) : <div className="p-5 text-sm font-medium text-slate-500">No birthday calls loaded yet.</div>}</div></section>
            {sectionMeta.map((meta) => <ReportSectionCard key={meta.key} meta={meta} rows={report[meta.key] || []} readOnly={!canEdit} onChange={(index, patch) => updateSectionRow(meta.key, index, patch)} onAdd={() => addSectionRow(meta.key)} onRemove={(index) => removeSectionRow(meta.key, index)} />)}
            <section className="dashboard-surface rounded-2xl p-4 sm:p-5"><label className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Additional notes<textarea value={report.notes || ''} disabled={!canEdit} onChange={(event) => setReport((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Add handover notes, unresolved actions, or observations for the team..." className="mt-2 block w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-900" /></label></section>
          </>}
        </div>
      )}
    </div>
  );
}
