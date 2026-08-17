'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addNote, deleteNote, getAllNotes, updateNote } from '@/lib/notes';
import { validateNoteInput } from '@/lib/validation';
import LoadingState from './LoadingState';

const formatDate = (date) => {
  if (!date) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const visibilityLabel = (note) => {
  if (note.visibility === 'all') return 'All branches';
  if (note.visibility === 'creator') return 'Creator only';
  return note.branch || 'Assigned branch';
};

export default function NotesSection({ onActiveCountChange, onBack }) {
  const { user, profile } = useAuth();
  const { branches = [] } = useData();
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [branch, setBranch] = useState('');
  const [visibility, setVisibility] = useState('branch');
  const [status, setStatus] = useState('active');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const loadedNotes = await getAllNotes(user, profile);
    const newestFirst = [...loadedNotes].sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
    setNotes(newestFirst);
    onActiveCountChange?.(newestFirst.filter((note) => note.status === 'active').length);
    setLoading(false);
  }, [onActiveCountChange, profile, user]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const activeNotes = useMemo(() => notes.filter((note) => note.status === 'active'), [notes]);
  const visibleNotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return notes.filter((note) => {
      const matchesStatus = filter === 'all' || note.status === filter;
      const matchesSearch = !normalizedSearch || [note.title, note.content, note.branch, note.createdByName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [filter, notes, search]);

  const closeComposer = () => {
    if (saving) return;
    setIsComposerOpen(false);
    setEditingNote(null);
    setTitle('');
    setContent('');
    setBranch('');
    setVisibility('branch');
    setStatus('active');
    setError('');
  };

  const openCreateComposer = () => {
    setError('');
    setEditingNote(null);
    setTitle('');
    setContent('');
    setBranch(branches[0]?.name || '');
    setVisibility('branch');
    setStatus('active');
    setIsComposerOpen(true);
  };

  const openEditComposer = (note) => {
    if (note.createdBy !== user?.uid) return;
    setError('');
    setEditingNote(note);
    setTitle(note.title || '');
    setContent(note.content || '');
    setBranch(note.branch || branches[0]?.name || '');
    setVisibility(note.visibility || (note.branch ? 'branch' : 'creator'));
    setStatus(note.status || 'active');
    setIsComposerOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const validation = validateNoteInput({ title, content, branch, visibility });
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setSaving(true);
    const result = editingNote
      ? await updateNote(editingNote.id, { ...validation.value, status }, user)
      : await addNote(validation.value, user);
    if (result.success) {
      closeComposer();
      await loadNotes();
    } else {
      setError(result.error || 'Unable to save note.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editingNote || editingNote.createdBy !== user?.uid) return;
    if (!window.confirm(`Delete “${editingNote.title}” permanently?`)) return;
    const result = await deleteNote(editingNote.id);
    if (result.success) {
      closeComposer();
      await loadNotes();
    } else {
      setError(result.error || 'Unable to delete note.');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Back to Home" title="Back to Home" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Notes</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Keep reminders and references in one place.</p>
        </div>
        <button type="button" onClick={openCreateComposer} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">
          Create note
        </button>
      </div>

      <div className="dashboard-surface rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {['active', 'archived', 'all'].map((option) => (
              <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${filter === option ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                {option}
              </button>
            ))}
            <span className="ml-1 text-xs text-slate-400">{activeNotes.length} active</span>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes..." aria-label="Search notes" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:max-w-xs" />
        </div>

        {loading ? (
          <div className="py-10"><LoadingState title="Loading notes..." description="Preparing your references." /></div>
        ) : visibleNotes.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-bold text-slate-700 dark:text-slate-200">You have no notes</p>
            <p className="mt-1 text-sm text-slate-500">Try another filter or create a new note.</p>
          </div>
        ) : (
          <div>
            {visibleNotes.map((note, index) => (
              <article key={note.id} className={`flex items-start justify-between gap-4 py-4 ${index > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{note.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${note.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{note.status}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{note.content}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatDate(note.createdAt)} · {visibilityLabel(note)}</p>
                </div>
                {note.createdBy === user?.uid && (
                  <button type="button" onClick={() => openEditComposer(note)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400" aria-label={`Edit ${note.title}`}>
                    Edit
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {isComposerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="note-composer-title">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Close note editor" onClick={closeComposer} />
          <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">{editingNote ? 'Edit note' : 'New note'}</p>
                <h3 id="note-composer-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">{editingNote ? 'Update note' : 'Create a note'}</h3>
              </div>
              <button type="button" onClick={closeComposer} className="rounded-lg px-2 text-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">×</button>
            </div>
            <div className="mt-5 space-y-4">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" required autoFocus />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a reminder or reference note..." rows={5} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" required />
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500">Visibility</label>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <option value="creator">Creator only</option>
                  <option value="branch">Users in a selected branch</option>
                  <option value="all">All branches</option>
                </select>
              </div>
              {visibility === 'branch' && (
                <select value={branch} onChange={(event) => setBranch(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" required>
                  <option value="">Select a branch</option>
                  {branches.map((availableBranch) => <option key={availableBranch.id} value={availableBranch.name}>{availableBranch.name}</option>)}
                </select>
              )}
              {editingNote && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-500">Note status</label>
                  <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <option value="active">Active</option>
                    <option value="archived">Inactive / archived</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>{error ? <p className="text-sm font-medium text-rose-600">{error}</p> : editingNote ? <button type="button" onClick={handleDelete} className="text-xs font-bold text-rose-600 hover:text-rose-700">Delete note</button> : <p className="text-xs text-slate-500">New notes are active by default.</p>}</div>
              <div className="flex gap-2 sm:ml-auto">
                <button type="button" onClick={closeComposer} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving...' : editingNote ? 'Save changes' : 'Save note'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
