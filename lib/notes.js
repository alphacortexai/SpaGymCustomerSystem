import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const NOTES_COLLECTION = 'notes';

const normalizeNote = (snapshot) => ({
  id: snapshot.id,
  ...snapshot.data(),
  createdAt: snapshot.data().createdAt?.toDate?.() || null,
  updatedAt: snapshot.data().updatedAt?.toDate?.() || null,
});

export async function getAllNotes() {
  try {
    const snapshot = await getDocs(collection(db, NOTES_COLLECTION));
    return snapshot.docs
      .map(normalizeNote)
      .sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
  } catch (error) {
    console.error('Error loading notes:', error);
    return [];
  }
}

export async function getActiveNotesCount() {
  const notes = await getAllNotes();
  return notes.filter((note) => note.status === 'active').length;
}

export async function addNote({ title, content }, currentUser = null) {
  try {
    const cleanTitle = title?.trim();
    const cleanContent = content?.trim();
    if (!cleanTitle || !cleanContent) {
      return { success: false, error: 'A title and note details are required.' };
    }

    const now = Timestamp.now();
    const noteRef = await addDoc(collection(db, NOTES_COLLECTION), {
      title: cleanTitle,
      content: cleanContent,
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
