'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAllBranches } from '@/lib/branches';

const ITEMS_PER_BATCH = 20;
const MAX_PARALLEL_BATCHES = 3;
const REPORT_DESCRIPTION = 'Review saved caller feedback across a selected date range. AI flags entries that may need a follow-up; every flagged item retains its caller and client details.';

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: dateKey(start), end: dateKey(end) };
};

const formatDate = (value) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : 'Date not recorded';

const severityStyle = {
  urgent: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200',
  attention: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200',
};

async function postReviewRequest(token, body) {
  const response = await fetch('/api/admin/ai-feedback-review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Unable to review feedback. Please try again.');
  return payload;
}

function deduplicateBatchSummaries(summaries) {
  const unique = [];
  const seen = new Set();
  for (const summary of summaries) {
    for (const rawLine of String(summary || '').split(/\r?\n/)) {
      const line = rawLine.replace(/^\s*[-*•]\s*/, '').trim();
      const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!line || !key || seen.has(key)) continue;
      seen.add(key);
      unique.push(line);
    }
  }
  return unique.slice(0, 5).map((line) => `- ${line}`).join('\n') || '- No recurring concern themes were identified.';
}

function formatSummaryBullets(summary) {
  const lines = String(summary || '').split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- No recurring concern themes were identified.';
}

