'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { addNote, deleteNote, getAllNotes, updateNote, updateNoteStatus } from '@/lib/notes';

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

export default function NotesSection({ onActiveCountChange }) {
  const { user, profile } = useAuth();
  const { branches = [] } = useData();
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [branch, setBranch] = useState('');
  const [filter, setFilter] = useState('active');
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
    if (filter === 'all') return notes;
    return notes.filter((note) => note.status === filter);
  }, [filter, notes]);

  const closeComposer = () => {
    if (saving) return;
    setIsComposerOpen(false);
    setEditingNote(null);
    setTitle('');
    setContent('');
    setBranch('');
    setError('');
  };

  const openCreateComposer = () => {
    setError('');
    setEditingNote(null);
    setTitle('');
    setContent('');
    setBranch(branches[0]?.name || '');
    setIsComposerOpen(true);
  };

  const openEditComposer = (note) => {
    if (note.createdBy !== user?.uid) return;
    setError('');
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setBranch(note.branch || branches[0]?.name || '');
    setIsComposerOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const result = editingNote
      ? await updateNote(editingNote.id, { title, content, branch }, user)
      : await addNote({ title, content, branch }, user);
    if (result.success) {
      setTitle('');
      setContent('');
      setBranch('');
      setFilter('active');
      setIsComposerOpen(false);
      setEditingNote(null);
      await loadNotes();
    } else {
      setError(result.error || 'Unable to create note.');
    }
    setSaving(false);
  };

  const handleStatusChange = async (note, status) => {
    const result = await updateNoteStatus(note.id, status);
    if (result.success) await loadNotes();
    else setError(result.error || 'Unable to update note.');
  };

  const handleDelete = async (note) => {
    if (!window.confirm(`Delete “${note.title}” permanently?`)) return;
    const result = await deleteNote(note.id);
    if (result.success) await loadNotes();
    else setError(result.error || 'Unable to delete note.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Reference notes</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Notes</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">Capture reminders for today or later. New notes stay active until you complete or archive them.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
            {activeNotes.length} active notes
          </div>
          <button type="button" onClick={openCreateComposer} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">
            Create note
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['active', 'archived', 'all'].map((option) => (
          <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${filter === option ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
            {option}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="dashboard-surface rounded-2xl p-10 text-center text-sm text-slate-500">Loading notes...</div>
      ) : visibleNotes.length === 0 ? (
        <div className="dashboard-surface rounded-2xl p-10 text-center">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">You have no notes</p>
          <p className="mt-1 text-sm text-slate-500">Create a note when you need a reminder or future reference.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleNotes.map((note) => (
            <article key={note.id} className={`rounded-2xl border p-5 shadow-sm ${note.status === 'active' ? 'border-blue-100 bg-white dark:border-blue-900/40 dark:bg-slate-900' : 'border-slate-200 bg-slate-50/70 opacity-80 dark:border-slate-800 dark:bg-slate-900/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{note.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">Created {formatDate(note.createdAt)} by {note.createdByName || 'User'}{note.branch ? ` · ${note.branch}` : ''}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${note.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {note.status}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{note.content}</p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {note.createdBy === user?.uid && <button type="button" onClick={() => openEditComposer(note)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300">Edit</button>}
                {note.status === 'active' ? (
                  <button type="button" onClick={() => handleStatusChange(note, 'archived')} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300">Deactivate / archive</button>
                ) : (
                  <button type="button" onClick={() => handleStatusChange(note, 'active')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300">Reactivate</button>
                )}
                <button type="button" onClick={() => handleDelete(note)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300">Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isComposerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="note-composer-title">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Close note composer" onClick={closeComposer} />
          <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">{editingNote ? 'Update reference' : 'New reference'}</p>
                <h3 id="note-composer-title" className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{editingNote ? 'Edit note' : 'Create a note'}</h3>
              </div>
              <button type="button" onClick={closeComposer} className="rounded-xl px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label="Close">×</button>
            </div>
            <div className="mt-5 space-y-4">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" required autoFocus />
              <select value={branch} onChange={(event) => setBranch(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" required>
                <option value="">Select a branch</option>
                {branches.map((availableBranch) => <option key={availableBranch.id} value={availableBranch.name}>{availableBranch.name}</option>)}
              </select>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a reminder or reference note..." rows={5} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" required />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : <p className="text-xs text-slate-500">{editingNote ? 'Only you can edit this note.' : 'New notes are active by default.'}</p>}
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
