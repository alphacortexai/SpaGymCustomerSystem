import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const BIRTHDAY_CALLERS_COLLECTION = 'birthday_callers';

export async function getBirthdayCallers() {
  try {
    const callersQuery = query(
      collection(db, BIRTHDAY_CALLERS_COLLECTION),
      orderBy('name', 'asc')
    );
    const snapshot = await getDocs(callersQuery);
    return snapshot.docs
      .map((callerDoc) => ({ id: callerDoc.id, ...callerDoc.data() }))
      .filter((caller) => caller.active !== false);
  } catch (error) {
    console.error('Error getting birthday callers:', error);
    return [];
  }
}

export async function addBirthdayCaller({ name, roleLabel = '' }) {
  const normalizedName = name?.trim();
  if (!normalizedName) return { success: false, error: 'A caller name is required.' };

  try {
    const callerDoc = await addDoc(collection(db, BIRTHDAY_CALLERS_COLLECTION), {
      name: normalizedName,
      roleLabel: roleLabel?.trim() || '',
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { success: true, id: callerDoc.id };
  } catch (error) {
    console.error('Error adding birthday caller:', error);
    return { success: false, error: error.message };
  }
}

export async function updateBirthdayCaller(callerId, { name, roleLabel = '', active = true }) {
  const normalizedName = name?.trim();
  if (!callerId || !normalizedName) return { success: false, error: 'A caller name is required.' };

  try {
    await updateDoc(doc(db, BIRTHDAY_CALLERS_COLLECTION, callerId), {
      name: normalizedName,
      roleLabel: roleLabel?.trim() || '',
      active,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating birthday caller:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteBirthdayCaller(callerId) {
  try {
    await deleteDoc(doc(db, BIRTHDAY_CALLERS_COLLECTION, callerId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting birthday caller:', error);
    return { success: false, error: error.message };
  }
}
