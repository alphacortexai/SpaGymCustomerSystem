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
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizePhoneNumber, normalizePhoneNumberWithAll, arePhoneNumbersEqual, extractAllPhoneNumbers } from './phoneUtils';
import { addUnrecognizedClient } from './unrecognizedClients';

const CLIENTS_COLLECTION = 'clients';

/**
 * Add a new client to Firestore
 */
export async function addClient(clientData, currentUser = null) {
  try {
    // Store month and day separately, and also store full date for compatibility
    // Use current year as placeholder for the date
    let dateOfBirth = null;
    if (clientData.dateOfBirth) {
      dateOfBirth = new Date(clientData.dateOfBirth);
    }
    
    // Normalize phone number - get all valid numbers
    const phoneData = normalizePhoneNumberWithAll(clientData.phoneNumber);
    
    // If there are unrecognized phone numbers, add to unrecognized clients
    if (phoneData.hasUnrecognized && phoneData.invalidPhoneNumbers.length > 0) {
      await addUnrecognizedClient({
        name: clientData.name,
        phoneNumber: clientData.phoneNumber, // Original
        invalidPhoneNumbers: phoneData.invalidPhoneNumbers,
        dateOfBirth: clientData.dateOfBirth,
        birthMonth: clientData.birthMonth || dateOfBirth.getMonth() + 1,
        birthDay: clientData.birthDay || dateOfBirth.getDate(),
        branch: clientData.branch,
        reason: `Unrecognized phone number format: ${phoneData.invalidPhoneNumbers.join(', ')}`,
        source: 'form',
      });
      
      // If no valid numbers, return error
      if (phoneData.validNumbers.length === 0) {
        return { 
          success: false, 
          error: 'No valid phone numbers found. Client data saved to "Unrecognised Uploaded Client Data" for review.',
          unrecognized: true 
        };
      }
    }
    
    // Store all valid phone numbers (comma-separated)
    const phoneNumberStorage = phoneData.storage || '';
    
    if (!phoneNumberStorage) {
      return { 
        success: false, 
        error: 'No valid phone numbers found',
        unrecognized: true 
      };
    }
    
    const clientDoc = {
      name: clientData.name.trim(),
      phoneNumber: phoneNumberStorage, // Store all valid numbers (comma-separated)
      branch: clientData.branch?.trim() || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    if (dateOfBirth) {
      clientDoc.dateOfBirth = Timestamp.fromDate(dateOfBirth);
      clientDoc.birthMonth = clientData.birthMonth || dateOfBirth.getMonth() + 1;
      clientDoc.birthDay = clientData.birthDay || dateOfBirth.getDate();
    } else {
      clientDoc.birthMonth = clientData.birthMonth || null;
      clientDoc.birthDay = clientData.birthDay || null;
    }

    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientDoc);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'ADD',
        targetType: 'CLIENT',
        targetId: docRef.id,
        targetName: clientData.name.trim(),
        details: `Added client ${clientData.name.trim()} to branch ${clientData.branch || 'N/A'}`
      });
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding client:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a client with similar phone number exists (excluding a specific client ID for updates)
 * Handles normalized phone numbers and multiple phone numbers in a single field
 * 
 * If input has multiple numbers (e.g., "0776961331/ 0758583813"), checks if ANY of them
 * exist as duplicates in the database
 */
