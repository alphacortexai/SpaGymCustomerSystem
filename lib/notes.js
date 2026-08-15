import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const NOTES_COLLECTION = 'notes';

const normalizeNote = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
  createdAt: snapshot.data().createdAt?.toDate?.() || null,
  updatedAt: snapshot.data().updatedAt?.toDate?.() || null,
});

export async function getAllNotes(currentUser = null, profile = null) {
  try {
    if (!currentUser?.uid) return [];

    const notesCollection = collection(db, NOTES_COLLECTION);
    const noteQueries = [query(notesCollection, where('createdBy', '==', currentUser.uid))];
    const assignedBranches = Array.isArray(profile?.assignedBranches) ? profile.assignedBranches.filter(Boolean) : [];
    noteQueries.push(query(notesCollection, where('visibility', '==', 'all')));
    for (let index = 0; index < assignedBranches.length; index += 10) {
      const branchChunk = assignedBranches.slice(index, index + 10);
      noteQueries.push(query(notesCollection, where('branch', 'in', branchChunk)));
    }

    const snapshots = await Promise.all(noteQueries.map((noteQuery) => getDocs(noteQuery)));
    const uniqueNotes = new Map();
    snapshots.flatMap((snapshot) => snapshot.docs).forEach((snapshot) => {
      const note = normalizeNote(snapshot);
      if (note.visibility === 'creator' && note.createdBy !== currentUser.uid) return;
      if (note.visibility === 'branch' && !assignedBranches.includes(note.branch) && note.createdBy !== currentUser.uid) return;
      uniqueNotes.set(snapshot.id, note);
    });

    return [...uniqueNotes.values()]
      .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

export async function getActiveNotesCount(currentUser = null, profile = null) {
  const notes = await getAllNotes(currentUser, profile);
  return notes.filter((note) => note.status === 'active').length;
}

export async function addNote({ title, content, branch, visibility = 'branch' }, currentUser = null) {
  try {
    const cleanTitle = title?.trim();
    const cleanContent = content?.trim();
    if (!cleanTitle || !cleanContent || !['creator', 'branch', 'all'].includes(visibility)) {
      return { success: false, error: 'A title, note details, and valid visibility setting are required.' };
    }
    if (visibility === 'branch' && !branch?.trim()) {
      return { success: false, error: 'Select a branch for branch-visible notes.' };
    }

    const now = Timestamp.now();
    const noteRef = await addDoc(collection(db, NOTES_COLLECTION), {
      title: cleanTitle,
      content: cleanContent,
      branch: visibility === 'branch' ? branch.trim() : '',
      visibility,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: currentUser?.uid || null,
      createdByName: currentUser?.displayName || currentUser?.email || 'User',
    });

    return { success: true, id: noteRef.id };
  } catch (error) {
    console.error('Error adding note:', error);
    return { success: false, error: error.message };
  }
}

export async function updateNote(noteId, { title, content, branch, visibility = 'branch', status }, currentUser = null) {
  try {
    const cleanTitle = title?.trim();
    const cleanContent = content?.trim();
    if (!cleanTitle || !cleanContent || !['creator', 'branch', 'all'].includes(visibility)) {
      return { success: false, error: 'A title, note details, and valid visibility setting are required.' };
    }
    if (visibility === 'branch' && !branch?.trim()) {
      return { success: false, error: 'Select a branch for branch-visible notes.' };
    }
    if (status && !['active', 'archived'].includes(status)) {
      return { success: false, error: 'Invalid note status.' };
    }

    const noteRef = doc(db, NOTES_COLLECTION, noteId);
    const snapshot = await getDocs(collection(db, NOTES_COLLECTION));
    const existingNote = snapshot.docs.find((item) => item.id === noteId)?.data();
    if (!existingNote || existingNote.createdBy !== currentUser?.uid) {
      return { success: false, error: 'Only the user who created this note can edit it.' };
    }

    await updateDoc(noteRef, {
      title: cleanTitle,
      content: cleanContent,
      branch: visibility === 'branch' ? branch.trim() : '',
      visibility,
      ...(status ? { status } : {}),
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating note:', error);
    return { success: false, error: error.message };
  }
}

export async function updateNoteStatus(noteId, status) {
  try {
    if (!['active', 'archived'].includes(status)) {
      return { success: false, error: 'Invalid note status.' };
    }
    await updateDoc(doc(db, NOTES_COLLECTION, noteId), {
      status,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating note status:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteNote(noteId) {
  try {
    await deleteDoc(doc(db, NOTES_COLLECTION, noteId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
}
