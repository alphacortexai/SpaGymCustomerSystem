import { auth } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      },
    };
  } catch (error) {
    console.error('Error signing in:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
