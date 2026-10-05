import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

const BRANCHES_COLLECTION = 'branches';
const BRANCH_CACHE_TTL_MS = 5 * 60 * 1000;
let branchCache = null;
let branchCacheExpiresAt = 0;
let branchRequest = null;

/**
 * Add a new branch to Firestore
 */
export async function addBranch(branchName, currentUser = null) {
  try {
    // Check if branch already exists
    const existing = await getBranchByName(branchName);
    if (existing) {
      return { success: false, error: 'Branch already exists' };
    }

    const docRef = await addDoc(collection(db, BRANCHES_COLLECTION), {
      name: branchName.trim(),
      createdAt: Timestamp.now(),
    });
    branchCache = null;
    branchCacheExpiresAt = 0;

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'ADD',
        targetType: 'BRANCH',
        targetId: docRef.id,
        targetName: branchName.trim(),
        details: `Added branch ${branchName.trim()}`
      });
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding branch:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get branch by name
 */
export async function getBranchByName(branchName) {
  try {
    const q = query(
      collection(db, BRANCHES_COLLECTION),
      where('name', '==', branchName.trim())
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting branch:', error);
    return null;
  }
}

/**
 * Get all branches
 */
export async function getAllBranches(force = false) {
  if (!force && branchCache && branchCacheExpiresAt > Date.now()) return branchCache;
  if (!force && branchRequest) return branchRequest;
  branchRequest = (async () => {
   try {
    const branchesRef = collection(db, BRANCHES_COLLECTION);
    const querySnapshot = await getDocs(branchesRef);
    
    const branches = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      branches.push({
        id: doc.id,
        name: data.name,
      });
    });
    
    // Sort alphabetically
    branches.sort((a, b) => a.name.localeCompare(b.name));
    
    branchCache = branches;
    branchCacheExpiresAt = Date.now() + BRANCH_CACHE_TTL_MS;
    return branches;
  } catch (error) {
    console.error('Error getting branches:', error);
    return [];
  }
  })().finally(() => { branchRequest = null; });
  return branchRequest;
}

/**
 * Check if a branch exists
 */
export async function branchExists(branchName) {
  const branch = await getBranchByName(branchName);
  return branch !== null;
}





