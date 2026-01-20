import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  where,
  orderBy,
  Timestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';

const USER_ACTIVITY_COLLECTION = 'user_activity';
const USER_SESSIONS_COLLECTION = 'user_sessions';

/**
 * Log user login activity
 */
export async function logUserLogin(userId, userEmail, userName) {
  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();
    
    // Log daily activity
    const activityId = `${userId}_${dateStr}`;
    const activityRef = doc(db, USER_ACTIVITY_COLLECTION, activityId);
    const activitySnap = await getDoc(activityRef);
    
    if (activitySnap.exists()) {
      const data = activitySnap.data();
      const hours = data.hours || {};
      hours[hour] = (hours[hour] || 0) + 1;
      
      await setDoc(activityRef, {
        ...data,
        hours,
        lastActive: Timestamp.now(),
        totalSessions: (data.totalSessions || 0) + 1
      }, { merge: true });
    } else {
      const hours = {};
      hours[hour] = 1;
      
      await setDoc(activityRef, {
        userId,
        userEmail,
        userName,
        date: dateStr,
        dateTimestamp: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
        hours,
        lastActive: Timestamp.now(),
        totalSessions: 1,
        createdAt: Timestamp.now()
      });
    }
    
    // Create session record
    await addDoc(collection(db, USER_SESSIONS_COLLECTION), {
      userId,
      userEmail,
      userName,
      loginTime: Timestamp.now(),
      dateStr,
      hour
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error logging user login:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Log user activity (heartbeat - called periodically while user is active)
 */
export async function logUserActivity(userId, userEmail) {
  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const hour = now.getHours();
    
    const activityId = `${userId}_${dateStr}`;
    const activityRef = doc(db, USER_ACTIVITY_COLLECTION, activityId);
    
    await setDoc(activityRef, {
      userId,
      userEmail,
      date: dateStr,
      dateTimestamp: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
      lastActive: Timestamp.now(),
      lastActiveHour: hour
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error logging user activity:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user activity heatmap data
 * @param {number} days - Number of days to fetch (default: 30)
 */
export async function getUserActivityHeatmap(days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, USER_ACTIVITY_COLLECTION),
      where('dateTimestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('dateTimestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const heatmapData = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const hours = data.hours || {};
      
      if (!heatmapData[date]) {
        heatmapData[date] = {};
      }
      
      // Aggregate hours for the day
      Object.keys(hours).forEach(hour => {
        heatmapData[date][hour] = (heatmapData[date][hour] || 0) + hours[hour];
      });
    });
    
    return heatmapData;
  } catch (error) {
    console.error('Error getting user activity heatmap:', error);
    return {};
  }
}

/**
 * Get user activity summary by user
 */
export async function getUserActivitySummary(days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, USER_ACTIVITY_COLLECTION),
      where('dateTimestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('dateTimestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const userSummary = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      
      if (!userSummary[userId]) {
        userSummary[userId] = {
          userId,
          userEmail: data.userEmail,
          userName: data.userName,
          totalSessions: 0,
          totalDays: 0,
          lastActive: null,
          hours: {}
        };
      }
      
      userSummary[userId].totalSessions += (data.totalSessions || 0);
      userSummary[userId].totalDays += 1;
      
      if (!userSummary[userId].lastActive || data.lastActive?.toDate() > userSummary[userId].lastActive) {
        userSummary[userId].lastActive = data.lastActive?.toDate();
      }
      
      // Merge hours
      Object.keys(data.hours || {}).forEach(hour => {
        userSummary[userId].hours[hour] = (userSummary[userId].hours[hour] || 0) + (data.hours[hour] || 0);
      });
    });
    
    return Object.values(userSummary);
  } catch (error) {
    console.error('Error getting user activity summary:', error);
    return [];
  }
}

/**
 * Get monthly activity statistics
 */
export async function getMonthlyActivityStats() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const q = query(
      collection(db, USER_ACTIVITY_COLLECTION),
      where('dateTimestamp', '>=', Timestamp.fromDate(startOfMonth)),
      orderBy('dateTimestamp', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const dailyStats = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      dailyStats[date] = {
        date,
        totalSessions: (dailyStats[date]?.totalSessions || 0) + (data.totalSessions || 0),
        uniqueUsers: new Set([...(dailyStats[date]?.uniqueUsers || []), data.userId]).size
      };
    });
    
    return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting monthly activity stats:', error);
    return [];
  }
}
