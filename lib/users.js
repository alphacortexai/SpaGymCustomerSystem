import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  getDocs, 
  Timestamp,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';

const USERS_COLLECTION = 'users';
const DEFAULT_ADMIN_EMAIL = 'alphacortexai@gmail.com';

export const ROLES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  GENERAL: 'General',
  PENDING: 'Pending'
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    clients: { view: true, edit: true, delete: true, add: true },
    gym: { view: true, edit: true, delete: true, add: true },
    birthdays: { view: true },
    branches: { view: true, edit: true, delete: true, add: true },
    users: { view: true, edit: true }
  },
  [ROLES.MANAGER]: {
    clients: { view: true, edit: true, delete: false, add: true },
    gym: { view: true, edit: true, delete: false, add: true },
    birthdays: { view: true },
    branches: { view: true, edit: false, delete: false, add: false },
    users: { view: false, edit: false }
  },
  [ROLES.GENERAL]: {
    clients: { view: true, edit: false, delete: false, add: false },
    gym: { view: true, edit: false, delete: false, add: false },
    birthdays: { view: true },
    branches: { view: true, edit: false, delete: false, add: false },
    users: { view: false, edit: false }
  },
  [ROLES.PENDING]: {
    clients: { view: false, edit: false, delete: false, add: false },
    gym: { view: false, edit: false, delete: false, add: false },
    birthdays: { view: false },
    branches: { view: false, edit: false, delete: false, add: false },
    users: { view: false, edit: false }
  }
};

/**
 * Sync user data with Firestore on login
 */
export async function syncUser(firebaseUser) {
  if (!firebaseUser) return null;

  const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New user - check if it's the default admin
    const isDefaultAdmin = firebaseUser.email === DEFAULT_ADMIN_EMAIL;
    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: isDefaultAdmin ? ROLES.ADMIN : ROLES.PENDING,
      status: isDefaultAdmin ? 'approved' : 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(userRef, userData);
    return userData;
  } else {
    // Existing user - return data
    return userSnap.data();
  }
}

/**
 * Get user data by UID
 */
export async function getUserData(uid) {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Get all users (Admin only)
 */
export async function getAllUsers() {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

/**
 * Update user role and status (Admin only)
 */
export async function updateUserRole(uid, role, status = 'approved') {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      role,
      status,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user has required role
 */
export function hasPermission(userRole, requiredRoles) {
  if (!userRole) return false;
  if (userRole === ROLES.ADMIN) return true; // Admin has all permissions
  return requiredRoles.includes(userRole);
}
