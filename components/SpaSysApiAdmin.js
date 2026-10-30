'use client';

import { useCallback, useEffect, useState } from 'react';
import PageBackButton from '@/components/PageBackButton';
import { downloadDataUri } from '@/lib/downloadFile';
import { SPA_SYS_GUIDE } from '@/lib/spaSysGuide';
import { generateSpaSysGuidePdf } from '@/lib/spaSysGuidePdf';

const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-950';

function formatWhen(value) {
  if (!value) return 'Not yet';
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))} EAT`;
}

function webhookHost(value) {
  if (!value) return 'No webhook';
  try {
    return new URL(value).host;
  } catch {
    return 'Webhook saved';
  }
}

function CopyValue({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1.5 flex gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-2.5 text-xs font-medium text-slate-100">{value}</code>
        <button type="button" onClick={copy} className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}

function GuideBlock({ block }) {
  if (block.type === 'paragraph') return <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{block.text}</p>;
  if (block.type === 'note') return <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">{block.text}</p>;
  if (block.type === 'bullets' || block.type === 'steps') {
    const Tag = block.type === 'steps' ? 'ol' : 'ul';
    return (
      <Tag className={`${block.type === 'steps' ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 text-sm leading-6 text-slate-600 dark:text-slate-300`}>
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </Tag>
    );
  }
  if (block.type === 'code') return <pre className="overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs leading-5 text-slate-100"><code>{block.text}</code></pre>;
  if (block.type === 'table') {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
            <tr>{block.columns.map((column) => <th key={column} className="px-3 py-2 font-black">{column}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join('|')} className="border-t border-slate-200 dark:border-slate-800">
                {row.map((cell) => <td key={cell} className="px-3 py-2 text-slate-700 dark:text-slate-200">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function SpaSysApiAdmin({ user, profile, onBack }) {
  const [section, setSection] = useState('setup');
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [revealed, setRevealed] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [editName, setEditName] = useState('');
  const [editWebhook, setEditWebhook] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const baseUrl = `${origin || ''}/api/spa-sys/v1`;

  const authorizedFetch = useCallback(async (path, options = {}) => {
    const token = await user.getIdToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
    return payload;
  }, [user]);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await authorizedFetch('/api/admin/spa-sys');
      setIntegrations(Array.isArray(payload.integrations) ? payload.integrations : []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load API registrations.');
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    if (user) loadIntegrations();
  }, [loadIntegrations, user]);

  const registerSystem = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await authorizedFetch('/api/admin/spa-sys', {
        method: 'POST',
        body: JSON.stringify({ name, webhookUrl }),
      });
      setIntegrations((current) => [payload.integration, ...current.filter((item) => item.id !== payload.integration.id)]);
      setRevealed({
        title: `${payload.integration.name} is registered`,
        apiKey: payload.apiKey,
        webhookSecret: payload.webhookSecret,
      });
      setName('');
      setWebhookUrl('');
      setNotice('Copy the API key and webhook secret now. This page will not show them again.');
    } catch (registerError) {
      setError(registerError.message || 'Unable to register this system.');
    } finally {
      setBusy(false);
    }
  };

  const saveEdits = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await authorizedFetch(`/api/admin/spa-sys/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, webhookUrl: editWebhook }),
      });
      setIntegrations((current) => current.map((item) => (item.id === payload.integration.id ? payload.integration : item)));
      setEditingId('');
      setNotice('Registration updated. The API key did not change.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update this registration.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (item) => {
    const nextStatus = item.status === 'revoked' ? 'active' : 'revoked';
    const prompt = nextStatus === 'revoked'
      ? `Revoke ${item.name}? Its API key stops working immediately.`
      : `Activate ${item.name} again? The key already issued to that system starts working.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await authorizedFetch(`/api/admin/spa-sys/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setIntegrations((current) => current.map((entry) => (entry.id === payload.integration.id ? payload.integration : entry)));
      setNotice(nextStatus === 'revoked' ? `${item.name} is revoked.` : `${item.name} is active again.`);
    } catch (statusError) {
      setError(statusError.message || 'Unable to change this registration.');
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (item, credential) => {
    const label = credential === 'apiKey' ? 'API key' : 'webhook secret';
    if (!window.confirm(`Replace the ${label} for ${item.name}? The previous value stops working.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = await authorizedFetch(`/api/admin/spa-sys/${item.id}`, {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      setIntegrations((current) => current.map((entry) => (entry.id === payload.integration.id ? payload.integration : entry)));
      setRevealed({
        title: `New ${label} for ${item.name}`,
        apiKey: payload.apiKey || '',
        webhookSecret: payload.webhookSecret || '',
      });
      setNotice(`Copy the new ${label} now. The previous value no longer works.`);
    } catch (rotateError) {
      setError(rotateError.message || 'Unable to replace this credential.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}? Its key stops working and the registration is removed.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await authorizedFetch(`/api/admin/spa-sys/${item.id}`, { method: 'DELETE' });
      setIntegrations((current) => current.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) setEditingId('');
      setNotice(`${item.name} was deleted.`);
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete this registration.');
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () => {
    setError('');
    try {
      const pdf = generateSpaSysGuidePdf({ ...SPA_SYS_GUIDE, origin: origin || undefined });
      downloadDataUri(pdf.output('datauristring'), 'SPA_SYS_API_V1-guide.pdf');
      setNotice('SPA_SYS_API_V1-guide.pdf downloaded.');
    } catch (pdfError) {
      setError(pdfError.message || 'Unable to export the PDF.');
    }
  };

  if (profile?.role !== 'Admin') {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700">This page is available to administrators only.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <PageBackButton onClick={onBack} label="Back to Admin" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Admin · SPA_SYS_API_V1</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">SPA SYS API</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Register each external system, hand it a key, and keep the usage guide on this page. Every approved Admin can open it.</p>
          </div>
        </div>
        <div className="flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" onClick={() => setSection('setup')} className={`rounded-xl px-4 py-2 text-sm font-black ${section === 'setup' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Setup</button>
          <button type="button" onClick={() => setSection('documentation')} className={`rounded-xl px-4 py-2 text-sm font-black ${section === 'documentation' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>Documentation</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">{notice}</p>}

      {section === 'setup' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-black text-slate-900 dark:text-white">Base URL</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Give the other server this origin plus the path. The key stays in that server&apos;s environment, not in a browser.</p>
            <div className="mt-4"><CopyValue label="SPA_SYS_API_V1" value={baseUrl} /></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-black text-slate-900 dark:text-white">Register a system</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">One registration is one external product. The API key is stored as a hash. The webhook secret stays on the server so SpaGym can sign check-in alerts, and it is shown here only when it is created or replaced.</p>
            <form onSubmit={registerSystem} className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">System name
                <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="Front desk app" className={fieldClass} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Check-in webhook URL
                <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://partner.example/hooks/spagym" className={fieldClass} />
              </label>
              <div className="md:col-span-2">
                <button type="submit" disabled={busy || name.trim().length < 2} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{busy ? 'Saving…' : 'Register system'}</button>
              </div>
            </form>
          </section>

          {revealed && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/30">
              <h3 className="font-black text-amber-950 dark:text-amber-100">{revealed.title}</h3>
              <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-100">Store these in the other system&apos;s server environment. After you leave this panel, SpaGym cannot show the full values again. Use Rotate if they are lost.</p>
              <div className="mt-4 space-y-3">
                {revealed.apiKey && <CopyValue label="API key" value={revealed.apiKey} />}
                {revealed.webhookSecret && <CopyValue label="Webhook secret" value={revealed.webhookSecret} />}
              </div>
              <button type="button" onClick={() => setRevealed(null)} className="mt-4 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white">I have stored these</button>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 dark:text-white">Registered systems</h3>
              <button type="button" onClick={loadIntegrations} disabled={loading || busy} className="text-sm font-bold text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-300">Refresh</button>
            </div>
            {loading && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Loading registrations…</p>}
            {!loading && integrations.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">No external system is registered yet. Environment keys, when set on the server, still work.</p>}
            {integrations.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">{item.name}</h4>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${item.status === 'revoked' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">Key preview {item.keyPreview || '--------'} · {webhookHost(item.webhookUrl)} · Created {formatWhen(item.createdAt)}{item.createdByName ? ` by ${item.createdByName}` : ''} · Last used {formatWhen(item.lastUsedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => { setEditingId(item.id); setEditName(item.name); setEditWebhook(item.webhookUrl || ''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Edit</button>
                    <button type="button" disabled={busy} onClick={() => rotate(item, 'apiKey')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Rotate key</button>
                    <button type="button" disabled={busy} onClick={() => rotate(item, 'webhookSecret')} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Rotate secret</button>
                    <button type="button" disabled={busy} onClick={() => changeStatus(item)} className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/50 dark:text-amber-200">{item.status === 'revoked' ? 'Activate' : 'Revoke'}</button>
                    <button type="button" disabled={busy} onClick={() => remove(item)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:text-rose-200">Delete</button>
                  </div>
                </div>
                {editingId === item.id && (
                  <form onSubmit={saveEdits} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">System name
                      <input value={editName} onChange={(event) => setEditName(event.target.value)} required minLength={2} maxLength={80} className={fieldClass} />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Webhook URL
                      <input value={editWebhook} onChange={(event) => setEditWebhook(event.target.value)} placeholder="Leave blank to stop alerts" className={fieldClass} />
                    </label>
                    <div className="flex gap-2 md:col-span-2">
                      <button type="submit" disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">Save changes</button>
                      <button type="button" onClick={() => setEditingId('')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      {section === 'documentation' && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">{SPA_SYS_GUIDE.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{SPA_SYS_GUIDE.subtitle}. This copy uses {baseUrl}.</p>
            </div>
            <button type="button" onClick={exportPdf} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">Export PDF</button>
          </div>
          {SPA_SYS_GUIDE.sections.map((guideSection) => (
            <article key={guideSection.heading} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{guideSection.heading}</h3>
              {guideSection.blocks.map((block, index) => <GuideBlock key={`${guideSection.heading}-${index}`} block={block} />)}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