export async function checkDuplicatePhone(phoneNumber, branch = null, excludeClientId = null) {
  try {
    // Get all normalized phone numbers from input (handles multiple numbers)
    const inputPhoneNumbers = extractAllPhoneNumbers(phoneNumber);
    
    if (inputPhoneNumbers.length === 0) {
      return false;
    }
    
    // Fetch all clients in the branch (or all clients if no branch specified)
    // We need to check manually because we need to compare all numbers
    let allClientsRef;
    if (branch) {
      allClientsRef = query(
        collection(db, CLIENTS_COLLECTION),
        where('branch', '==', branch.trim())
      );
    } else {
      allClientsRef = collection(db, CLIENTS_COLLECTION);
    }
    
    const allClientsSnapshot = await getDocs(allClientsRef);
    
    // Check each input phone number against all stored phone numbers
    for (const inputPhone of inputPhoneNumbers) {
      for (const docSnapshot of allClientsSnapshot.docs) {
        // Skip if this is the client we're excluding (for updates)
        if (excludeClientId && docSnapshot.id === excludeClientId) {
          continue;
        }
        
        const data = docSnapshot.data();
        const storedPhone = data.phoneNumber || '';
        
        // Get all numbers from stored phone (in case it also has multiple numbers)
        const storedPhoneNumbers = extractAllPhoneNumbers(storedPhone);
        
        // Check if this input number matches any stored number
        for (const storedPhoneNum of storedPhoneNumbers) {
          if (inputPhone === storedPhoneNum) {
            return true; // Found a duplicate!
          }
        }
        
        // Also check exact match with stored phone (for backward compatibility)
        if (inputPhone === storedPhone) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking duplicate phone:', error);
    return false;
  }
}

/**
 * Update a client in Firestore
 */
export async function updateClient(clientId, clientData, currentUser = null) {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    
    // Normalize phone number before storing
    const normalizedPhone = normalizePhoneNumber(clientData.phoneNumber);
    
    // Convert date of birth if provided
    let updateData = {
      name: clientData.name.trim(),
      phoneNumber: normalizedPhone, // Store normalized phone number
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
    } else {
      // If birthday is explicitly set to null or empty
      updateData.dateOfBirth = null;
      updateData.birthMonth = null;
      updateData.birthDay = null;
    }

    // Add next of kin if provided
    if (clientData.nextOfKin) {
      updateData.nextOfKin = clientData.nextOfKin;
    }

    await updateDoc(clientRef, updateData);

    // Cascading update: Update client name in all enrollments
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('clientId', '==', clientId)
    );
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    const updatePromises = enrollmentsSnapshot.docs.map(enrollmentDoc => 
      updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
        clientName: clientData.name.trim()
      })
    );
    await Promise.all(updatePromises);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'EDIT',
        targetType: 'CLIENT',
        targetId: clientId,
        targetName: clientData.name.trim(),
        details: `Updated client ${clientData.name.trim()}`
      });
    }

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
export async function deleteClient(clientId, currentUser = null) {
  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    
    let clientName = 'Unknown';
    const clientSnap = await getDoc(clientRef);
    if (clientSnap.exists()) {
      clientName = clientSnap.data().name;
    }

    // Instead of hard delete, we could mark as deleted or just delete the client
    // and update enrollments to indicate the client was deleted.
    await deleteDoc(clientRef);

    // Update all enrollments for this client to indicate they are deleted
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('clientId', '==', clientId)
    );
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    const updatePromises = enrollmentsSnapshot.docs.map(enrollmentDoc => {
      const enrollmentData = enrollmentDoc.data();
      const currentName = enrollmentData.clientName || clientName;
      const newName = currentName.includes('(Deleted Client)') ? currentName : `${currentName} (Deleted Client)`;
      
      return updateDoc(doc(db, 'enrollments', enrollmentDoc.id), {
        clientName: newName,
        clientDeleted: true
      });
    });
    await Promise.all(updatePromises);

    if (currentUser) {
      const { logAction } = await import('./timeline');
      await logAction({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'DELETE',
        targetType: 'CLIENT',
        targetId: clientId,
        targetName: clientName,
        details: `Deleted client ${clientName}`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting client:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search clients by name or phone number
 * Optimized to use Firestore queries where possible and limit results
 */
export async function searchClients(searchTerm, branch = null) {
  try {
    const searchTrimmed = searchTerm.trim();
    if (!searchTrimmed) return [];

    const results = new Map(); // Use Map to avoid duplicates by ID
    
    // 1. Try exact phone match if it looks like a phone number
    const normalizedSearchPhone = normalizePhoneNumber(searchTrimmed);
    if (normalizedSearchPhone) {
      let phoneQuery;
      if (branch) {
        phoneQuery = query(
          collection(db, CLIENTS_COLLECTION),
          where('branch', '==', branch.trim()),
          where('phoneNumber', '==', normalizedSearchPhone),
          limit(10)
        );
      } else {
        phoneQuery = query(
          collection(db, CLIENTS_COLLECTION),
          where('phoneNumber', '==', normalizedSearchPhone),
          limit(10)
        );
      }
      const phoneSnap = await getDocs(phoneQuery);
      phoneSnap.forEach(doc => results.set(doc.id, { id: doc.id, ...doc.data(), dateOfBirth: doc.data().dateOfBirth?.toDate() }));
    }

    // 2. Try name prefix match (case-sensitive in Firestore, so we search as-is)
    // For better search, we'd need a search index or lowercase name field
    let nameQuery;
    const endCode = searchTrimmed + '\uf8ff';
    if (branch) {
      nameQuery = query(
        collection(db, CLIENTS_COLLECTION),
        where('branch', '==', branch.trim()),
        where('name', '>=', searchTrimmed),
        where('name', '<=', endCode)
      );
    } else {
      nameQuery = query(
        collection(db, CLIENTS_COLLECTION),
        where('name', '>=', searchTrimmed),
        where('name', '<=', endCode)
      );
    }
    const nameSnap = await getDocs(nameQuery);
    nameSnap.forEach(doc => results.set(doc.id, { id: doc.id, ...doc.data(), dateOfBirth: doc.data().dateOfBirth?.toDate() }));

    // 3. Fallback: If we have few results, do a small-scale client-side filter on recent clients
    if (results.size < 5) {
      let fallbackQuery;
      if (branch) {
        fallbackQuery = query(
          collection(db, CLIENTS_COLLECTION),
          where('branch', '==', branch.trim()),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
      } else {
        fallbackQuery = query(
          collection(db, CLIENTS_COLLECTION),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
      }
      
      const fallbackSnap = await getDocs(fallbackQuery);
      const searchLower = searchTrimmed.toLowerCase();
      
      fallbackSnap.forEach(doc => {
        if (results.has(doc.id)) return;
        const data = doc.data();
        const name = data.name?.toLowerCase() || '';
        const phone = data.phoneNumber || '';
        
        if (name.includes(searchLower) || phone.includes(searchTrimmed)) {
          results.set(doc.id, { id: doc.id, ...data, dateOfBirth: data.dateOfBirth?.toDate() });
        }
      });
    }
    
    return Array.from(results.values());
  } catch (error) {
    console.error('Error searching clients:', error);
    // If complex query fails due to missing index, fallback to simple collection fetch
    try {
      const simpleSnap = await getDocs(query(collection(db, CLIENTS_COLLECTION), limit(50)));
      const searchLower = searchTerm.toLowerCase().trim();
      const fallbackResults = [];
      simpleSnap.forEach(doc => {
        const data = doc.data();
        if (data.name?.toLowerCase().includes(searchLower) || data.phoneNumber?.includes(searchLower)) {
          fallbackResults.push({ id: doc.id, ...data, dateOfBirth: data.dateOfBirth?.toDate() });
        }
      });
      return fallbackResults;
    } catch (innerError) {
      return [];
    }
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
 * @param {Array} clientsArray - Array of client data objects
 * @param {Function} progressCallback - Optional callback function(current, total) for progress tracking
 */
export async function bulkAddClients(clientsArray, progressCallback = null) {
  try {
    const results = [];
    const total = clientsArray.length;
    
    for (let i = 0; i < clientsArray.length; i++) {
      const clientData = clientsArray[i];
      const result = await addClient(clientData);
      results.push(result);
      
      // Call progress callback if provided
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback(i + 1, total);
      }
    }
    return results;
  } catch (error) {
    console.error('Error bulk adding clients:', error);
    return [];
  }
}

