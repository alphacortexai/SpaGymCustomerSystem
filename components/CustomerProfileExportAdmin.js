'use client';

import { useCallback, useEffect, useState } from 'react';

const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';

const SAMPLE = {
  id: 'abc123',
  name: 'Amina Nakato',
  primaryPhoneNumber: '0782000000',
  additionalPhoneNumbers: ['0758000000'],
  dateOfBirth: { month: 3, day: 15, monthName: 'March', monthDay: '03-15', year: null },
  branch: 'Kololo',
};

function formatWhen(value) {
  if (!value) return '';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))} EAT`;
}

function Fact({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export default function CustomerProfileExportAdmin({ user, onBack }) {
  const isTopAdmin = user?.email?.toLowerCase() === TOP_ADMIN_EMAIL;
  const [summary, setSummary] = useState(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/customer-profile-export?summary=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to count customer profiles.');
      setSummary(payload);
      setReply(payload.reply || '');
    } catch (loadError) {
      setError(loadError.message || 'Unable to count customer profiles.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isTopAdmin && user) loadSummary();
  }, [isTopAdmin, loadSummary, user]);

  const downloadExport = async () => {
    setExporting(true);
    setError('');
    setNotice('');
    setCopied(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/customer-profile-export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to export customer profiles.');
      if (!Array.isArray(payload.customers)) throw new Error('The export did not include customer profiles.');
      const { reply: exportReply, customers, ...facts } = payload;
      const file = { ...facts, customers };
      const stamp = String(file.exportedAt || new Date().toISOString()).slice(0, 10);
      const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `spagym-customer-profiles-${stamp}.json`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSummary((current) => ({ ...(current || {}), ...facts, count: file.count }));
      setReply(exportReply || '');
      setNotice(`Downloaded ${Number(file.count || 0).toLocaleString('en-GB')} customer profiles. The file does not include the reply text.`);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to export customer profiles.');
    } finally {
      setExporting(false);
    }
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
    } catch (copyError) {
      console.error('Unable to copy the customer export reply:', copyError);
      setError('The reply could not be copied. Select the text and copy it manually.');
    }
  };

  if (!isTopAdmin) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">Customer profile export is available to the top administrator only.</div>;
  }

  const countLabel = summary ? Number(summary.count || 0).toLocaleString('en-GB') : '—';

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Top admin · one-time migration</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Customer profile export</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Download every stored customer profile as JSON. The file is for handing profiles to another system. It is not a full database backup, and it is separate from the spreadsheet export.</p>
          </div>
        </div>
        <button type="button" onClick={downloadExport} disabled={loading || exporting} className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
          {exporting ? 'Preparing JSON…' : 'Download JSON'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">{notice}</p>}
      {loading && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Counting customer profiles…</p>}

      {summary && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Database" value="Cloud Firestore" detail="The clients collection. Not Firebase Realtime Database." />
            <Fact label="Profiles" value={countLabel} detail={summary.exportedAt && notice ? `In the downloaded file · ${formatWhen(summary.exportedAt)}` : 'Every profile currently stored'} />
            <Fact label="Customer ids" value="Stable" detail="Assigned once. Never reused for another customer." />
            <Fact label="Change feed" value="Not yet" detail="No created or updated webhook, and no incremental endpoint." />
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-black text-slate-900 dark:text-white">Included for every stored profile</h3>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <li>Stable customer id</li>
                <li>Full name</li>
                <li>Primary phone number and every additional number</li>
                <li>Birthday month and day, when SpaGym has them. The year is null.</li>
                <li>Branch</li>
              </ul>
              <p className="mt-4 text-sm leading-6 text-slate-500">Profiles have no inactive flag. A customer stays in this export until the profile is deleted, including someone without a current membership. A deleted profile is gone and cannot be exported.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-black text-slate-900 dark:text-white">Left out</h3>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {(summary.excluded || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-4 text-sm leading-6 text-slate-500">SpaGym can already send a signed webhook when a customer checks in, and SPA SYS API can read one customer by id or phone. Created and updated webhooks can be added later. Until then, download this file again for a new snapshot.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">Reply you can send</h3>
                <p className="mt-1 text-sm text-slate-500">The count matches the stored profiles, and after a download it matches the file.</p>
              </div>
              <button type="button" onClick={copyReply} disabled={!reply} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{copied ? 'Copied' : 'Copy reply'}</button>
            </div>
            <textarea readOnly value={reply} rows={12} aria-label="Customer export reply" className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-black text-slate-900 dark:text-white">Shape of one customer</h3>
            <p className="mt-1 text-sm text-slate-500">This example is not a real profile. The downloaded file is a list under customers, with the count and database name above it.</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{JSON.stringify(SAMPLE, null, 2)}</pre>
          </section>
        </>
      )}
    </div>
  );
}
