'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange } from '@/lib/auth';
import { syncUser, getUserData } from '@/lib/users';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Initial sync
        const userProfile = await syncUser(firebaseUser);
        setProfile(userProfile);
        
        // Listen for real-time changes to the user profile
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (doc) => {
          if (doc.exists()) {
            const updatedProfile = doc.data();
            setProfile(updatedProfile);
          }
        });
      } else {
        setProfile(null);
        unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

