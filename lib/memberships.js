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

const SPA_MEMBERSHIP_TYPES_COLLECTION = 'spa_membership_types';
const SPA_ENROLLMENTS_COLLECTION = 'spa_enrollments';
const SPA_ACCESS_LOGS_COLLECTION = 'spa_access_logs';

/**
 * Membership Types CRUD
 */
export async function addMembershipType(data, currentUser = null, isSpa = false) {
  const collectionName = isSpa ? SPA_MEMBERSHIP_TYPES_COLLECTION : MEMBERSHIP_TYPES_COLLECTION;
  const targetType = isSpa ? 'SPA_MEMBERSHIP_TYPE' : 'GYM_MEMBERSHIP_TYPE';
  const detailsPrefix = isSpa ? 'Added spa membership type' : 'Added gym membership type';

  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'ADD',
        targetType: targetType,
        targetId: docRef.id,
        targetName: data.type || data.name,
        details: `${detailsPrefix} ${data.type || data.name}`
      });
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding membership type:', error);
    return { success: false, error: error.message };
  }
}

export async function getMembershipTypes(isSpa = false) {
  const collectionName = isSpa ? SPA_MEMBERSHIP_TYPES_COLLECTION : MEMBERSHIP_TYPES_COLLECTION;
  try {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting membership types:', error);
    return [];
  }
}

export async function updateMembershipType(id, data, currentUser = null, isSpa = false) {
  const collectionName = isSpa ? SPA_MEMBERSHIP_TYPES_COLLECTION : MEMBERSHIP_TYPES_COLLECTION;
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_MEMBERSHIP_TYPE' : 'GYM_MEMBERSHIP_TYPE';

  try {
    const docRef = doc(db, collectionName, id);
    const oldDoc = await getDoc(docRef);
    const oldData = oldDoc.data();

    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });

    // Update all active enrollments with this membership type
    const enrollmentsQuery = query(
      collection(db, enrollmentsCollection),
      where('membershipTypeId', '==', id),
      where('status', '==', 'active')
    );
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    const updatePromises = enrollmentsSnapshot.docs.map(enrollmentDoc => {
      const enrollmentRef = doc(db, enrollmentsCollection, enrollmentDoc.id);
      
      // Update fields that should reflect changes
      const updates = {
        membershipType: data.type,
        description: data.description,
      };

      if (!data.isReducingBalance) {
        updates.price = data.price;
        updates.entitlements = data.entitlements;
      }

      return updateDoc(enrollmentRef, updates);
    });

    await Promise.all(updatePromises);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'UPDATE',
        targetType: targetType,
        targetId: id,
        targetName: data.type,
        details: `Updated ${isSpa ? 'spa' : 'gym'} membership type ${data.type} and reflected changes in ${updatePromises.length} active enrollments`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating membership type:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteMembershipType(id, currentUser = null, isSpa = false) {
  const collectionName = isSpa ? SPA_MEMBERSHIP_TYPES_COLLECTION : MEMBERSHIP_TYPES_COLLECTION;
  const targetType = isSpa ? 'SPA_MEMBERSHIP_TYPE' : 'GYM_MEMBERSHIP_TYPE';

  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    await deleteDoc(docRef);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'DELETE',
        targetType: targetType,
        targetId: id,
        targetName: data.type,
        details: `Deleted ${isSpa ? 'spa' : 'gym'} membership type ${data.type}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting membership type:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enrollment Management
 */
export async function enrollClient(enrollmentData, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const { clientId, membershipTypeId, startDate, durationDays } = enrollmentData;

    // Check if client already has an active membership
    const activeEnrollmentsQuery = query(
      collection(db, enrollmentsCollection),
      where('clientId', '==', clientId),
      where('status', '==', 'active')
    );
    const activeEnrollmentsSnapshot = await getDocs(activeEnrollmentsQuery);
    
    // Filter for memberships that haven't expired yet and are not cancelled
    const now = new Date();
    const activeEnrollments = activeEnrollmentsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const isNotCancelled = data.status !== 'cancelled';
      // Check if it's expired or if it's the same membership type being added
      const isNotExpired = data.expiryDate?.toDate() > now;
      return isNotCancelled && isNotExpired;
    });

    if (activeEnrollments.length > 0) {
      const active = activeEnrollments[0].data();
      const expiryStr = active.expiryDate?.toDate().toLocaleDateString();
      
      // If trying to enroll in the EXACT same membership type that is already active
      if (active.membershipTypeId === membershipTypeId) {
        return {
          success: false,
          error: `Client is already enrolled in this "${active.membershipType}" membership. It expires on ${expiryStr}.`
        };
      }

      return { 
        success: false, 
        error: `Client already has an active "${active.membershipType}" membership expiring on ${expiryStr}. Please cancel it before enrolling in a new one.` 
      };
    }

    const start = new Date(startDate);
    const expiry = new Date(start);
    expiry.setDate(start.getDate() + parseInt(durationDays));

    const finalPrice = enrollmentData.isReducingBalance ? parseFloat(enrollmentData.price) : enrollmentData.price;

    const docRef = await addDoc(collection(db, enrollmentsCollection), {
      ...enrollmentData,
      price: finalPrice,
      startDate: Timestamp.fromDate(start),
      expiryDate: Timestamp.fromDate(expiry),
      redeemedEntitlements: [],
      isReducingBalance: enrollmentData.isReducingBalance || false,
      balance: enrollmentData.isReducingBalance ? finalPrice : 0,
      treatments: [],
      status: 'active',
      enrolledBy: currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        email: currentUser.email
      } : null,
      createdAt: Timestamp.now(),
    });

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'ADD',
        targetType: targetType,
        targetId: docRef.id,
        targetName: enrollmentData.clientName || enrollmentData.clientId,
        details: `Enrolled client ${enrollmentData.clientName || enrollmentData.clientId} in ${isSpa ? 'spa' : 'gym'} membership`
      });
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error enrolling client:', error);
    return { success: false, error: error.message };
  }
}

export async function getClientEnrollments(clientId, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  try {
    const q = query(
      collection(db, enrollmentsCollection),
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
export async function logAccess(clientId, enrollmentId, date = new Date(), currentUser = null, isSpa = false) {
  const accessLogsCollection = isSpa ? SPA_ACCESS_LOGS_COLLECTION : ACCESS_LOGS_COLLECTION;
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ACCESS' : 'GYM_ACCESS';

  try {
    // Use local date string to avoid timezone shifts
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const logId = `${clientId}_${dateStr}`;
    
    await setDoc(doc(db, accessLogsCollection, logId), {
      clientId,
      enrollmentId,
      accessDate: Timestamp.fromDate(date),
      dateStr,
      loggedBy: currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        email: currentUser.email
      } : null,
    });

    if (currentUser) {
      const { logAction } = await import('./timeline');
      const enrollmentSnap = await getDoc(doc(db, enrollmentsCollection, enrollmentId));
      const clientName = enrollmentSnap.exists() ? enrollmentSnap.data().clientName : clientId;
      
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'ACCESS',
        targetType: targetType,
        targetId: logId,
        targetName: clientName,
        details: `Logged ${isSpa ? 'spa' : 'gym'} access for client ${clientName}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error logging access:', error);
    return { success: false, error: error.message };
  }
}

