'use client';

import { isValidElement, useEffect, useState } from 'react';

const iconTones = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const formatMetricValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  const numeric = Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(numeric) && String(value).trim() !== '...') return numeric.toLocaleString();
  return String(value);
};

export const NavCard = ({ onClick, icon, title, description, badge, accent = 'blue', eyebrow, metric, accentCard = false }) => {
  if (metric !== undefined) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`metric-card ${accentCard ? 'metric-card-accent' : ''}`}
        aria-label={`Open ${title}`}
      >
        <span className="metric-card-kicker">{title}</span>
        <span className="metric-card-value">{formatMetricValue(metric)}</span>
        {description && <span className="metric-card-note">{description}</span>}
      </button>
    );
  }

  const tone = iconTones[accent] || iconTones.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-grid-card tool-card group relative flex w-full cursor-pointer flex-col items-start p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      aria-label={`Open ${title}`}
    >
      <span className={`tool-card-icon ${tone}`}>
        {isValidElement(icon) ? icon : <span>{icon}</span>}
      </span>
      {badge !== undefined && <span className="tool-card-badge">{badge}</span>}
      {eyebrow && <span className="tool-card-eyebrow">{eyebrow}</span>}
      <h3 className="tool-card-title">{title}</h3>
      {description && <p className="tool-card-copy">{description}</p>}
    </button>
  );
};

const greetingPrefix = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, ';
  if (hour < 17) return 'Good afternoon, ';
  return 'Good evening, ';
};

export const TypedGreeting = ({ firstName }) => {
  const prefix = greetingPrefix();
  const fullGreeting = `${prefix}${firstName}`;
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
    <h1 className="dashboard-greeting-title" aria-label={fullGreeting}>
      {prefixText}
      {nameText && <span className="dashboard-greeting-name">{nameText}</span>}
      {!isComplete && <span className="dashboard-greeting-caret" aria-hidden="true" />}
    </h1>
  );
};

export const TypedBirthdayReminder = ({ contactedCount, remainingCount, branchName }) => {
  const message = `${contactedCount} of today's birthday babies called, ${remainingCount} remaining for ${branchName}`;
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

  const contactedStart = 0;
  const contactedEnd = String(contactedCount).length;
  const remainingLabel = ` of today's birthday babies called, `;
  const remainingStart = contactedEnd + remainingLabel.length;
  const remainingEnd = remainingStart + String(remainingCount).length;
  const branchLabel = ' remaining for ';
  const branchStart = remainingEnd + branchLabel.length;
  const renderSegment = (start, end, className = '') => {
    const visibleLength = Math.min(Math.max(typedLength - start, 0), end - start);
    if (visibleLength <= 0) return null;
    return <span className={className}>{message.slice(start, start + visibleLength)}</span>;
  };

  return (
    <h1 className="dashboard-greeting-title" aria-label={message}>
      {renderSegment(contactedStart, contactedEnd, 'dashboard-greeting-name')}
      {renderSegment(contactedEnd, remainingStart)}
      {renderSegment(remainingStart, remainingEnd, 'dashboard-greeting-name')}
      {renderSegment(remainingEnd, branchStart)}
      {renderSegment(branchStart, message.length, 'dashboard-greeting-name')}
      {!isComplete && <span className="dashboard-greeting-caret" aria-hidden="true" />}
    </h1>
  );
};

