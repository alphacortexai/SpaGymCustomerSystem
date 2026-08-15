import { auth } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onIdTokenChanged
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();

const AUTH_ERROR_MESSAGES = {
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Another sign-in request is already in progress.',
  'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
  'auth/network-request-failed': 'A network error interrupted sign-in. Check your connection and try again.',
};

export function getAuthErrorMessage(error) {
  if (!error) return 'Authentication failed. Please try again.';
  return AUTH_ERROR_MESSAGES[error.code] || 'Authentication failed. Please try again.';
}

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
    // Handle popup closed by user - this is not a real error, just user cancellation
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return {
        success: false,
        error: null,
        cancelled: true,
      };
    }
    
    console.error('Error signing in:', error);
    return {
      success: false,
        error: getAuthErrorMessage(error),
    };
  }
}

export async function signOut() {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: getAuthErrorMessage(error) };
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback) {
  return onIdTokenChanged(auth, callback);
}
