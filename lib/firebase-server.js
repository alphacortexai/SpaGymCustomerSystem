// Server-side Firebase configuration for API routes
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK if not already initialized
let db;
let adminApp;

if (typeof window === 'undefined') {
  // Server-side only
  try {
    if (getApps().length === 0) {
      // Use service account or application default credentials
      // For now, we'll use environment variables for client SDK
      // In production, use Firebase Admin SDK with service account
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }, 'server');
    } else {
      adminApp = getApps()[0];
    }
    db = getFirestore(adminApp);
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Fallback: we'll use client SDK in API routes
    db = null;
  }
}

// Alternative: Use client SDK for API routes (works but less ideal)
export function getServerFirestore() {
  if (db) return db;
  
  // Fallback to client SDK (works in Next.js API routes)
  const { db: clientDb } = require('./firebase');
  return clientDb;
}

export { db as serverDb, adminApp };



