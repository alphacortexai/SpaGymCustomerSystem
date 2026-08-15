'use client';

export default function LoadingState({ title = 'Loading data...', description = 'Please wait while we fetch the records.' }) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="mx-auto flex w-fit items-center gap-1.5" aria-hidden="true">
        <span className="loading-orb loading-orb-blue" />
        <span className="loading-orb loading-orb-pink" />
        <span className="loading-orb loading-orb-purple" />
        <span className="loading-orb loading-orb-amber" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
