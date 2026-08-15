'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthChange } from '@/lib/auth';
import { syncUser } from '@/lib/users';
import { logUserLogin, logUserActivity } from '@/lib/userActivity';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AuthContext = createContext({});
const INACTIVE_STATUSES = new Set(['disabled', 'suspended', 'revoked']);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const activityIntervalRef = useRef(null);
  const unsubscribeProfileRef = useRef(() => {});

  useEffect(() => {
    const clearSessionResources = () => {
      unsubscribeProfileRef.current();
      unsubscribeProfileRef.current = () => {};
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };

    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      clearSessionResources();
      setUser(firebaseUser);
      setProfile(null);
      setAuthError('');

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userProfile = await syncUser(firebaseUser);
        if (!userProfile || INACTIVE_STATUSES.has(userProfile.status)) {
          setProfile(userProfile || null);
          setLoading(false);
          return;
        }

        setProfile(userProfile);
        await logUserLogin(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName || firebaseUser.email);

        activityIntervalRef.current = setInterval(() => {
          logUserActivity(firebaseUser.uid, firebaseUser.email);
        }, 5 * 60 * 1000);

        unsubscribeProfileRef.current = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (profileSnapshot) => {
            if (profileSnapshot.exists()) {
              const updatedProfile = profileSnapshot.data();
              setProfile(updatedProfile);
              if (INACTIVE_STATUSES.has(updatedProfile.status)) {
                clearSessionResources();
              }
            }
          },
          (error) => {
            console.error('Profile listener error:', error);
            setAuthError('Your account details could not be refreshed. Please sign in again.');
          },
        );
      } catch (error) {
        console.error('Authentication profile error:', error);
        setProfile(null);
        setAuthError('We could not verify your account. Please sign in again.');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      clearSessionResources();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
