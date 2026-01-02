import { 
  collection, 
  query, 
  getDocs, 
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

const JOBS_COLLECTION = 'importJobs';

/**
 * Get recent upload history
 * @param {number} limitCount - Number of recent uploads to fetch (default: 20)
 */
export async function getUploadHistory(limitCount = 20) {
  try {
    const jobsRef = collection(db, JOBS_COLLECTION);
    const q = query(
      jobsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    
    const history = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        id: doc.id,
        jobId: data.jobId,
        fileName: data.fileName,
        status: data.status,
        progress: data.progress || 0,
        total: data.total || 0,
        processed: data.processed || 0,
        success: data.success || 0,
        failed: data.failed || 0,
        skipped: data.skipped || 0,
        message: data.message || '',
        error: data.error || null,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      });
    });
    
    return history;
  } catch (error) {
    console.error('Error getting upload history:', error);
    return [];
  }
}

/**
 * Get upload history for a specific status
 * @param {string} status - Status to filter by ('completed', 'failed', 'processing', etc.)
 * @param {number} limitCount - Number of results to return
 */
export async function getUploadHistoryByStatus(status, limitCount = 20) {
  try {
    const jobsRef = collection(db, JOBS_COLLECTION);
    const q = query(
      jobsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    
    const history = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === status) {
        history.push({
          id: doc.id,
          jobId: data.jobId,
          fileName: data.fileName,
          status: data.status,
          progress: data.progress || 0,
          total: data.total || 0,
          processed: data.processed || 0,
          success: data.success || 0,
          failed: data.failed || 0,
          skipped: data.skipped || 0,
          message: data.message || '',
          error: data.error || null,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        });
      }
    });
    
    return history;
  } catch (error) {
    console.error('Error getting upload history by status:', error);
    return [];
  }
}

