'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { addNote, deleteNote, getAllNotes, updateNoteStatus } from '@/lib/notes';

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
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const loadedNotes = await getAllNotes();
    setNotes(loadedNotes);
    onActiveCountChange?.(loadedNotes.filter((note) => note.status === 'active').length);
    setLoading(false);
  }, [onActiveCountChange]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const visibleNotes = useMemo(() => {
    if (filter === 'all') return notes;
    return notes.filter((note) => note.status === filter);
  }, [filter, notes]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const result = await addNote({ title, content }, user);
    if (result.success) {
      setTitle('');
      setContent('');
      setFilter('active');
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
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          {notes.filter((note) => note.status === 'active').length} active notes
        </div>
      </div>

      <form onSubmit={handleSubmit} className="dashboard-surface rounded-2xl p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Note title"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            required
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a reminder or reference note..."
            rows={3}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            required
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : <p className="text-xs text-slate-500">New notes are active by default.</p>}
          <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Create note'}
          </button>
        </div>
      </form>

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
        <div className="dashboard-surface rounded-2xl p-10 text-center text-sm text-slate-500">No {filter === 'all' ? '' : filter} notes yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleNotes.map((note) => (
            <article key={note.id} className={`rounded-2xl border p-5 shadow-sm ${note.status === 'active' ? 'border-blue-100 bg-white dark:border-blue-900/40 dark:bg-slate-900' : 'border-slate-200 bg-slate-50/70 opacity-80 dark:border-slate-800 dark:bg-slate-900/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{note.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">Created {formatDate(note.createdAt)} by {note.createdByName || 'User'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${note.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {note.status}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{note.content}</p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
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
    </div>
  );
}
