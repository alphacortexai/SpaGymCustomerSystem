import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';

const MEMBERSHIP_TYPES_COLLECTION = 'membership_types';
const ENROLLMENTS_COLLECTION = 'enrollments';
const ACCESS_LOGS_COLLECTION = 'access_logs';

/**
 * Membership Types CRUD
 */
export async function addMembershipType(data) {
  try {
    const docRef = await addDoc(collection(db, MEMBERSHIP_TYPES_COLLECTION), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding membership type:', error);
    return { success: false, error: error.message };
  }
}

export async function getMembershipTypes() {
  try {
    const q = query(collection(db, MEMBERSHIP_TYPES_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting membership types:', error);
    return [];
  }
}

/**
 * Enrollment Management
 */
export async function enrollClient(enrollmentData) {
  try {
    const { clientId, membershipTypeId, startDate, durationDays } = enrollmentData;
    const start = new Date(startDate);
    const expiry = new Date(start);
    expiry.setDate(start.getDate() + parseInt(durationDays));

    const docRef = await addDoc(collection(db, ENROLLMENTS_COLLECTION), {
      ...enrollmentData,
      startDate: Timestamp.fromDate(start),
      expiryDate: Timestamp.fromDate(expiry),
      redeemedEntitlements: [],
      status: 'active',
      createdAt: Timestamp.now(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error enrolling client:', error);
    return { success: false, error: error.message };
  }
}

export async function getClientEnrollments(clientId) {
  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      startDate: doc.data().startDate?.toDate(),
      expiryDate: doc.data().expiryDate?.toDate()
    }));
  } catch (error) {
    console.error('Error getting client enrollments:', error);
    return [];
  }
}

/**
 * Access Logging
 */
export async function logAccess(clientId, enrollmentId, date = new Date()) {
  try {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const logId = `${clientId}_${dateStr}`;
    
    await setDoc(doc(db, ACCESS_LOGS_COLLECTION, logId), {
      clientId,
      enrollmentId,
      accessDate: Timestamp.fromDate(date),
      dateStr,
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging access:', error);
    return { success: false, error: error.message };
  }
}

export async function getAccessLogs(clientId, year) {
  try {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    const q = query(
      collection(db, ACCESS_LOGS_COLLECTION),
      where('clientId', '==', clientId),
      where('accessDate', '>=', Timestamp.fromDate(startOfYear)),
      where('accessDate', '<=', Timestamp.fromDate(endOfYear))
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().dateStr);
  } catch (error) {
    console.error('Error getting access logs:', error);
    return [];
  }
}

/**
 * Entitlement Redemption
 */
export async function redeemEntitlement(enrollmentId, entitlement) {
  try {
    const enrollmentRef = doc(db, ENROLLMENTS_COLLECTION, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    const redeemed = data.redeemedEntitlements || [];
    
    await updateDoc(enrollmentRef, {
      redeemedEntitlements: [...redeemed, {
        name: entitlement,
        redeemedAt: Timestamp.now()
      }]
    });
    return { success: true };
  } catch (error) {
    console.error('Error redeeming entitlement:', error);
    return { success: false, error: error.message };
  }
}
