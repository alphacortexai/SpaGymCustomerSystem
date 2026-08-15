import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const PARTNER_COMPANIES_COLLECTION = 'partnerCompanies';

export async function getPartnerCompanies() {
  try {
    const snapshot = await getDocs(query(collection(db, PARTNER_COMPANIES_COLLECTION), orderBy('name')));
    return snapshot.docs.map((companyDoc) => ({ id: companyDoc.id, ...companyDoc.data() }));
  } catch (error) {
    console.error('Error loading partner companies:', error);
    return [];
  }
}

export async function addPartnerCompany(name, currentUser = null) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return { success: false, error: 'Company name is required.' };

  try {
    const companyRef = await addDoc(collection(db, PARTNER_COMPANIES_COLLECTION), {
      name: trimmedName,
      createdAt: serverTimestamp(),
      createdBy: currentUser?.uid || null,
    });
    return { success: true, id: companyRef.id };
  } catch (error) {
    console.error('Error adding partner company:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePartnerCompany(companyId, name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) return { success: false, error: 'Company name is required.' };

  try {
    await updateDoc(doc(db, PARTNER_COMPANIES_COLLECTION, companyId), { name: trimmedName });
    return { success: true };
  } catch (error) {
    console.error('Error updating partner company:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePartnerCompany(companyId) {
  try {
    await deleteDoc(doc(db, PARTNER_COMPANIES_COLLECTION, companyId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting partner company:', error);
    return { success: false, error: error.message };
  }
}
