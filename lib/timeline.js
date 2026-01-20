import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  orderBy,
  limit,
  where,
  Timestamp,
  doc,
  deleteDoc,
  startAfter
} from 'firebase/firestore';
import { db } from './firebase';

const TIMELINE_COLLECTION = 'timeline';

/**
 * Log an action to the timeline
 * @param {Object} actionData - { userId, userName, userEmail, action, targetType, targetId, targetName, details }
 */
export async function logAction(actionData) {
  try {
    await addDoc(collection(db, TIMELINE_COLLECTION), {
      ...actionData,
      timestamp: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get date range for time period filter
 * @param {string} period - 'week', 'month', or 'year'
 * @returns {Object} { startDate, endDate }
 */
function getDateRange(period) {
  const now = new Date();
  const startDate = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      // All time - no date filter
      return { startDate: null, endDate: null };
  }

  return { startDate, endDate };
}

/**
 * Get recent actions from the timeline with filters and pagination
 * @param {Object} options - Filter and pagination options
 * @param {number} options.maxResults - Maximum number of results to return per page (default: 25)
 * @param {string} options.period - Time period filter: 'week', 'month', 'year', or null for all time
 * @param {string} options.userEmail - Filter by user email (optional)
 * @param {Date} options.lastTimestamp - Last timestamp for pagination (optional)
 * @returns {Object} { timeline: Array, hasMore: boolean, lastTimestamp: Date }
 */
export async function getTimeline(options = {}) {
  const {
    maxResults = 25,
    period = null,
    userEmail = null,
    lastTimestamp = null
  } = options;

  try {
    const constraints = [];
    const collectionRef = collection(db, TIMELINE_COLLECTION);

    // Apply date range filter if period is specified
    if (period) {
      const { startDate, endDate } = getDateRange(period);
      if (startDate && endDate) {
        constraints.push(where('timestamp', '>=', Timestamp.fromDate(startDate)));
        constraints.push(where('timestamp', '<=', Timestamp.fromDate(endDate)));
      }
    }

    // Apply user email filter if specified
    if (userEmail) {
      constraints.push(where('userEmail', '==', userEmail));
    }

    // Order by timestamp descending
    constraints.push(orderBy('timestamp', 'desc'));

    // Apply pagination if lastTimestamp is provided
    if (lastTimestamp) {
      constraints.push(startAfter(Timestamp.fromDate(lastTimestamp)));
    }

    // Limit results
    constraints.push(limit(maxResults + 1)); // Fetch one extra to check if there are more

    // Build query with all constraints
    const q = query(collectionRef, ...constraints);

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > maxResults;
    
    // Remove the extra doc if we fetched more than maxResults
    const timelineDocs = hasMore ? docs.slice(0, maxResults) : docs;
    
    const timeline = timelineDocs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    // Get last timestamp for next page
    const lastDoc = timelineDocs[timelineDocs.length - 1];
    const nextLastTimestamp = lastDoc ? lastDoc.data().timestamp?.toDate() : null;

    return {
      timeline,
      hasMore,
      lastTimestamp: nextLastTimestamp
    };
  } catch (error) {
    console.error('Error getting timeline:', error);
    return {
      timeline: [],
      hasMore: false,
      lastTimestamp: null
    };
  }
}

/**
 * Get all unique user emails from timeline (for filter dropdown)
 * @returns {Array<string>} Array of unique user emails
 */
export async function getTimelineUserEmails() {
  try {
    const q = query(
      collection(db, TIMELINE_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(1000) // Get recent 1000 entries to extract unique emails
    );
    const snapshot = await getDocs(q);
    const emails = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userEmail) {
        emails.add(data.userEmail);
      }
    });
    
    return Array.from(emails).sort();
  } catch (error) {
    console.error('Error getting timeline user emails:', error);
    return [];
  }
}

/**
 * Delete a timeline entry (Admin only)
 * @param {string} entryId - ID of the timeline entry to delete
 */
export async function deleteTimelineEntry(entryId) {
  try {
    const entryRef = doc(db, TIMELINE_COLLECTION, entryId);
    await deleteDoc(entryRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting timeline entry:', error);
    return { success: false, error: error.message };
  }
}
