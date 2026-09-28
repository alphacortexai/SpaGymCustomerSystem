// Server-side Firebase configuration for API routes.
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp;
let db;

function getAdminApp() {
  if (adminApp) return adminApp;
  adminApp = getApps().find((app) => app.name === 'server');
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : applicationDefault();
  adminApp = initializeApp({ projectId, credential }, 'server');
  return adminApp;
}

export function getServerFirestore() {
  if (!db) db = getFirestore(getAdminApp());
  return db;
}

export function getServerAuth() {
  return getAuth(getAdminApp());
}

export async function authorizeSpaGymClientRequest(request, action = 'view') {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401 };
  try {
    const decoded = await getServerAuth().verifyIdToken(token);
    const profileSnapshot = await getServerFirestore().collection('users').doc(decoded.uid).get();
    const profile = profileSnapshot.data();
    if (!profile || profile.status !== 'approved') return { ok: false, status: 403 };
    const allowed = profile.role === 'Admin' || profile.permissions?.clients?.[action] === true;
    return allowed ? { ok: true, uid: decoded.uid, profile } : { ok: false, status: 403 };
  } catch (error) {
    console.warn('SpaGym API rejected an invalid Firebase ID token:', error?.code || error?.message);
    return { ok: false, status: 401 };
  }
}

export { db as serverDb, adminApp };

