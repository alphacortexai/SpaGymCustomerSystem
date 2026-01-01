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
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

const CLIENTS_COLLECTION = 'clients';

/**
 * Add a new client to Firestore
 */
export async function addClient(clientData) {
  try {
    // Store month and day separately, and also store full date for compatibility
    // Use current year as placeholder for the date
    const dateOfBirth = new Date(clientData.dateOfBirth);
    
    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
      name: clientData.name.trim(),
      phoneNumber: clientData.phoneNumber.trim(),
      dateOfBirth: Timestamp.fromDate(dateOfBirth),
      birthMonth: clientData.birthMonth || dateOfBirth.getMonth() + 1,
      birthDay: clientData.birthDay || dateOfBirth.getDate(),
      branch: clientData.branch?.trim() || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding client:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a client with similar phone number exists (excluding a specific client ID for updates)
 */
export async function checkDuplicatePhone(phoneNumber, branch = null, excludeClientId = null) {
  try {
    let q;
    if (branch) {
      q = query(
        collection(db, CLIENTS_COLLECTION),
        where('phoneNumber', '==', phoneNumber.trim()),
        where('branch', '==', branch.trim())
      );
    } else {
      q = query(
        collection(db, CLIENTS_COLLECTION),
        where('phoneNumber', '==', phoneNumber.trim())
      );
    }
    const querySnapshot = await getDocs(q);
    
    // If excluding a client ID (for updates), check if any found docs are different
    if (excludeClientId) {
      const otherDocs = querySnapshot.docs.filter(doc => doc.id !== excludeClientId);
      return otherDocs.length > 0;
    }
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate phone:', error);
    return false;
  }
}

/**
 * Update a client in Firestore
 */
export async function updateClient(clientId, clientData) {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    
    // Convert date of birth if provided
    let updateData = {
      name: clientData.name.trim(),
      phoneNumber: clientData.phoneNumber.trim(),
      updatedAt: Timestamp.now(),
    };

    if (clientData.birthMonth && clientData.birthDay) {
      const currentYear = new Date().getFullYear();
      const month = parseInt(clientData.birthMonth);
      const day = parseInt(clientData.birthDay);
      const dateOfBirth = new Date(currentYear, month - 1, day);
      
      updateData.dateOfBirth = Timestamp.fromDate(dateOfBirth);
      updateData.birthMonth = month;
      updateData.birthDay = day;
    } else if (clientData.dateOfBirth) {
      const dateOfBirth = new Date(clientData.dateOfBirth);
      updateData.dateOfBirth = Timestamp.fromDate(dateOfBirth);
      updateData.birthMonth = dateOfBirth.getMonth() + 1;
      updateData.birthDay = dateOfBirth.getDate();
    }

    await updateDoc(clientRef, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating client:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a single client by ID
 */
export async function getClientById(clientId) {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (clientSnap.exists()) {
      const data = clientSnap.data();
      return {
        id: clientSnap.id,
        ...data,
        dateOfBirth: data.dateOfBirth?.toDate(),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting client:', error);
    return null;
  }
}

/**
 * Delete a client from Firestore
 */
export async function deleteClient(clientId) {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await deleteDoc(clientRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting client:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search clients by name, phone number, or date of birth
 */
export async function searchClients(searchTerm, branch = null) {
  try {
    let clientsRef;
    if (branch) {
      clientsRef = query(
        collection(db, CLIENTS_COLLECTION),
        where('branch', '==', branch.trim())
      );
    } else {
      clientsRef = collection(db, CLIENTS_COLLECTION);
    }
    
    const allClients = await getDocs(clientsRef);
    
    const searchLower = searchTerm.toLowerCase().trim();
    const results = [];
    
    allClients.forEach((doc) => {
      const data = doc.data();
      const name = data.name?.toLowerCase() || '';
      const phone = data.phoneNumber || '';
      const dob = data.dateOfBirth?.toDate();
      const dobString = dob ? dob.toLocaleDateString() : '';
      
      if (
        name.includes(searchLower) ||
        phone.includes(searchTerm.trim()) ||
        dobString.includes(searchTerm.trim())
      ) {
        results.push({
          id: doc.id,
          ...data,
          dateOfBirth: dob,
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error('Error searching clients:', error);
    return [];
  }
}

/**
 * Get clients with birthdays today
 */
export async function getTodaysBirthdays(branch = null) {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JavaScript months are 0-indexed, our storage is 1-indexed
    const todayDate = today.getDate();
    
    let clientsRef;
    if (branch) {
      clientsRef = query(
        collection(db, CLIENTS_COLLECTION),
        where('branch', '==', branch.trim())
      );
    } else {
      clientsRef = collection(db, CLIENTS_COLLECTION);
    }
    
    const allClients = await getDocs(clientsRef);
    
    const birthdays = [];
    
    allClients.forEach((doc) => {
      const data = doc.data();
      
      // Check using stored birthMonth and birthDay if available
      if (data.birthMonth && data.birthDay) {
        if (data.birthMonth === todayMonth && data.birthDay === todayDate) {
          const dob = data.dateOfBirth?.toDate();
          birthdays.push({
            id: doc.id,
            ...data,
            dateOfBirth: dob,
          });
        }
      } else {
        // Fallback to dateOfBirth if month/day not stored
        const dob = data.dateOfBirth?.toDate();
        if (dob) {
          const dobMonth = dob.getMonth() + 1;
          const dobDate = dob.getDate();
          
          if (dobMonth === todayMonth && dobDate === todayDate) {
            birthdays.push({
              id: doc.id,
              ...data,
              dateOfBirth: dob,
            });
          }
        }
      }
    });
    
    return birthdays;
  } catch (error) {
    console.error('Error getting today\'s birthdays:', error);
    return [];
  }
}

/**
 * Get all clients
 */
export async function getAllClients(branch = null) {
  try {
    let querySnapshot;
    if (branch) {
      // Filter by branch - note: if you need ordering, create a composite index in Firestore
      const q = query(
        collection(db, CLIENTS_COLLECTION),
        where('branch', '==', branch.trim())
      );
      querySnapshot = await getDocs(q);
    } else {
      const q = query(
        collection(db, CLIENTS_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      querySnapshot = await getDocs(q);
    }
    
    const clients = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      clients.push({
        id: doc.id,
        ...data,
        dateOfBirth: data.dateOfBirth?.toDate(),
      });
    });
    
    // Sort by createdAt if filtered by branch (since we can't use orderBy with where)
    if (branch) {
      clients.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime; // Descending order
      });
    }
    
    return clients;
  } catch (error) {
    console.error('Error getting all clients:', error);
    return [];
  }
}

/**
 * Get all unique branches from clients (legacy - use lib/branches.js getAllBranches instead)
 */
export async function getAllBranchesFromClients() {
  try {
    const clientsRef = collection(db, CLIENTS_COLLECTION);
    const allClients = await getDocs(clientsRef);
    
    const branches = new Set();
    allClients.forEach((doc) => {
      const data = doc.data();
      if (data.branch && data.branch.trim()) {
        branches.add(data.branch.trim());
      }
    });
    
    return Array.from(branches).sort();
  } catch (error) {
    console.error('Error getting branches:', error);
    return [];
  }
}

/**
 * Bulk add clients from array
 */
export async function bulkAddClients(clientsArray) {
  try {
    const results = [];
    for (const clientData of clientsArray) {
      const result = await addClient(clientData);
      results.push(result);
    }
    return results;
  } catch (error) {
    console.error('Error bulk adding clients:', error);
    return [];
  }
}

