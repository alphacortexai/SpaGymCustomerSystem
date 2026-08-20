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
  setDoc,
  getCountFromServer,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';

const MEMBERSHIP_TYPES_COLLECTION = 'membership_types';
const ENROLLMENTS_COLLECTION = 'enrollments';
const ACCESS_LOGS_COLLECTION = 'access_logs';

const SPA_MEMBERSHIP_TYPES_COLLECTION = 'spa_membership_types';
const SPA_ENROLLMENTS_COLLECTION = 'spa_enrollments';
const SPA_ACCESS_LOGS_COLLECTION = 'spa_access_logs';

function toTransferDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Membership Types CRUD
 */
export async function addMembershipType(data, currentUser = null, isSpa = false) {
  const collectionName = isSpa ? SPA_MEMBERSHIP_TYPES_COLLECTION : MEMBERSHIP_TYPES_COLLECTION;
  const targetType = isSpa ? 'SPA_MEMBERSHIP_TYPE' : 'GYM_MEMBERSHIP_TYPE';
  const detailsPrefix = isSpa ? 'Added spa membership type' : 'Added gym membership type';

  try {
    const normalizedPrice = Number(data.price);
    const normalizedDuration = Number(data.duration);
    if (!data.type?.trim()) throw new Error('Membership type name is required.');
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) throw new Error('Membership price must be a valid non-negative number.');
    if (!Number.isInteger(normalizedDuration) || normalizedDuration < 1) throw new Error('Membership duration must be at least 1 day.');

    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      type: data.type.trim(),
      price: normalizedPrice,
      duration: normalizedDuration,
      currency: data.currency || 'USD',
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
    // Do not order this query in Firestore. An orderBy on createdAt excludes
    // older records that were created before timestamps were added, which made
    // those membership types disappear from invoices and enrollment forms.
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs
      .map((membershipDoc) => ({ id: membershipDoc.id, ...membershipDoc.data() }))
      .sort((a, b) => {
        const toMillis = (value) => {
          if (!value) return 0;
          if (typeof value.toMillis === 'function') return value.toMillis();
          if (value instanceof Date) return value.getTime();
          const parsed = new Date(value).getTime();
          return Number.isFinite(parsed) ? parsed : 0;
        };
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      });
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

    const normalizedPrice = Number(data.price);
    const normalizedDuration = Number(data.duration);
    if (!data.type?.trim()) throw new Error('Membership type name is required.');
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) throw new Error('Membership price must be a valid non-negative number.');
    if (!Number.isInteger(normalizedDuration) || normalizedDuration < 1) throw new Error('Membership duration must be at least 1 day.');

    await updateDoc(docRef, {
      ...data,
      type: data.type.trim(),
      price: normalizedPrice,
      duration: normalizedDuration,
      currency: data.currency || 'USD',
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
        currency: data.currency || 'USD',
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
    const parsedDurationDays = Number(durationDays);
    const start = new Date(startDate);

    if (!clientId || !membershipTypeId) {
      return { success: false, error: 'Client and membership type are required.' };
    }
    if (!Number.isInteger(parsedDurationDays) || parsedDurationDays < 1) {
      return { success: false, error: 'Membership duration must be at least 1 day.' };
    }
    if (Number.isNaN(start.getTime())) {
      return { success: false, error: 'A valid membership start date is required.' };
    }

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

    const expiry = new Date(start);
    expiry.setDate(start.getDate() + parsedDurationDays);

    const finalPrice = Number(enrollmentData.isReducingBalance ? enrollmentData.price : enrollmentData.price);
    if (!Number.isFinite(finalPrice) || finalPrice < 0) {
      return { success: false, error: 'Membership price or balance must be a valid non-negative number.' };
    }

    const docRef = await addDoc(collection(db, enrollmentsCollection), {
      ...enrollmentData,
      currency: enrollmentData.currency || 'USD',
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
 * Move an active gym membership into spa without changing its stored details.
 * The source record is retained as history and marked as transferred while
 * the cloned spa record links back to the original enrollment.
 */
export async function transferGymEnrollmentToSpa(
  gymEnrollmentId,
  currentUser = null,
) {
  try {
    if (!gymEnrollmentId) {
      return { success: false, error: 'Gym membership is required.' };
    }

    const gymEnrollmentRef = doc(db, ENROLLMENTS_COLLECTION, gymEnrollmentId);
    const initialGymSnapshot = await getDoc(gymEnrollmentRef);
    if (!initialGymSnapshot.exists()) {
      return { success: false, error: 'Gym membership not found.' };
    }

    const initialSource = initialGymSnapshot.data();
    if (!initialSource || typeof initialSource !== 'object') {
      return { success: false, error: 'The gym membership record is invalid.' };
    }
    if (!initialSource.clientId) {
      return { success: false, error: 'This membership cannot be transferred because it has no client ID.' };
    }

    const activeSpaQuery = query(
      collection(db, SPA_ENROLLMENTS_COLLECTION),
      where('clientId', '==', initialSource.clientId),
      where('status', '==', 'active'),
    );
    const activeSpaSnapshot = await getDocs(activeSpaQuery);
    const hasActiveSpaMembership = Boolean(activeSpaSnapshot?.docs?.some((spaDoc) => {
      const spaData = spaDoc.data();
      const spaExpiry = toTransferDate(spaData?.expiryDate);
      return spaData?.status === 'active' && spaExpiry && spaExpiry > new Date();
    }));
    if (hasActiveSpaMembership) {
      return { success: false, error: 'Client already has an active spa membership. Cancel it before transferring this membership.' };
    }

    let createdSpaEnrollmentId = null;
    let sourceClientName = '';

    await runTransaction(db, async (transaction) => {
      const gymSnapshot = await transaction.get(gymEnrollmentRef);
      if (!gymSnapshot.exists()) throw new Error('Gym membership not found.');

      const source = gymSnapshot.data();
      if (!source || typeof source !== 'object' || !source.clientId) {
        throw new Error('The gym membership record is missing required client information.');
      }
      const sourceExpiry = toTransferDate(source.expiryDate);
      if (source.status !== 'active' || !sourceExpiry || sourceExpiry <= new Date()) {
        throw new Error('Only active, non-expired gym memberships can be transferred.');
      }
      if (source.clientId !== initialSource.clientId) {
        throw new Error('The membership changed while the transfer was being prepared. Please try again.');
      }

      const spaEnrollmentRef = doc(collection(db, SPA_ENROLLMENTS_COLLECTION));
      createdSpaEnrollmentId = spaEnrollmentRef.id;
      sourceClientName = source.clientName || source.clientId;
      const transferredAt = Timestamp.now();

      // Clone the source enrollment as-is. Only transfer metadata and the
      // destination collection-specific status are changed.
      transaction.set(spaEnrollmentRef, {
        ...source,
        status: 'active',
        transferredFromEnrollmentId: gymEnrollmentId,
        transferSource: 'gym',
        transferredAt,
        createdAt: source.createdAt || transferredAt,
        enrolledBy: source.enrolledBy || (currentUser?.uid ? {
          uid: currentUser.uid,
          name: currentUser.displayName || currentUser.email || 'System',
          email: currentUser.email || '',
        } : null),
      });

      transaction.update(gymEnrollmentRef, {
        status: 'transferred',
        transferredAt,
        transferredToEnrollmentId: createdSpaEnrollmentId,
        transferredTo: 'spa',
        updatedAt: transferredAt,
      });
    });

    if (currentUser?.uid) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'System',
        userEmail: currentUser.email || '',
        action: 'TRANSFER',
        targetType: 'GYM_TO_SPA_TRANSFER',
        targetId: createdSpaEnrollmentId,
        targetName: sourceClientName,
        details: `Transferred ${sourceClientName}'s existing gym membership record to spa without changing its details`,
      });
    }

    return { success: true, id: createdSpaEnrollmentId };
  } catch (error) {
    console.error('Error transferring gym membership to spa:', error);
    return { success: false, error: error.message || 'Unable to transfer the membership.' };
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
 * Delete an enrollment and, when it is part of a Gym-to-Spa transfer,
 * delete the linked enrollment in the other service collection atomically.
 */
export async function deleteEnrollment(enrollmentId, currentUser = null, isSpa = false) {
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const linkedCollection = isSpa ? ENROLLMENTS_COLLECTION : SPA_ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    let deletedLinkedEnrollmentId = null;
    let deletedClientName = '';

    await runTransaction(db, async (transaction) => {
      const enrollmentSnap = await transaction.get(enrollmentRef);
      if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');

      const data = enrollmentSnap.data() || {};
      const linkedEnrollmentId = isSpa
        ? data.transferredFromEnrollmentId
        : data.transferredToEnrollmentId;
      const linkedRef = linkedEnrollmentId
        ? doc(db, linkedCollection, linkedEnrollmentId)
        : null;
      const linkedSnap = linkedRef ? await transaction.get(linkedRef) : null;

      transaction.delete(enrollmentRef);
      if (linkedRef && linkedSnap?.exists()) {
        transaction.delete(linkedRef);
        deletedLinkedEnrollmentId = linkedEnrollmentId;
      }
      deletedClientName = data.clientName || data.clientId || 'Unknown client';
    });

    if (currentUser?.uid) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'System',
        userEmail: currentUser.email || '',
        action: 'DELETE',
        targetType: deletedLinkedEnrollmentId ? 'GYM_TO_SPA_TRANSFER' : targetType,
        targetId: enrollmentId,
        targetName: deletedClientName,
        details: deletedLinkedEnrollmentId
          ? `Deleted ${deletedClientName}'s linked gym and spa membership records`
          : `Deleted ${isSpa ? 'spa' : 'gym'} membership record for ${deletedClientName}`,
      });
    }

    return { success: true, deletedLinkedEnrollmentId };
  } catch (error) {
    console.error('Error deleting enrollment:', error);
    return { success: false, error: error?.message || 'Unable to delete the membership record.' };
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

/**
 * Update an enrollment (Admin only)
 */
export async function updateEnrollment(enrollmentId, updateData, currentUser = null, isSpa = false) {
  const SPA_ENROLLMENTS_COLLECTION = 'spa_enrollments';
  const ENROLLMENTS_COLLECTION = 'enrollments';
  const enrollmentsCollection = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  const targetType = isSpa ? 'SPA_ENROLLMENT' : 'GYM_ENROLLMENT';

  try {
    const enrollmentRef = doc(db, enrollmentsCollection, enrollmentId);
    const enrollmentSnap = await getDoc(enrollmentRef);
    
    if (!enrollmentSnap.exists()) throw new Error('Enrollment not found');
    
    const data = enrollmentSnap.data();
    
    // Prepare updates
    const updates = {
      ...updateData,
      updatedAt: Timestamp.now()
    };

    // Handle date conversions if present
    if (updateData.startDate) updates.startDate = Timestamp.fromDate(new Date(updateData.startDate));
    if (updateData.expiryDate) updates.expiryDate = Timestamp.fromDate(new Date(updateData.expiryDate));
    if (updateData.price) updates.price = parseFloat(updateData.price);
    if (updateData.balance) updates.balance = parseFloat(updateData.balance);

    await updateDoc(enrollmentRef, updates);

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
        details: `Updated ${isSpa ? 'spa' : 'gym'} membership details for ${data.clientName}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating enrollment:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Get active enrollment count without downloading every enrollment document.
 */
export async function getActiveEnrollmentCount(isSpa = false) {
  const collectionName = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeEnrollmentsQuery = query(
      collection(db, collectionName),
      where('status', '==', 'active'),
      where('expiryDate', '>=', Timestamp.fromDate(today))
    );
    const snapshot = await getCountFromServer(activeEnrollmentsQuery);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error getting active enrollment count:', error);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeOnlyQuery = query(
        collection(db, collectionName),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(activeOnlyQuery);
      return snapshot.docs.filter((doc) => {
        const expiryDate = doc.data().expiryDate?.toDate();
        return expiryDate && expiryDate >= today;
      }).length;
    } catch (fallbackError) {
      console.error('Error getting fallback active enrollment count:', fallbackError);
      return 0;
    }
  }
}

/**
 * Get all enrollments
 */
export async function getAllEnrollments(isSpa = false) {
  const ENROLLMENTS_COLLECTION = 'enrollments';
  const SPA_ENROLLMENTS_COLLECTION = 'spa_enrollments';
  const collectionName = isSpa ? SPA_ENROLLMENTS_COLLECTION : ENROLLMENTS_COLLECTION;
  try {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      startDate: doc.data().startDate?.toDate(),
      expiryDate: doc.data().expiryDate?.toDate()
    }));
  } catch (error) {
    console.error('Error getting all enrollments:', error);
    return [];
  }
}
