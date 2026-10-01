'use client';

import { useCallback, useEffect, useState } from 'react';

const providerName = (provider) => provider === 'gemini' ? 'Google Gemini' : 'OpenAI';

export default function AiFeedbackSettings({ user, profile, onBack }) {
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState('openai');
  const [savedProvider, setSavedProvider] = useState('openai');
  const [updatedAt, setUpdatedAt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/ai-settings', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load AI settings.');
      const loadedProvider = payload.provider === 'gemini' ? 'gemini' : 'openai';
      setConfigured(Boolean(payload.configured));
      setProvider(loadedProvider);
      setSavedProvider(loadedProvider);
      setUpdatedAt(payload.updatedAt || '');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load AI settings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadSettings(); }, [loadSettings, user]);

  const saveKey = async (event) => {
    event.preventDefault();
    if (!apiKey.trim()) {
      setError(`Enter a ${providerName(provider)} API key before saving.`);
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to save the API key.');
      setConfigured(true);
      setProvider(payload.provider || provider);
      setSavedProvider(payload.provider || provider);
      setUpdatedAt(payload.updatedAt || new Date().toISOString());
      setApiKey('');
      setNotice(`${providerName(payload.provider || provider)} API key saved on the server. It is not shown again in this page.`);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the API key.');
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async () => {
    if (!window.confirm('Remove the saved AI API key? Feedback review will stop working until a new key is saved.')) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/ai-settings', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to remove the API key.');
      setConfigured(false);
      setUpdatedAt('');
      setNotice('Saved AI API key removed.');
    } catch (clearError) {
      setError(clearError.message || 'Unable to remove the API key.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'Admin') {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This page is available to administrators only.</div>;
  }

  const docsLink = provider === 'gemini'
    ? 'https://aistudio.google.com/app/apikey'
    : 'https://platform.openai.com/api-keys';

  return <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
    <div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to Admin" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">←</button><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">Top Admin · AI setup</p><h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">AI provider settings</h2></div></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-xl text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">AI</div><div><h3 className="font-black text-slate-900 dark:text-white">Choose your AI provider</h3><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Use either OpenAI or Google Gemini. Only one provider/key is active at a time; saving a new key replaces the previous one. The key is stored server-side and is never sent back to the browser. Only approved Admin accounts can update it.</p></div></div>
      <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${configured ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'}`}>
        {loading ? 'Checking saved key status…' : configured ? `Saved ${providerName(savedProvider)} key${updatedAt ? ` · last updated ${new Date(updatedAt).toLocaleString()}` : ''}.` : 'No AI API key is configured yet.'}
      </div>
      <form onSubmit={saveKey} className="mt-5 space-y-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">AI provider<select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-950"><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option></select></label>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">{providerName(provider)} API key<input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? 'Enter a new key to replace the saved key' : `Paste your ${providerName(provider)} API key`} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-violet-950" /></label>
        <p className="text-xs font-medium text-slate-500">Get a key from <a href={docsLink} target="_blank" rel="noreferrer" className="font-bold text-violet-700 underline underline-offset-2 dark:text-violet-300">{provider === 'gemini' ? 'Google AI Studio' : 'OpenAI platform'}</a>.</p>
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={loading || saving || !apiKey.trim()} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-50">{saving ? 'Saving…' : configured ? 'Save provider and replace key' : 'Save provider and key'}</button>{configured && <button type="button" onClick={clearKey} disabled={saving || loading} className="rounded-xl border border-rose-200 px-5 py-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-200 dark:hover:bg-rose-950/30">Remove key</button>}</div>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">{notice}</p>}
    </section>
    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">Only feedback text is sent to the selected AI provider for classification. Client names, phone numbers, caller names, and branch details stay in SpaGym and are joined to the results after analysis.</p>
  </div>;
}
