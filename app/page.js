'use client';

import { isValidElement, useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import * as XLSX from 'xlsx';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { signOut } from '@/lib/auth';
import ClientList from '@/components/ClientList';
import { searchClients } from '@/lib/clients';
import { affirmations } from '@/lib/affirmations';
import { getActiveNotesCount } from '@/lib/notes';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingState from '@/components/LoadingState';

const LazySectionFallback = () => (
  <div className="card-bg-doc rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
    Loading section...
  </div>
);

const ClientForm = dynamic(() => import('@/components/ClientForm'), { loading: LazySectionFallback });
const ExcelUpload = dynamic(() => import('@/components/ExcelUpload'), { loading: LazySectionFallback });
const BranchForm = dynamic(() => import('@/components/BranchForm'), { loading: LazySectionFallback });
const UnrecognizedClientsList = dynamic(() => import('@/components/UnrecognizedClientsList'), { loading: LazySectionFallback });
const UploadHistory = dynamic(() => import('@/components/UploadHistory'), { loading: LazySectionFallback });
const MembershipForm = dynamic(() => import('@/components/MembershipForm'), { loading: LazySectionFallback });
const MembershipTypeManager = dynamic(() => import('@/components/MembershipTypeManager'), { loading: LazySectionFallback });
const PartnerCompanyManager = dynamic(() => import('@/components/PartnerCompanyManager'), { loading: LazySectionFallback });
const EnrollmentForm = dynamic(() => import('@/components/EnrollmentForm'), { loading: LazySectionFallback });
const MembershipList = dynamic(() => import('@/components/MembershipList'), { loading: LazySectionFallback });
const SpaMembershipForm = dynamic(() => import('@/components/SpaMembershipForm'), { loading: LazySectionFallback });
const SpaMembershipTypeManager = dynamic(() => import('@/components/SpaMembershipTypeManager'), { loading: LazySectionFallback });
const SpaEnrollmentForm = dynamic(() => import('@/components/SpaEnrollmentForm'), { loading: LazySectionFallback });
const SpaMembershipList = dynamic(() => import('@/components/SpaMembershipList'), { loading: LazySectionFallback });
const UserManagement = dynamic(() => import('@/components/UserManagement'), { loading: LazySectionFallback });
const UserProfile = dynamic(() => import('@/components/UserProfile'), { loading: LazySectionFallback });
const ActionsTimeline = dynamic(() => import('@/components/ActionsTimeline'), { loading: LazySectionFallback });
const DuplicateSearch = dynamic(() => import('@/components/DuplicateSearch'), { loading: LazySectionFallback });
const NviewDashboard = dynamic(() => import('@/components/NviewDashboard'), { loading: LazySectionFallback });
const InvoiceGenerator = dynamic(() => import('@/components/InvoiceGenerator'), { loading: LazySectionFallback });
const InvoiceList = dynamic(() => import('@/components/InvoiceList'), { loading: LazySectionFallback });
const InvoiceTracking = dynamic(() => import('@/components/InvoiceTracking'), { loading: LazySectionFallback });
const NotesSection = dynamic(() => import('@/components/NotesSection'), { loading: LazySectionFallback });

const NavCard = ({ onClick, icon, title, titleLines, description, badge, isImage, fullBg, centerBadge, accent = 'blue', eyebrow }) => {
  const accentStyles = {
    blue: {
      gradient: 'from-blue-500/16 via-sky-400/10 to-cyan-300/12',
      icon: 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-500/10 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/70',
      glow: 'bg-blue-500/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
    amber: {
      gradient: 'from-amber-400/18 via-orange-300/10 to-yellow-200/14',
      icon: 'bg-amber-50 text-amber-700 border-amber-100 shadow-amber-500/10 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
      glow: 'bg-amber-400/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
    violet: {
      gradient: 'from-violet-500/16 via-fuchsia-400/10 to-pink-300/12',
      icon: 'bg-violet-50 text-violet-600 border-violet-100 shadow-violet-500/10 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60',
      glow: 'bg-violet-500/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
    emerald: {
      gradient: 'from-emerald-500/16 via-teal-400/10 to-lime-300/12',
      icon: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/10 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
      glow: 'bg-emerald-500/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
    rose: {
      gradient: 'from-rose-500/16 via-pink-400/10 to-orange-300/12',
      icon: 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/10 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
      glow: 'bg-rose-500/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
    slate: {
      gradient: 'from-slate-500/14 via-slate-300/10 to-slate-100/20',
      icon: 'bg-slate-50 text-slate-600 border-slate-100 shadow-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      glow: 'bg-slate-400/20',
      badge: 'bg-blue-600 shadow-blue-500/30',
    },
  };
  const selectedAccent = accentStyles[accent] || accentStyles.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-grid-card group relative flex min-h-[166px] cursor-pointer flex-col items-start justify-end p-5 sm:p-6 ${fullBg ? 'bg-transparent' : 'card-bg-doc'} rounded-[24px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-left w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
      aria-label={`Open ${title}`}
    >
      {fullBg && isImage && (
        <div className="absolute inset-0 z-0">
          <Image src={icon} alt={title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-1" />
        </div>
      )}
      {!fullBg && (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${selectedAccent.gradient} opacity-80 transition-opacity duration-300 group-hover:opacity-100`} />
          <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${selectedAccent.glow} transition-transform duration-500 group-hover:scale-125`} />
          <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </>
      )}
      {badge !== undefined && (
        <div className={centerBadge
          ? "absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          : `absolute top-3 right-3 min-w-[22px] h-6 px-2 flex items-center justify-center ${selectedAccent.badge} text-white text-[10px] font-bold rounded-full shadow-lg z-10 ring-2 ring-white/80 dark:ring-slate-950/80`
        }>
          <div className={centerBadge
            ? "text-white text-4xl md:text-5xl font-black drop-shadow-lg"
            : ""
          }>
            {badge}
          </div>
        </div>
      )}
      <div className={`relative z-20 ${fullBg ? 'mt-auto' : ''} w-full`}>
        {eyebrow && <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{eyebrow}</div>}
        <div className="mb-3 flex items-center justify-between gap-3">{!fullBg && <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-sm ${selectedAccent.icon}`}>{isImage ? <span className="relative h-5 w-5"><Image src={icon} alt="" fill className="object-contain" /></span> : isValidElement(icon) ? icon : <span>{icon}</span>}</span>}</div><h3 className={`${titleLines ? 'text-2xl leading-[1.15] sm:text-3xl' : 'text-lg'} font-bold ${fullBg ? 'text-white' : 'text-slate-900 dark:text-white'} mb-1`}>{titleLines ? titleLines.map((line) => <span key={line} className="block mb-1.5 last:mb-0">{line}</span>) : title}</h3>
        <p className={`text-sm ${fullBg ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'} leading-tight line-clamp-2 px-1`}>{description}</p>
      </div>
    </button>
  );
};

const TypedGreeting = ({ firstName }) => {
  const prefix = 'Good to see you, ';
  const fullGreeting = `${prefix}${firstName}.`;
  const [typedLength, setTypedLength] = useState(0);
  const typedGreeting = fullGreeting.slice(0, typedLength);
  const prefixText = typedGreeting.slice(0, prefix.length);
  const nameText = typedGreeting.slice(prefix.length);
  const isComplete = typedLength >= fullGreeting.length;

  useEffect(() => {
    let currentLength = 0;
    const typingTimer = setInterval(() => {
      currentLength += 1;
      setTypedLength(currentLength);
      if (currentLength >= fullGreeting.length) clearInterval(typingTimer);
    }, 42);
    return () => clearInterval(typingTimer);
  }, [fullGreeting]);

  return (
    <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl lg:text-4xl" aria-label={fullGreeting}>
      {prefixText}
      {nameText && <span className="text-blue-600 dark:text-blue-400">{nameText}</span>}
      {!isComplete && <span className="ml-0.5 inline-block h-[1em] w-0.5 align-[-0.12em] bg-blue-600 dark:bg-blue-400" aria-hidden="true" />}
    </h1>
  );
};

const TypedBirthdayReminder = ({ count, branchName }) => {
  const message = `You have ${count} Birthday Babies to call today for ${branchName}`;
  const [typedLength, setTypedLength] = useState(0);
  const isComplete = typedLength >= message.length;

  useEffect(() => {
    let currentLength = 0;
    const typingTimer = setInterval(() => {
      currentLength += 1;
      setTypedLength(currentLength);
      if (currentLength >= message.length) clearInterval(typingTimer);
    }, 32);
    return () => clearInterval(typingTimer);
  }, [message]);

  const countStart = 'You have '.length;
  const countEnd = countStart + String(count).length;
  const branchStart = message.length - branchName.length;
  const renderSegment = (start, end, className = '') => {
    const visibleLength = Math.min(Math.max(typedLength - start, 0), end - start);
    if (visibleLength <= 0) return null;
    return <span className={className}>{message.slice(start, start + visibleLength)}</span>;
  };

  return (
    <h1 className="text-lg font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-3xl lg:text-4xl" aria-label={message}>
      {renderSegment(0, countStart)}
      {renderSegment(countStart, countEnd, 'text-blue-600 dark:text-blue-400')}
      {renderSegment(countEnd, branchStart)}
      {renderSegment(branchStart, message.length, 'text-blue-600 dark:text-blue-400')}
      {!isComplete && <span className="ml-0.5 inline-block h-[1em] w-0.5 align-[-0.12em] bg-blue-600 dark:bg-blue-400" aria-hidden="true" />}
    </h1>
  );
};

const SectionBackArrow = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
  >
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
  </button>
);

const AdminBackButton = ({ onBack }) => (
  <button
    type="button"
    onClick={onBack}
    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
  >
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    Back to Admin
  </button>
);

const QuickActionIcon = ({ name }) => {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
    clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    birthdays: 'M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7H8.5a2.5 2.5 0 1 1 0-5C12 2 12 7 12 7ZM12 7h3.5a2.5 2.5 0 1 0 0-5C12 2 12 7 12 7Z',
    gym: 'M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12',
    spa: 'M12 21c4-3 7-6.5 7-11a7 7 0 0 0-14 0c0 4.5 3 8 7 11ZM9 10c1.5-1.5 4.5-1.5 6 0',
    notes: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
    invoices: 'M6 2h9l3 3v17H6zM15 2v4h4M9 11h6M9 15h6M9 19h4',
    tracking: 'M4 19 20 5M10 5h10v10M4 5h.01M4 12h.01M4 19h.01',
    admin: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M2 12h2M20 12h2M12 2v2M12 20v2',
    upload: 'M12 16V3M7 8l5-5 5 5M4 14v6h16v-6',
    issues: 'M12 9v4M12 17h.01M10.3 3h3.4L21 16.5a2 2 0 0 1-1.7 3H4.7a2 2 0 0 1-1.7-3L10.3 3Z',
    history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    branches: 'M6 3v18M18 3v18M6 7h12M6 17h12M12 7v10',
    duplicates: 'm3 7 4-4 4 4M7 3v11M21 17l-4 4-4-4M17 21V10',
    timeline: 'M4 19V5M4 19h16M8 16v-3M12 16V8M16 16v-6M20 16v-9',
    export: 'M12 3v12M7 10l5 5 5-5M4 20h16',
    create: 'M12 5v14M5 12h14',
    manage: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0-8ZM4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M2 12h2M20 12h2M12 2v2M12 20v2',
    partner: 'M8 12h8M12 8v8M5 5h5v5H5zM14 14h5v5h-5z',
    enroll: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6',
    active: 'M20 6 9 17l-5-5',
  };
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
};

const WorkspaceRail = ({ activeTab, setActiveTab, profile, showAdminSection, onOpenAdmin, activeNotesCount }) => (
  <aside className="dashboard-rail quick-actions-glass dashboard-surface h-fit rounded-2xl p-3">
    <div className="mb-5 px-2"><span className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Quick Actions</span></div>
    <div className="dashboard-rail-group manage-group space-y-1">
      <button type="button" onClick={() => setActiveTab('home')} className={`dashboard-rail-link ${activeTab === 'home' ? 'is-active' : ''}`} aria-label="Home"><span className="dashboard-rail-icon"><QuickActionIcon name="home" /></span><span className="dashboard-rail-label">Home</span></button>
      {profile?.permissions?.clients?.view !== false && <button type="button" onClick={() => setActiveTab('dashboard')} className={`dashboard-rail-link ${activeTab === 'dashboard' ? 'is-active' : ''}`} aria-label="Clients"><span className="dashboard-rail-icon"><QuickActionIcon name="clients" /></span><span className="dashboard-rail-label">Clients</span></button>}
      {profile?.permissions?.birthdays?.view !== false && <button type="button" onClick={() => setActiveTab('birthdays')} className={`dashboard-rail-link ${activeTab === 'birthdays' ? 'is-active' : ''}`} aria-label="Birthdays"><span className="dashboard-rail-icon"><QuickActionIcon name="birthdays" /></span><span className="dashboard-rail-label">Birthdays</span></button>}
      {profile?.permissions?.gym?.view !== false && <button type="button" onClick={() => setActiveTab('gym')} className={`dashboard-rail-link ${activeTab === 'gym' ? 'is-active' : ''}`} aria-label="Gym"><span className="dashboard-rail-icon"><QuickActionIcon name="gym" /></span><span className="dashboard-rail-label">GYM</span></button>}
      {profile?.permissions?.spa?.view !== false && <button type="button" onClick={() => setActiveTab('spa')} className={`dashboard-rail-link ${activeTab === 'spa' ? 'is-active' : ''}`} aria-label="Spa"><span className="dashboard-rail-icon"><QuickActionIcon name="spa" /></span><span className="dashboard-rail-label">SPA</span></button>}
      <button type="button" onClick={() => setActiveTab('notes')} className={`dashboard-rail-link ${activeTab === 'notes' ? 'is-active' : ''}`} aria-label="Notes"><span className="dashboard-rail-icon"><QuickActionIcon name="notes" /></span><span className="dashboard-rail-label">Notes</span>{activeNotesCount > 0 && <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">{activeNotesCount}</span>}</button>
    </div>
    <div className="dashboard-rail-group operations-group space-y-1">
      <button type="button" onClick={() => setActiveTab('invoice')} className={`dashboard-rail-link ${activeTab === 'invoice' ? 'is-active' : ''}`} aria-label="Invoices"><span className="dashboard-rail-icon"><QuickActionIcon name="invoices" /></span><span className="dashboard-rail-label">Invoices</span></button>
      {(profile?.role === 'Admin' || profile?.role === 'Manager') && <button type="button" onClick={() => setActiveTab('invoice-tracking')} className={`dashboard-rail-link ${activeTab === 'invoice-tracking' ? 'is-active' : ''}`} aria-label="Invoice tracking"><span className="dashboard-rail-icon"><QuickActionIcon name="tracking" /></span><span className="dashboard-rail-label">Tracking</span></button>}
      {profile?.role === 'Admin' && <button type="button" onClick={onOpenAdmin} className={`dashboard-rail-link ${showAdminSection ? 'is-active' : ''}`} aria-label="Admin"><span className="dashboard-rail-icon"><QuickActionIcon name="admin" /></span><span className="dashboard-rail-label">Admin</span></button>}
    </div>
  </aside>
);



const AnimatedCount = ({ value }) => {
  const targetValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 900;
    const startTime = performance.now();
    let frameId;
    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(targetValue * easedProgress));
      if (progress < 1) frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [targetValue]);

  return <span aria-live="polite">{displayValue.toLocaleString()}</span>;
};

const SummaryPanel = ({ clients, branches, loading }) => {
  const now = new Date();
  const [birthdayMonth, setBirthdayMonth] = useState(now.getMonth() + 1);
  const [recentDays, setRecentDays] = useState(30);
  const [summaryBranch, setSummaryBranch] = useState('');

  const branchClients = useMemo(() => summaryBranch ? clients.filter((client) => client.branch === summaryBranch) : clients, [clients, summaryBranch]);
  const birthdayClients = useMemo(() => branchClients.filter((client) => Number(client.birthMonth) === birthdayMonth), [birthdayMonth, branchClients]);
  const recentClients = useMemo(() => {
    const cutoff = Date.now() - recentDays * 24 * 60 * 60 * 1000;
    return branchClients.filter((client) => {
      const createdAt = client.createdAt?.toDate?.() || client.createdAt;
      return createdAt instanceof Date && createdAt.getTime() >= cutoff;
    });
  }, [branchClients, recentDays]);

  return (
    <section className="dashboard-summary dashboard-surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Summary</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={summaryBranch} onChange={(event) => setSummaryBranch(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Summary branch">
            <option value="">All branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}
          </select>
          <select value={birthdayMonth} onChange={(event) => setBirthdayMonth(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Birthday month">
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })}</option>)}
          </select>
          <select value={recentDays} onChange={(event) => setRecentDays(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" aria-label="Recent client period">
            {[30, 60, 90].map((days) => <option key={days} value={days}>Last {days} days</option>)}
          </select>
        </div>
      </div>
      {loading ? <p className="mt-5 text-sm text-slate-500">Loading summary...</p> : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4 dark:border-pink-900/40 dark:bg-pink-950/20">
            <h3 className="font-bold text-slate-900 dark:text-white">Birthday babies</h3>
            <p className="mt-5 text-5xl font-black tracking-tight text-pink-600 dark:text-pink-300"><AnimatedCount value={birthdayClients.length} /></p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">Birthday babies in {new Date(2000, birthdayMonth - 1, 1).toLocaleDateString(undefined, { month: 'long' })}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <h3 className="font-bold text-slate-900 dark:text-white">New client additions</h3>
            <p className="mt-5 text-5xl font-black tracking-tight text-blue-600 dark:text-blue-300"><AnimatedCount value={recentClients.length} /></p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">New client additions in the last {recentDays} days</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default function Home() {
  const { user, profile } = useAuth();
  const {
    allClients: cachedAllClients,
    globalClients: cachedGlobalClients,
    branches: cachedBranches,
    todaysBirthdays: cachedTodaysBirthdays,
    allBirthdays: cachedAllBirthdays,
    gymEnrollments: cachedGymEnrollments,
    spaEnrollments: cachedSpaEnrollments,
    clientCountsByBranch: cachedClientCounts,
    birthdayCountsByBranch: cachedBirthdayCounts,
    loading: isDataLoading,
    fullDataLoading: isFullDataLoading,
    activeGymEnrollmentCount,
    activeSpaEnrollmentCount,
    refreshData
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [globalClients, setGlobalClients] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [gymSubTab, setGymSubTab] = useState('overview');
  const [spaSubTab, setSpaSubTab] = useState('overview');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 20;
  const [showAdminSection, setShowAdminSection] = useState(false);
  const [returnToAdmin, setReturnToAdmin] = useState(false);
  const [showBranchPrompt, setShowBranchPrompt] = useState(false);
  const [allBirthdays, setAllBirthdays] = useState([]);
  const [currentAffirmation, setCurrentAffirmation] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeNotesCount, setActiveNotesCount] = useState(0);
  const [birthdayReminderIndex, setBirthdayReminderIndex] = useState(null);
  const isRootAdmin = user?.email?.toLowerCase() === 'alphacortexai@gmail.com';

  const handleExportAllClients = () => {
    if (!isRootAdmin) return;
    const exportableClients = globalClients.length ? globalClients : cachedGlobalClients;
    if (!exportableClients.length) return;
    const formatDateOfBirth = (client) => {
      const month = Number(client.birthMonth);
      const day = Number(client.birthDay);
      if (!month || !day) return 'Not provided';
      return new Date(2000, month - 1, day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    };
    const rows = exportableClients.map((client) => ({
      'Name of Client': client.name || 'Not provided',
      'Date of Birth': formatDateOfBirth(client),
      Branch: client.branch || 'Not provided',
      'Phone Number': client.phoneNumber || 'Not provided',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 24 }, { wch: 20 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Clients');
    XLSX.writeFile(workbook, `clients-database-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useEffect(() => {
    if (!user) return;
    getActiveNotesCount(user, profile).then(setActiveNotesCount);
  }, [profile, user]);

  // Sync with cached data from DataContext (single source of truth). Branch filter applied client-side.
  useEffect(() => {
    if (!isDataLoading && cachedBranches.length > 0) {
      setBranches(cachedBranches);
      setAllBirthdays(cachedAllBirthdays);
      setGlobalClients(cachedGlobalClients);
      setAllClients(selectedBranch ? cachedAllClients.filter(c => c.branch === selectedBranch) : cachedAllClients);
      setTodaysBirthdays(selectedBranch ? cachedTodaysBirthdays.filter(c => c.branch === selectedBranch) : cachedTodaysBirthdays);
      setIsInitialLoading(false);
      setDataLoaded(true);
    }
  }, [isDataLoading, cachedBranches, cachedAllBirthdays, cachedGlobalClients, cachedAllClients, cachedTodaysBirthdays, selectedBranch]);

  const birthdayReminderMessages = useMemo(() => {
    const assignedBranches = Array.isArray(profile?.assignedBranches) ? profile.assignedBranches.filter(Boolean) : [];
    const branchNames = assignedBranches.length > 0
      ? assignedBranches
      : isRootAdmin
        ? branches.map((branch) => branch.name).filter(Boolean)
        : [];
    const birthdaySource = allBirthdays.length ? allBirthdays : cachedAllBirthdays;
    return branchNames.map((branchName) => ({
      branchName,
      count: birthdaySource.filter((client) => client.branch === branchName).length,
    })).filter((message) => message.count > 0);
  }, [allBirthdays, branches, cachedAllBirthdays, isRootAdmin, profile?.assignedBranches]);

  useEffect(() => {
    setBirthdayReminderIndex(null);
    if (activeTab !== 'home' || birthdayReminderMessages.length === 0) return undefined;
    const reminderTimers = birthdayReminderMessages.map((_, index) => setTimeout(() => {
      setBirthdayReminderIndex(index);
    }, 20000 + (index * 15000)));
    const finishTimer = setTimeout(() => setBirthdayReminderIndex(null), 20000 + (birthdayReminderMessages.length * 15000));
    return () => {
      reminderTimers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, [activeTab, birthdayReminderMessages]);

  // Handle back button
  useEffect(() => {
    // Only push state if it's different from current to avoid history bloat
    const currentState = window.history.state;
    if (!currentState || currentState.tab !== activeTab || currentState.gymSub !== gymSubTab || currentState.spaSub !== spaSubTab) {
      window.history.pushState({ tab: activeTab, gymSub: gymSubTab, spaSub: spaSubTab }, '');
    }

    const handlePopState = (event) => {
      const state = event.state;

      if (activeTab === 'home') {
        setShowExitConfirm(true);
        window.history.pushState({ tab: 'home', gymSub: 'overview', spaSub: 'overview' }, '');
        return;
      }

      if (state && state.tab) {
        setActiveTab(state.tab);
        setGymSubTab(state.gymSub ?? 'overview');
        setSpaSubTab(state.spaSub ?? 'overview');
        if (state.tab === 'home') setShowAdminSection(false);
        return;
      }

      // Fallback when state is null or missing (e.g. initial load or external back)
      if (activeTab === 'gym' && gymSubTab !== 'overview') {
        setGymSubTab('overview');
      } else if (activeTab === 'spa' && spaSubTab !== 'overview') {
        setSpaSubTab('overview');
      } else if (showAdminSection) {
        setShowAdminSection(false);
      } else {
        setActiveTab('home');
        setGymSubTab('overview');
        setSpaSubTab('overview');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, gymSubTab, spaSubTab, showAdminSection]);

  const handleExitApp = () => {
    // In a web app, we can't truly "close" the window unless it was opened by script
    // But we can try or redirect to a blank page/close
    if (typeof window !== 'undefined') {
      window.close();
      // Fallback if window.close() is blocked
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
    }
  };

  useEffect(() => {
    const getAffirmation = () => {
      const now = new Date();
      // Use 5-minute intervals for rotation
      const intervalIndex = Math.floor(now.getTime() / (5 * 60 * 1000));
      const index = intervalIndex % affirmations.length;
      return affirmations[index];
    };

    setCurrentAffirmation(getAffirmation());

    const interval = setInterval(() => {
      setCurrentAffirmation(getAffirmation());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const adminSubsectionTabs = ['upload', 'unrecognized', 'history', 'users', 'branches', 'duplicates', 'timeline', 'invoice-list'];

  const openAdminTool = (tab) => {
    setReturnToAdmin(true);
    setShowAdminSection(true);
    setActiveTab(tab);
  };

  const openAdminOverview = () => {
    setActiveTab('home');
    setShowAdminSection(true);
    setReturnToAdmin(false);
  };

  const goBackFromSection = () => {
    const shouldReturnToAdmin = returnToAdmin || adminSubsectionTabs.includes(activeTab);
    if (shouldReturnToAdmin) {
      openAdminOverview();
      return;
    }
    setActiveTab('home');
    setShowAdminSection(false);
    setReturnToAdmin(false);
  };

  useEffect(() => {
    if (activeTab !== 'home' && !returnToAdmin) setShowAdminSection(false);

    if (activeTab === 'birthdays') {
      const defaultBranch = localStorage.getItem('defaultBirthdayBranch');
      if (defaultBranch && !selectedBranch) {
        setSelectedBranch(defaultBranch);
      } else if (!defaultBranch && !selectedBranch) {
        setShowBranchPrompt(true);
      }
    }

    // Only reset page if we're actually switching to a list view
    if (['dashboard', 'birthdays', 'unrecognized'].includes(activeTab)) {
      setCurrentPage(1);
    }
  }, [activeTab, selectedBranch]);

  const handleSetDefaultBranch = (branchName) => {
    localStorage.setItem('defaultBirthdayBranch', branchName);
    setSelectedBranch(branchName);
    setShowBranchPrompt(false);
  };

  // Handle search with debouncing
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const branch = selectedBranch || null;
        const results = await searchClients(searchTerm, branch);
        setSearchResults(results || []);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
        setCurrentPage(1);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedBranch]);

  const filteredBirthdays = useMemo(() => {
    // If a specific month or day is selected, search through all clients; otherwise use todaysBirthdays (already filtered by branch in sync).
    const useAllClients = selectedMonth || selectedDay;
    const baseClients = useAllClients ? allClients : todaysBirthdays;
    return baseClients.filter((client) => {
      const monthMatch = !selectedMonth || (client.birthMonth && parseInt(client.birthMonth) === parseInt(selectedMonth));
      const dayMatch = !selectedDay || (client.birthDay && parseInt(client.birthDay) === parseInt(selectedDay));
      const branchMatch = !selectedBranch || (client.branch === selectedBranch);
      return monthMatch && dayMatch && branchMatch;
    });
  }, [todaysBirthdays, allClients, selectedMonth, selectedDay, selectedBranch]);

  const isFullDatasetLoading = isFullDataLoading && cachedAllClients.length === 0;

  const activeGymMembers = useMemo(() => {
    if (typeof activeGymEnrollmentCount === 'number') return activeGymEnrollmentCount;
    return cachedGymEnrollments.filter(e => e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= new Date()).length;
  }, [activeGymEnrollmentCount, cachedGymEnrollments]);

  const activeSpaMembers = useMemo(() => {
    if (typeof activeSpaEnrollmentCount === 'number') return activeSpaEnrollmentCount;
    return cachedSpaEnrollments.filter(e => e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= new Date()).length;
  }, [activeSpaEnrollmentCount, cachedSpaEnrollments]);

  const getBranchInitials = (name) => {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  // Optimized badge calculations using pre-computed counts
  // For centerBadge (large display), show total count
  // For regular badge (small corner), show branch breakdown
  const clientBadgeTotal = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedClientCounts && Object.keys(cachedClientCounts).length > 0) {
      return Object.values(cachedClientCounts).reduce((sum, count) => sum + count, 0).toString();
    }

    // Fallback to counting from array
    return globalClients.length.toString();
  }, [cachedClientCounts, globalClients]);

  const clientBadge = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedClientCounts && Object.keys(cachedClientCounts).length > 0 && branches.length > 0) {
      return branches
        .map(b => {
          const count = cachedClientCounts[b.name] || 0;
          return count > 0 ? `${getBranchInitials(b.name)}: ${count}` : null;
        })
        .filter(Boolean)
        .join(', ') || '0';
    }

    // Fallback to counting from array (slower, but works if counts not loaded)
    if (!branches.length || !globalClients.length) {
      return globalClients.length.toString();
    }

    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    globalClients.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => count > 0 ? `${getBranchInitials(name)}: ${count}` : null)
      .filter(Boolean)
      .join(', ') || '0';
  }, [cachedClientCounts, globalClients, branches]);

  const birthdayBadgeTotal = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedBirthdayCounts && Object.keys(cachedBirthdayCounts).length > 0) {
      return Object.values(cachedBirthdayCounts).reduce((sum, count) => sum + count, 0).toString();
    }

    // Fallback to counting from array
    return allBirthdays.length.toString();
  }, [cachedBirthdayCounts, allBirthdays]);

  const birthdayBadge = useMemo(() => {
    // Use cached counts if available (fast)
    if (cachedBirthdayCounts && Object.keys(cachedBirthdayCounts).length > 0 && branches.length > 0) {
      return branches
        .map(b => {
          const count = cachedBirthdayCounts[b.name] || 0;
          return count > 0 ? `${getBranchInitials(b.name)}: ${count}` : null;
        })
        .filter(Boolean)
        .join(', ') || '0';
    }

    // Fallback to counting from array (slower)
    if (!branches.length || !allBirthdays.length) {
      return allBirthdays.length.toString();
    }

    const counts = {};
    branches.forEach(b => { counts[b.name] = 0; });
    allBirthdays.forEach(c => {
      if (c.branch && counts[c.branch] !== undefined) counts[c.branch]++;
    });
    return Object.entries(counts)
      .map(([name, count]) => count > 0 ? `${getBranchInitials(name)}: ${count}` : null)
      .filter(Boolean)
      .join(', ') || '0';
  }, [cachedBirthdayCounts, allBirthdays, branches]);

  const getPaginatedClients = (list) => {
    const startIndex = (currentPage - 1) * clientsPerPage;
    return list.slice(startIndex, startIndex + clientsPerPage);
  };

  const getTotalPages = (list) => Math.ceil(list.length / clientsPerPage);

  return (
    <ProtectedRoute>
      <div className="dashboard-shell min-h-screen text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-100 selection:text-blue-900">
        {/* Exit Confirmation Modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 text-2xl">
                  🚪
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Exit App?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Are you sure you want to exit the application?</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExitApp}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-lg shadow-rose-500/20 transition-all"
                >
                  Yes, Exit
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Navigation */}
        <header className="dashboard-nav bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50">
          <div className="relative mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:px-10">
            <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto sm:flex-nowrap sm:gap-8">
              <button onClick={() => setActiveTab('home')} aria-label="Go to home" className="flex items-center gap-3 group">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-20">
                    <Image src="/logo1.png" alt="Logo 1" fill className="object-contain p-1" />
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 bg-white overflow-hidden shadow-md group-hover:scale-105 transition-transform relative z-10">
                    <Image src="/logo2.png" alt="Logo 2" fill className="object-contain p-1" />
                  </div>
                </div>
                <span className="text-lg font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-950 via-blue-700 to-slate-500 dark:from-white dark:via-blue-300 dark:to-slate-400">Spa EMS</span>
              </button>

                <nav aria-label="Primary navigation" className="mobile-primary-nav order-3 flex basis-full items-center gap-1 overflow-x-auto pb-0.5 sm:order-none sm:w-auto sm:basis-auto sm:max-w-[58vw]">
                {['home', 'dashboard', 'birthdays', 'gym', 'spa', 'profile'].map((tab) => {
                  // Check permissions for each tab
                  if (tab === 'dashboard' && profile?.permissions?.clients?.view === false) return null;
                  if (tab === 'birthdays' && profile?.permissions?.birthdays?.view === false) return null;
                  if (tab === 'gym' && profile?.permissions?.gym?.view === false) return null;
                  if (tab === 'spa' && profile?.permissions?.spa?.view === false) return null;

                  const navLabel = tab === 'gym' ? 'GYM' : tab === 'spa' ? 'SPA' : tab.charAt(0).toUpperCase() + tab.slice(1);
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`mobile-primary-nav-link px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <span className="mobile-primary-nav-label">{navLabel}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm relative">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    {profile?.role === 'Admin' && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white dark:border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-md uppercase tracking-wider">
                            {profile?.role || 'General'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => { setActiveTab('profile'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                          My Profile
                        </button>
                        <button
                          onClick={async () => { await signOut(); window.location.href = '/auth/signin'; }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 font-medium hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
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
        </header>

        <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {isInitialLoading ? (
            <div className="mx-auto max-w-2xl py-16">
              <LoadingState title="Preparing your dashboard..." description="Loading your workspaces and latest information." />
            </div>
          ) : (
          <div className={`dashboard-page-layout grid gap-5 lg:grid-cols-[188px_minmax(0,1fr)] ${activeTab === 'home' && !showAdminSection && !(profile?.preferences?.nviewEnabled && profile?.role === 'Admin') ? 'dashboard-home-shell' : ''}`}>
            <div className="dashboard-desktop-rail"><WorkspaceRail activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} /></div>
            <div className="dashboard-page-content min-w-0">
          {(activeTab !== 'home' || showAdminSection) && <div className="mobile-quick-actions mobile-quick-actions-global">
            <WorkspaceRail activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} />
          </div>}
          {activeTab === 'home' && profile?.preferences?.nviewEnabled && profile?.role === 'Admin' ? (
            <NviewDashboard />
          ) : activeTab === 'home' && (
            <div className="dashboard-reveal min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {!showAdminSection && <section className="dashboard-hero relative overflow-hidden p-5 sm:p-6 lg:p-7">
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {birthdayReminderIndex === null ? (
                      <TypedGreeting firstName={user?.displayName?.split(' ')[0] || 'there'} />
                    ) : (
                      <div key={`${birthdayReminderMessages[birthdayReminderIndex].branchName}-${birthdayReminderMessages[birthdayReminderIndex].count}`} className="animate-in fade-in duration-500" aria-live="polite">
                        <TypedBirthdayReminder count={birthdayReminderMessages[birthdayReminderIndex].count} branchName={birthdayReminderMessages[birthdayReminderIndex].branchName} />
                      </div>
                    )}
                  </div>
                  <div className="dashboard-date-card shrink-0 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-right shadow-sm dark:border-slate-700 dark:bg-slate-900/70"><div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Today</div><div className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white sm:text-base">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div></div>
                </div>
              </section>}

              {!showAdminSection && <div className="mobile-quick-actions">
                <WorkspaceRail activeTab={activeTab} setActiveTab={setActiveTab} profile={profile} showAdminSection={showAdminSection} onOpenAdmin={openAdminOverview} activeNotesCount={activeNotesCount} />
              </div>}

                  {!showAdminSection ? (
                <>
                <section>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                  {profile?.permissions?.clients?.view !== false && (
                    <NavCard onClick={() => setActiveTab('dashboard')} icon="/clients_bg.png" title="Clients Database" description="Manage" badge={cachedClientCounts ? clientBadgeTotal : (dataLoaded ? '...' : undefined)} isImage={true} fullBg={true} />
                  )}
                  {profile?.permissions?.birthdays?.view !== false && (
                    <NavCard onClick={() => setActiveTab('birthdays')} icon="/birthday.png" title="Today's Birthdays" description="Celebrations" badge={cachedBirthdayCounts ? birthdayBadgeTotal : (dataLoaded ? '...' : undefined)} isImage={true} fullBg={true} />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard
                      onClick={() => setActiveTab('gym')}
                      icon="/gym_bg.jpg"
                      title="GYM"
                      description="Memberships."
                      isImage={true}
                      fullBg={true}
                      badge={dataLoaded ? activeGymMembers : undefined}
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard
                      onClick={() => setActiveTab('spa')}
                      icon="/spa_bg.jpg"
                      title="SPA"
                      description="Memberships."
                      isImage={true}
                      fullBg={true}
                      badge={dataLoaded ? activeSpaMembers : undefined}
                    />
                  )}
                  <NavCard onClick={() => setActiveTab('notes')} icon="📝" title="Notes" description="Reference reminders." badge={activeNotesCount} accent="violet" />
                  </div>
                </section>
                <div className="hidden md:block">
                  <SummaryPanel clients={globalClients.length ? globalClients : cachedGlobalClients} branches={branches} loading={isFullDataLoading} />
                </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/70 to-slate-100 p-5 shadow-lg shadow-blue-900/5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                    <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-blue-400/20 blur-3xl" />
                    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">Control Center</div>
                        <div className="mt-1 flex items-center gap-3"><SectionBackArrow onClick={() => setShowAdminSection(false)} label="Back to Home" /><h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Admin Tools</h2></div>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Operate imports, audits, locations, users, and billing from one polished workspace.</p>
                      </div>
                      <button onClick={() => setShowAdminSection(false)} className="inline-flex items-center justify-center rounded-2xl border border-blue-200/70 bg-white/80 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm backdrop-blur hover:bg-blue-50 hover:shadow-md dark:border-blue-900/50 dark:bg-slate-900/80 dark:text-blue-300 dark:hover:bg-blue-950/40">Back to main</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {profile?.permissions?.clients?.add !== false && (
                      <NavCard onClick={() => openAdminTool('upload')} icon={<QuickActionIcon name="upload" />} title="Upload" description="Bulk data import." accent="blue" eyebrow="Import" />
                    )}
                    {profile?.permissions?.clients?.edit !== false && (
                      <NavCard onClick={() => openAdminTool('unrecognized')} icon={<QuickActionIcon name="issues" />} title="Issues" description="Fix failed imports." accent="amber" eyebrow="Review" />
                    )}
                    {profile?.permissions?.clients?.view !== false && (
                      <NavCard onClick={() => openAdminTool('history')} icon={<QuickActionIcon name="history" />} title="History" description="View upload logs." accent="slate" eyebrow="Audit" />
                    )}
                    {profile?.permissions?.users?.view !== false && (
                      <NavCard onClick={() => openAdminTool('users')} icon={<QuickActionIcon name="users" />} title="Users" description="Manage roles." accent="violet" eyebrow="Access" />
                    )}
                    {profile?.permissions?.branches?.view !== false && (
                      <NavCard onClick={() => openAdminTool('branches')} icon={<QuickActionIcon name="branches" />} title="Branches" description="Manage locations." badge={dataLoaded ? branches.length : undefined} accent="emerald" eyebrow="Network" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('duplicates')} icon={<QuickActionIcon name="duplicates" />} title="Duplicates" description="Find duplicate phones." accent="rose" eyebrow="Cleanse" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('timeline')} icon={<QuickActionIcon name="timeline" />} title="Timeline" description="Activity logs." accent="blue" eyebrow="Monitor" />
                    )}
                    {profile?.role === 'Admin' && (
                      <NavCard onClick={() => openAdminTool('invoice-list')} icon={<QuickActionIcon name="invoices" />} title="All Invoices" description="View, search and recreate PDFs." accent="emerald" eyebrow="Finance" />
                    )}
                    {isRootAdmin && (
                      <NavCard onClick={handleExportAllClients} icon={<QuickActionIcon name="export" />} title="Export Clients" description="Download the complete database." accent="blue" eyebrow="Root admin only" badge={globalClients.length ? globalClients.length : undefined} />
                    )}
                  </div>
                </div>
              )}
                {!showAdminSection && <div className="dashboard-quote mt-1 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Power quote</div><p className="mt-1 text-sm font-semibold italic leading-6 text-slate-600 dark:text-slate-200">“{currentAffirmation}”</p></div>}
              </div>
          )}

          {activeTab === 'notes' && (
            <NotesSection onActiveCountChange={setActiveNotesCount} onBack={goBackFromSection} />
          )}

          {activeTab === 'invoice-list' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">All Invoices</h2>
                  <p className="text-slate-500 mt-1">View invoice records, search by number, client or phone, and recreate PDFs. Admin only.</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceList />
            </div>
          )}

          {activeTab === 'invoice-tracking' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Admin" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Invoice Tracking</h2></div>
                  <p className="text-slate-500 mt-1">Import invoices, track status (Issued, Sent to client, Completed) and upload proof of payment. Managers and Admins.</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceTracking />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Client workspace</p><div className="mt-1 flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Home" /><h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Client Database</h2></div><p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">Search, filter, and manage every client record from one place.</p></div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  >
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  {profile?.permissions?.clients?.add !== false && (
                    <button onClick={() => setActiveTab('add-client')} className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      Add Client
                    </button>
                  )}
                </div>
              </div>

              <div className="dashboard-surface rounded-[24px] p-3 sm:p-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  {isSearching ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search by name or phone number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg"
                />
              </div>
              </div>

              <ClientList
                clients={getPaginatedClients(searchTerm ? searchResults : allClients)}
                totalCount={searchTerm ? searchResults.length : allClients.length}
                title={searchTerm ? `Search Results for "${searchTerm}"` : "All Clients"}
                onClientUpdated={refreshData}
                isLoading={isInitialLoading || isFullDatasetLoading}
              />

              {(searchTerm ? searchResults.length : allClients.length) > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Page {currentPage} of {getTotalPages(searchTerm ? searchResults : allClients)}
                  </span>
                  <button
                    disabled={currentPage === getTotalPages(searchTerm ? searchResults : allClients)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'birthdays' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {showBranchPrompt && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Set Default Branch</h3>
                      <p className="text-sm text-slate-500 mt-1">Select a branch to show birthdays for by default.</p>
                    </div>
                    <div className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                      <button
                        onClick={() => handleSetDefaultBranch('')}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 font-medium"
                      >
                        All Branches
                      </button>
                      {branches.map(branch => (
                        <button
                          key={branch.id}
                          onClick={() => handleSetDefaultBranch(branch.name)}
                          className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 font-medium"
                        >
                          {branch.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                      <button
                        onClick={() => setShowBranchPrompt(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Home" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Birthdays</h2></div>
                  <p className="text-slate-500 mt-1">Celebrate with your customers.</p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Branches</option>
                      {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Months</option>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="w-full md:w-auto px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">All Days</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <ClientList
                clients={getPaginatedClients(filteredBirthdays)}
                totalCount={filteredBirthdays.length}
                title={selectedMonth || selectedDay ? "Filtered Birthdays" : "Today's Birthdays"}
                onClientUpdated={refreshData}
                isLoading={isInitialLoading || ((selectedMonth || selectedDay) && isFullDatasetLoading)}
              />

              {filteredBirthdays.length > clientsPerPage && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Page {currentPage} of {getTotalPages(filteredBirthdays)}</span>
                  <button
                    disabled={currentPage === getTotalPages(filteredBirthdays)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
                  <p className="text-slate-500 mt-1">Import clients from Excel files.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <ExcelUpload onUploadComplete={refreshData} />
            </div>
          )}

          {activeTab === 'unrecognized' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Data Issues</h2>
                  <p className="text-slate-500 mt-1">Fix clients with unrecognized phone numbers.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UnrecognizedClientsList onApproved={refreshData} />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Upload History</h2>
                  <p className="text-slate-500 mt-1">Track and manage your data imports.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UploadHistory />
            </div>
          )}

          {activeTab === 'add-client' && (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Add New Client</h2>
                <p className="text-slate-500 mt-1">Register a new customer to the system.</p>
              </div>
              <ClientForm onClientAdded={() => { refreshData(); setActiveTab('dashboard'); }} />
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Branch Management</h2>
                  <p className="text-slate-500 mt-1">Manage your business locations.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <BranchForm onBranchAdded={refreshData} />
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h2>
                  <p className="mt-1 text-slate-500">Manage access, roles, and branch assignments.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <UserManagement />
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Activity Timeline</h2>
                  <p className="text-slate-500 mt-1">Track all system actions and changes.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <ActionsTimeline />
            </div>
          )}

          {activeTab === 'duplicates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Duplicate Search</h2>
                  <p className="text-slate-500 mt-1">Find and resolve duplicate client records.</p>
                </div>
                <AdminBackButton onBack={goBackFromSection} />
              </div>
              <DuplicateSearch onMerged={refreshData} />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <UserProfile />
            </div>
          )}

          {activeTab === 'gym' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <SectionBackArrow onClick={() => gymSubTab === 'overview' ? setActiveTab('home') : setGymSubTab('overview')} label={gymSubTab === 'overview' ? 'Back to Home' : 'Back to Overview'} />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">GYM Memberships</h2>
                  </div>
                  <p className="text-slate-500">
                    {gymSubTab === 'overview' ? 'Manage membership types and client enrollments.' :
                     gymSubTab === 'create-type' ? 'Define new membership packages.' :
                     gymSubTab === 'partner-companies' ? 'Manage companies available on invoices.' :
                     gymSubTab === 'enroll' ? 'Register a client for a membership.' : 'View active gym members.'}
                  </p>
                </div>
              </div>

              {gymSubTab === 'overview' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('create-type')}
                      icon={<QuickActionIcon name="create" />}
                      title="Create Type"
                      description="Define new membership packages."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setGymSubTab('manage-types')}
                      icon={<QuickActionIcon name="manage" />}
                      title="Manage Types"
                      description="Edit or delete membership types."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setGymSubTab('partner-companies')}
                      icon={<QuickActionIcon name="partner" />}
                      title="Partner Companies"
                      description="Manage invoice company options."
                    />
                  )}
                  {profile?.permissions?.gym?.add !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('enroll')}
                      icon={<QuickActionIcon name="enroll" />}
                      title="Enroll Client"
                      description="Enroll a client in a Membership."
                    />
                  )}
                  {profile?.permissions?.gym?.view !== false && (
                    <NavCard
                      onClick={() => setGymSubTab('active-members')}
                      icon={<QuickActionIcon name="active" />}
                      title="Active Members"
                      description="View and manage active memberships."
                    />
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {gymSubTab === 'create-type' && (
                    <div className="max-w-2xl mx-auto">
                      <MembershipForm onMembershipAdded={() => setGymSubTab('overview')} />
                    </div>
                  )}
                  {gymSubTab === 'manage-types' && (
                    <div className="max-w-4xl mx-auto">
                      <MembershipTypeManager />
                    </div>
                  )}
                  {gymSubTab === 'partner-companies' && (
                    <div className="max-w-4xl mx-auto">
                      <PartnerCompanyManager />
                    </div>
                  )}
                  {gymSubTab === 'enroll' && (
                    <div className="max-w-2xl mx-auto">
                      <EnrollmentForm onEnrolled={() => setGymSubTab('active-members')} />
                    </div>
                  )}
                  {gymSubTab === 'active-members' && (
                    <MembershipList />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'spa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <SectionBackArrow onClick={() => spaSubTab === 'overview' ? setActiveTab('home') : setSpaSubTab('overview')} label={spaSubTab === 'overview' ? 'Back to Home' : 'Back to Overview'} />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">SPA Memberships</h2>
                  </div>
                  <p className="text-slate-500">
                    {spaSubTab === 'overview' ? 'Manage spa membership types and client enrollments.' :
                     spaSubTab === 'create-type' ? 'Define new spa membership packages.' :
                     spaSubTab === 'enroll' ? 'Register a client for a spa membership.' : 'View active spa members.'}
                  </p>
                </div>
              </div>

              {spaSubTab === 'overview' ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('create-type')}
                      icon={<QuickActionIcon name="spa" />}
                      title="Create Type"
                      description="Define new spa membership packages."
                    />
                  )}
                  {profile?.role === 'Admin' && (
                    <NavCard
                      onClick={() => setSpaSubTab('manage-types')}
                      icon={<QuickActionIcon name="manage" />}
                      title="Manage Types"
                      description="Edit or delete spa membership types."
                    />
                  )}
                  {profile?.permissions?.spa?.add !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('enroll')}
                      icon={<QuickActionIcon name="enroll" />}
                      title="Enroll Client"
                      description="Enroll a client in a spa membership."
                    />
                  )}
                  {profile?.permissions?.spa?.view !== false && (
                    <NavCard
                      onClick={() => setSpaSubTab('active-members')}
                      icon={<QuickActionIcon name="active" />}
                      title="Active Members"
                      description="View and manage active spa memberships."
                    />
                  )}
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {spaSubTab === 'create-type' && (
                    <div className="max-w-2xl mx-auto">
                      <SpaMembershipForm onMembershipAdded={() => setSpaSubTab('overview')} />
                    </div>
                  )}
                  {spaSubTab === 'manage-types' && (
                    <div className="max-w-4xl mx-auto">
                      <SpaMembershipTypeManager />
                    </div>
                  )}
                  {spaSubTab === 'enroll' && (
                    <div className="max-w-2xl mx-auto">
                      <SpaEnrollmentForm onEnrolled={() => setSpaSubTab('active-members')} />
                    </div>
                  )}
                  {spaSubTab === 'active-members' && (
                    <SpaMembershipList />
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3"><SectionBackArrow onClick={goBackFromSection} label="Back to Admin" /><h2 className="text-3xl font-bold text-slate-900 dark:text-white">Proforma Invoice Generator</h2></div>
                  <p className="text-slate-500 mt-1">Create invoices for GYM and SPA (PE &amp; SSS).</p>
                </div>
                <button
                  onClick={goBackFromSection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Admin
                </button>
              </div>
              <InvoiceGenerator />
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