export default function FeedbackAttentionAdmin({ user, profile, onBack, onOpenSettings }) {
  const initialRange = useMemo(getInitialRange, []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [guidance, setGuidance] = useState('');
  const [branches, setBranches] = useState([]);
  const [savedReviews, setSavedReviews] = useState([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [result, setResult] = useState(null);
  const [reviewSession, setReviewSession] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [phase, setPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getAllBranches(), user?.getIdToken?.().then((token) => fetch('/api/admin/ai-feedback-reviews', { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : { reviews: [] })).catch(() => ({ reviews: [] }))]).then(([branchList, reviewPayload]) => {
      if (!active) return;
      setBranches(Array.isArray(branchList) ? branchList : []);
      setSavedReviews(Array.isArray(reviewPayload?.reviews) ? reviewPayload.reviews : []);
    });
    return () => { active = false; };
  }, [user]);

  const executeBatches = async (token, session, existingResults = {}) => {
    const results = { ...existingResults };
    let nextBatch = 0;
    let failure = null;
    let failedBatch = null;
    const completedCount = () => Object.keys(results).length;

    setProgress({ completed: completedCount(), total: session.batches.length });

    const worker = async () => {
      while (!failure) {
        const batchIndex = nextBatch;
        nextBatch += 1;
        if (batchIndex >= session.batches.length) return;
        if (results[batchIndex]) continue;

        try {
          const batch = session.batches[batchIndex].map(({ item, feedback }) => ({ item, feedback }));
          const batchResult = await postReviewRequest(token, { phase: 'analyze', items: batch, guidance: session.guidance });
          results[batchIndex] = batchResult;
          const savedResults = { ...results };
          setProgress({ completed: completedCount(), total: session.batches.length });
          setReviewSession((current) => current ? { ...current, results: savedResults, failedBatch: null } : current);
        } catch (batchError) {
          if (!failure) {
            failure = batchError;
            failedBatch = batchIndex;
          }
        }
      }
    };

    const workerCount = Math.min(MAX_PARALLEL_BATCHES, session.batches.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (failure) {
      const savedResults = { ...results };
      setReviewSession({ ...session, results: savedResults, failedBatch });
      setError(`${failure.message} Completed ${completedCount()} of ${session.batches.length} batches. Retry to continue without repeating completed batches.`);
      return;
    }

    const indexedItems = new Map(session.feedbackItems.map((entry) => [entry.item, entry]));
    const orderedResults = session.batches.map((_, index) => results[index]);
    const findings = [];
    for (const batchResult of orderedResults) {
      for (const finding of batchResult?.findings || []) {
        const source = indexedItems.get(Number(finding.item));
        if (!source || !['urgent', 'attention'].includes(finding.severity)) continue;
        findings.push({
          ...source,
          severity: finding.severity,
          reason: finding.reason,
          suggestedAction: finding.suggestedAction,
        });
      }
    }
    findings.sort((a, b) => (
      a.severity === b.severity
        ? String(a.reportDate || '').localeCompare(String(b.reportDate || ''))
        : a.severity === 'urgent' ? -1 : 1
    ));

    const batchSummaries = orderedResults.map((entry) => entry?.summary).filter(Boolean).map((summary) => summary.slice(0, 400));
    let summary = deduplicateBatchSummaries(batchSummaries);
    let summaryFallback = false;
    if (batchSummaries.length) {
      setPhase('summarize');
      try {
        const aggregated = await postReviewRequest(token, { phase: 'summarize', summaries: batchSummaries, guidance: session.guidance });
        if (aggregated.summary) summary = formatSummaryBullets(aggregated.summary);
        else summaryFallback = true;
      } catch {
        summaryFallback = true;
      }
    }

    setResult({
      startDate: session.startDate,
      endDate: session.endDate,
      provider: session.provider,
      branch: session.branch,
      guidance: session.guidance,
      reportCount: session.reportCount,
      feedbackCount: session.feedbackCount,
      summary,
      summaryFallback,
      findings,
    });
    setProgress({ completed: session.batches.length, total: session.batches.length });
    setReviewSession(null);
  };

  const reviewFeedback = async () => {
    if (!startDate || !endDate || startDate > endDate) {
      setError('Choose a valid date range. The start date must be on or before the end date.');
      return;
    }
    setLoading(true);
    setPhase('prepare');
    setError('');
    setResult(null);
    setReviewSession(null);
    setProgress({ completed: 0, total: 0 });
    try {
      const token = await user.getIdToken();
      const prepared = await postReviewRequest(token, { phase: 'prepare', startDate, endDate, branch: selectedBranch, guidance });
      const feedbackItems = Array.isArray(prepared.feedbackItems) ? prepared.feedbackItems : [];
      if (!feedbackItems.length) {
        setResult({
          startDate: prepared.startDate,
          endDate: prepared.endDate,
          provider: prepared.provider,
          branch: prepared.branch || selectedBranch,
          guidance: prepared.guidance || guidance,
          reportCount: prepared.reportCount,
          feedbackCount: 0,
          summary: prepared.summary || 'No client feedback entries were recorded in this date range.',
          findings: [],
        });
        return;
      }

      const batches = [];
      for (let offset = 0; offset < feedbackItems.length; offset += ITEMS_PER_BATCH) {
        batches.push(feedbackItems.slice(offset, offset + ITEMS_PER_BATCH));
      }
      const session = {
        startDate: prepared.startDate,
        endDate: prepared.endDate,
        provider: prepared.provider,
        branch: prepared.branch || selectedBranch,
        guidance: prepared.guidance || guidance,
        reportCount: prepared.reportCount,
        feedbackCount: prepared.feedbackCount,
        feedbackItems,
        batches,
        results: {},
      };
      setReviewSession(session);
      setPhase('analyze');
      await executeBatches(token, session);
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to review feedback. Please try again.');
    } finally {
      setLoading(false);
      setPhase('');
    }
  };

  const resumeReview = async () => {
    if (!reviewSession || loading) return;
    setLoading(true);
    setPhase('analyze');
    setError('');
    try {
      const token = await user.getIdToken();
      await executeBatches(token, reviewSession, reviewSession.results || {});
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to resume the review. Please try again.');
    } finally {
      setLoading(false);
      setPhase('');
    }
  };


  const saveReview = async () => {
    if (!result || savingReview) return;
    setSavingReview(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/ai-feedback-reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: saveTitle, result }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save this review.');
      setSavedReviews((current) => [payload.review, ...current.filter((review) => review.id !== payload.review.id)]);
      setSaveTitle('');
    } catch (saveError) { setError(saveError.message); } finally { setSavingReview(false); }
  };

  const deleteSavedReview = async (review) => {
    if (!window.confirm(`Delete the saved review “${review.title}”?`)) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/ai-feedback-reviews?id=${encodeURIComponent(review.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to delete the saved review.');
      setSavedReviews((current) => current.filter((entry) => entry.id !== review.id));
    } catch (deleteError) { setError(deleteError.message); }
  };

  const openSavedReview = (review) => {
    setResult(review);
    setSelectedBranch(review.branch || '');
    setGuidance(review.guidance || '');
    setStartDate(review.startDate || startDate);
    setEndDate(review.endDate || endDate);
    setReviewSession(null);
    setError('');
  };

  const exportPdf = async () => {
    if (!result || exporting) return;
    setExporting(true);
    try {
      const { generateFeedbackAttentionPdf } = await import('@/lib/feedbackAttentionPdf');
      generateFeedbackAttentionPdf(result);
    } catch (exportError) {
      setError(exportError.message || 'Unable to export the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (profile?.role !== 'Admin') {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This page is available to administrators only.</div>;
  }

  const findings = result?.findings || [];
  const urgentCount = findings.filter((item) => item.severity === 'urgent').length;
  const attentionCount = findings.length - urgentCount;
  const progressPercent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const summaryLines = (result?.summary || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasBulletSummary = summaryLines.length > 0 && summaryLines.every((line) => /^[-*•]\s/.test(line));

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button>
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300">Admin review</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Feedback attention</h2></div>
        </div>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{REPORT_DESCRIPTION}</p>
      </div>
      <button type="button" onClick={onOpenSettings} className="shrink-0 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-sm hover:bg-violet-50 dark:border-violet-900/50 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/30">AI key settings</button>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">From<input type="date" value={startDate} max={endDate || undefined} disabled={loading} onChange={(event) => { setStartDate(event.target.value); setReviewSession(null); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">To<input type="date" value={endDate} min={startDate || undefined} disabled={loading} onChange={(event) => { setEndDate(event.target.value); setReviewSession(null); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Branch<select value={selectedBranch} disabled={loading} onChange={(event) => { setSelectedBranch(event.target.value); setReviewSession(null); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><option value="">Both branches</option>{branches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}</select></label>
        <button type="button" onClick={reviewFeedback} disabled={loading || !user} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60">{loading ? (phase === 'prepare' ? 'Preparing review…' : phase === 'summarize' ? 'Compressing summary…' : 'Reviewing batches…') : 'Review with AI'}</button>
      </div>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">AI guidance or instructions<textarea value={guidance} disabled={loading} onChange={(event) => { setGuidance(event.target.value); setReviewSession(null); }} maxLength={3000} rows={3} placeholder="Example: Treat complaints about delayed service as attention-worthy, but ignore compliments and routine suggestions." className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-rose-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" /></label>
      <p className="mt-3 text-xs font-medium text-slate-500">Only feedback text is sent to the selected AI provider; caller and client details are joined to flagged results separately.</p>
    </section>

    {loading && <section role="status" aria-live="polite" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-blue-900 dark:text-blue-100"><span>{phase === 'prepare' ? 'Preparing reports and feedback…' : phase === 'summarize' ? 'Compressing repeated themes into a short summary…' : `Reviewing feedback batches${progress.total ? ` (${progress.completed} of ${progress.total} complete)` : '…'}`}</span>{progress.total > 0 && <span>{progressPercent}%</span>}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} /></div>
      <p className="mt-2 text-xs font-medium text-blue-800/80 dark:text-blue-200/80">Long date ranges are processed in separate requests, so Vercel does not need to keep one function running for the entire review.</p>
    </section>}

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}{/key|configured/i.test(error) && <button type="button" onClick={onOpenSettings} className="ml-2 underline underline-offset-2">Open AI key settings</button>}{reviewSession && !loading && <button type="button" onClick={resumeReview} className="ml-3 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-black text-white hover:bg-rose-800">Retry unfinished batches</button>}</div>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900 dark:text-white">Saved feedback reviews</h3><p className="mt-1 text-xs font-medium text-slate-500">Open a previous review or remove one that is no longer needed.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{savedReviews.length}</span></div>{savedReviews.length ? <div className="mt-4 grid gap-2">{savedReviews.map((review) => <div key={review.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700"><div><p className="text-sm font-black text-slate-800 dark:text-slate-100">{review.title}</p><p className="mt-1 text-xs font-medium text-slate-500">{formatDate(review.startDate)} – {formatDate(review.endDate)} · {review.branch || 'Both branches'} · {review.findings?.length || 0} flagged</p></div><div className="flex gap-2"><button type="button" onClick={() => openSavedReview(review)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800">View</button><button type="button" onClick={() => deleteSavedReview(review)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300">Delete</button></div></div>)}</div> : <p className="mt-4 text-sm font-medium text-slate-500">No saved reviews yet.</p>}</section>

    {result && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reports reviewed</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{result.reportCount}</p><p className="mt-1 text-xs font-semibold text-slate-500">{result.feedbackCount} feedback entries</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-300">Urgent</p><p className="mt-2 text-2xl font-black text-rose-800 dark:text-rose-200">{urgentCount}</p><p className="mt-1 text-xs font-semibold text-rose-700/80 dark:text-rose-200/70">Prioritize follow-up</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">Needs attention</p><p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-200">{attentionCount}</p><p className="mt-1 text-xs font-semibold text-amber-800/80 dark:text-amber-200/70">Consider a follow-up</p></div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="text-lg font-black text-slate-900 dark:text-white">AI summary</h3><p className="mt-1 text-xs font-medium text-slate-500">{formatDate(result.startDate)} – {formatDate(result.endDate)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{findings.length} flagged</span><button type="button" onClick={exportPdf} disabled={exporting} className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-60">{exporting ? 'Preparing PDF…' : 'Export PDF'}</button></div></div>
        {result.summaryFallback && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">AI summary consolidation was unavailable, so distinct batch notes are shown instead.</p>}
        {hasBulletSummary ? <ul className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">{summaryLines.map((line, index) => <li key={`${index}-${line}`} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" /><span>{line.replace(/^[-*•]\s*/, '')}</span></li>)}</ul> : <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-slate-700 dark:text-slate-200">{result.summary || 'No recurring concern themes were identified.'}</p>}
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">Save this review for later<input value={saveTitle} onChange={(event) => setSaveTitle(event.target.value)} placeholder={`Feedback review - ${result.startDate} to ${result.endDate}`} className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-700 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-slate-200" /></label><button type="button" onClick={saveReview} disabled={savingReview || !user} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-60">{savingReview ? 'Saving…' : 'Save review'}</button></div></section>
      <section className="space-y-3">
        <div><h3 className="text-lg font-black text-slate-900 dark:text-white">Feedback requiring attention</h3><p className="mt-1 text-xs font-medium text-slate-500">Sorted urgent first, then items that may benefit from follow-up.</p></div>
        {findings.length ? findings.map((item, index) => <article key={`${item.sourceId || index}-${index}`} className={`rounded-2xl border p-5 shadow-sm ${severityStyle[item.severity] || severityStyle.attention}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full border border-current/20 bg-white/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] dark:bg-slate-950/30">{item.severity === 'urgent' ? 'Urgent concern' : 'Needs attention'}</span><span className="text-xs font-semibold opacity-75">{formatDate(item.reportDate)} · {item.branch || 'Branch not recorded'}{item.section ? ` · ${item.section}` : ''}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Caller</p><p className="mt-1 text-sm font-bold">{item.callerName || 'Caller not recorded'}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Client</p><p className="mt-1 text-sm font-bold">{item.clientName || 'Client name not recorded'}</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Phone</p><p className="mt-1 text-sm font-bold">{item.phoneNumber || 'Phone not recorded'}</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-current/10 bg-white/70 p-4 dark:bg-slate-950/25"><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Original feedback</p><p className="mt-1 whitespace-pre-line text-sm font-semibold leading-6">{item.feedback}</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Why it was flagged</p><p className="mt-1 text-sm font-medium leading-5">{item.reason}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider opacity-65">Suggested next step</p><p className="mt-1 text-sm font-medium leading-5">{item.suggestedAction}</p></div></div>
        </article>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">No feedback requiring attention was identified in this range. This is an AI-assisted review, not a guarantee that every issue was detected.</div>}
      </section>
    </>}
  </div>;
}