export async function getAccessLogs(clientId, year, isSpa = false) {
  const accessLogsCollection = isSpa ? SPA_ACCESS_LOGS_COLLECTION : ACCESS_LOGS_COLLECTION;
  try {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    const q = query(
      collection(db, accessLogsCollection),
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
export async function redeemEntitlement(enrollmentId, entitlement, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
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

/**
 * Cancel an enrollment
 */
export async function cancelEnrollment(enrollmentId, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    
    await updateDoc(enrollmentRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelledBy: currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email,
        email: currentUser.email
      } : null,
    });

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'CANCEL',
        targetType: targetType,
        targetId: enrollmentId,
        targetName: data.clientName,
        details: `Cancelled ${isSpa ? 'spa' : 'gym'} membership for ${data.clientName}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error cancelling enrollment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an enrollment
 */
export async function deleteEnrollment(enrollmentId, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    
    await deleteDoc(enrollmentRef);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'DELETE',
        targetType: targetType,
        targetId: enrollmentId,
        targetName: data.clientName,
        details: `Deleted ${isSpa ? 'spa' : 'gym'} membership record for ${data.clientName}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log a treatment and reduce balance
 */
export async function logTreatment(enrollmentId, treatmentData, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    const currentBalance = data.balance || 0;
    const treatmentAmount = parseFloat(treatmentData.amount);
    
    if (currentBalance < treatmentAmount) {
      throw new Error('Insufficient balance');
    }
    
    const newBalance = currentBalance - treatmentAmount;
    const treatments = data.treatments || [];
    
    const newTreatment = {
      ...treatmentData,
      amount: treatmentAmount,
      date: Timestamp.now(),
      loggedBy: currentUser ? {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email
      } : null
    };
    
    await updateDoc(enrollmentRef, {
      balance: newBalance,
      treatments: [...treatments, newTreatment],
      updatedAt: Timestamp.now()
    });
    
    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'TREATMENT',
        targetType: targetType,
        targetId: enrollmentId,
        targetName: data.clientName,
        details: `Logged treatment "${treatmentData.service}" for ${data.clientName}, amount: ${treatmentAmount}, new balance: ${newBalance}`
      });
    }
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error logging treatment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update enrollment documents
 */
export async function updateEnrollmentDocuments(enrollmentId, documents, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    const currentDocs = data.documents || {};
    
    const updatedDocs = {
      ...currentDocs,
      ...documents
    };
    
    await updateDoc(enrollmentRef, {
      documents: updatedDocs,
      updatedAt: Timestamp.now()
    });
    
    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'UPDATE',
        targetType: targetType,
        targetId: enrollmentId,
        targetName: data.clientName,
        details: `Updated documents for ${data.clientName}`
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating enrollment documents:', error);
    return { success: false, error: error.message };
  }
}