export const QuickActionIcon = ({ name }) => {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6',
    clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    birthdays: 'M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7H8.5a2.5 2.5 0 1 1 0-5C12 2 12 7 12 7ZM12 7h3.5a2.5 2.5 0 1 0 0-5C12 2 12 7 12 7Z',
    analytics: 'M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-7M20 16v-10',
    reports: 'M6 3h12a2 2 0 0 1 2 2v14H4V5a2 2 0 0 1 2-2ZM8 8h8M8 12h8M8 16h5',
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

const RailButton = ({ active, label, ariaLabel, icon, onClick, badge }) => (
  <button type="button" onClick={onClick} className={`dashboard-rail-link ${active ? 'is-active' : ''}`} aria-label={ariaLabel || label}>
    <span className="dashboard-rail-icon"><QuickActionIcon name={icon} /></span>
    <span className="dashboard-rail-label">{label}</span>
    {badge}
  </button>
);

export const WorkspaceRail = ({ activeTab, setActiveTab, profile, showAdminSection, onOpenAdmin, activeNotesCount }) => (
  <aside className="dashboard-rail quick-actions-glass dashboard-surface h-fit rounded-2xl p-3">
    <div className="dashboard-rail-heading mb-5 px-2"><span>Quick Actions</span></div>
    <div className="dashboard-rail-group manage-group space-y-1">
      <RailButton active={activeTab === 'home' && !showAdminSection} label="Home" icon="home" onClick={() => setActiveTab('home')} />
      {profile?.permissions?.clients?.view !== false && <RailButton active={activeTab === 'dashboard'} label="Clients" icon="clients" onClick={() => setActiveTab('dashboard')} />}
      {(profile?.role === 'Admin' || profile?.permissions?.clients?.view === true) && <RailButton active={activeTab === 'check-ins'} label="Check-ins" ariaLabel="Spa check-ins" icon="active" onClick={() => setActiveTab('check-ins')} />}
      {profile?.permissions?.birthdays?.view !== false && <RailButton active={activeTab === 'birthdays'} label="Birthdays" icon="birthdays" onClick={() => setActiveTab('birthdays')} />}
      {profile?.permissions?.birthdays?.view !== false && <RailButton active={activeTab === 'birthday-analytics'} label="Analytics" ariaLabel="Birthday communications analytics" icon="analytics" onClick={() => setActiveTab('birthday-analytics')} />}
      <RailButton active={activeTab === 'reports'} label="Reports" ariaLabel="Reports & Feedback" icon="reports" onClick={() => setActiveTab('reports')} />
      {profile?.permissions?.gym?.view !== false && <RailButton active={activeTab === 'gym'} label="GYM" ariaLabel="Gym" icon="gym" onClick={() => setActiveTab('gym')} />}
      {profile?.permissions?.spa?.view !== false && <RailButton active={activeTab === 'spa'} label="SPA" ariaLabel="Spa" icon="spa" onClick={() => setActiveTab('spa')} />}
      <RailButton
        active={activeTab === 'notes'}
        label="Notes"
        icon="notes"
        onClick={() => setActiveTab('notes')}
        badge={activeNotesCount > 0 ? <span className="dashboard-rail-badge">{activeNotesCount}</span> : null}
      />
    </div>
    <div className="dashboard-rail-group operations-group space-y-1">
      <RailButton active={activeTab === 'invoice'} label="Invoices" icon="invoices" onClick={() => setActiveTab('invoice')} />
      {(profile?.role === 'Admin' || profile?.role === 'Manager') && <RailButton active={activeTab === 'invoice-tracking'} label="Tracking" ariaLabel="Invoice tracking" icon="tracking" onClick={() => setActiveTab('invoice-tracking')} />}
      {profile?.role === 'Admin' && <RailButton active={showAdminSection} label="Admin" icon="admin" onClick={onOpenAdmin} />}
    </div>
  </aside>
);

export const TodayDesk = ({
  total = 0,
  waiting = 0,
  people = [],
  ready = false,
  notesCount = 0,
  showBirthdays = true,
  showCheckIns = false,
  onOpenBirthdays,
  onOpenNotes,
  onOpenCheckIns,
  onOpenInvoices,
}) => {
  const reached = waiting == null ? null : Math.max(total - waiting, 0);
  const focusTitle = !ready
    ? 'Checking today'
    : !showBirthdays
      ? (notesCount > 0 ? `${notesCount} open notes` : 'Notes are clear')
      : waiting > 0
        ? `${waiting} still to reach`
        : waiting == null && total > 0
          ? `${total} birthdays today`
          : total > 0
            ? 'Everyone is reached'
            : 'No birthdays today';
  const focusNote = !ready
    ? 'Birthday calls will appear here.'
    : !showBirthdays
      ? 'Open notes to see what is waiting.'
      : reached != null && total > 0
        ? `${reached} of ${total} already contacted`
        : total > 0
          ? 'Open the list to see who still needs a call.'
          : 'The birthday list is empty for today.';
  const focusKicker = !showBirthdays ? 'Notes' : waiting > 0 ? 'Needs a call' : 'Birthdays';
  const focusClass = waiting > 0 && showBirthdays ? 'is-open' : 'is-clear';
  const onFocus = !showBirthdays ? onOpenNotes : onOpenBirthdays;

  return (
    <aside className="home-today" aria-label="Today">
      <div className="home-today-head">
        <h2>Today</h2>
        {showBirthdays && (
          <button type="button" className="home-today-see" onClick={onOpenBirthdays}>See all</button>
        )}
      </div>
      <button type="button" className={`today-focus ${focusClass}`} onClick={onFocus}>
        <span className="today-focus-kicker">{focusKicker}</span>
        <span className="today-focus-title">{focusTitle}</span>
        <span className="today-focus-note">{focusNote}</span>
      </button>
      {showBirthdays && people.length > 0 && (
        <ul className="today-people">
          {people.map((person) => (
            <li key={person.id}>
              <button type="button" onClick={onOpenBirthdays}>
                <span className={`today-dot ${person.waiting ? 'is-waiting' : 'is-done'}`} aria-hidden="true" />
                <span className="today-person">
                  <span className="today-person-name">{person.name}</span>
                  <span className="today-person-meta">{person.waiting ? 'Still to call' : 'Reached'}{person.branch ? ` · ${person.branch}` : ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="today-links">
        <button type="button" onClick={onOpenNotes}>
          <span>Notes</span>
          <span>{notesCount > 0 ? `${notesCount} open` : 'Clear'}</span>
        </button>
        {showCheckIns && (
          <button type="button" onClick={onOpenCheckIns}>
            <span>Check-ins</span>
            <span>Open</span>
          </button>
        )}
        <button type="button" onClick={onOpenInvoices}>
          <span>Invoices</span>
          <span>Open</span>
        </button>
      </div>
    </aside>
  );
};
