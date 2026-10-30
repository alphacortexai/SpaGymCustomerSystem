'use client';

function visibleLabel(label) {
  const text = String(label || 'Back').trim();
  if (/^back$/i.test(text)) return 'Back';
  const destination = text.replace(/^back to\s+/i, '');
  return destination.charAt(0).toUpperCase() + destination.slice(1);
}

export default function PageBackButton({ onClick, label = 'Back' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="page-back">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 19l-7-7 7-7" />
      </svg>
      <span>{visibleLabel(label)}</span>
    </button>
  );
}
