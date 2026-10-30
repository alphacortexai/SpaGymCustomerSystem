'use client';

import { signInWithGoogle } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function SignIn() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already signed in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [router, user, authLoading]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        // Auth state will update via AuthContext, which will trigger redirect
        // Wait a moment for auth state to propagate
        setTimeout(() => {
          router.push('/');
        }, 100);
      } else {
        // Only show error if it's not a user cancellation
        if (result.error && !result.cancelled) {
          setError(result.error);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An error occurred during sign in');
      setLoading(false);
    }
  };

  // Show loading while auth state is being checked
  if (authLoading) {
    return (
      <div className="signin-screen">
        <div className="absolute inset-0 z-0">
          <Image src="/login_bg.webp" alt="" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/45" />
        </div>
        <div className="signin-card relative z-10" role="status" aria-live="polite">
          <div className="mx-auto flex w-fit items-center gap-1.5" aria-hidden="true">
            <span className="loading-orb loading-orb-blue" />
            <span className="loading-orb loading-orb-pink" />
            <span className="loading-orb loading-orb-purple" />
          </div>
          <p className="signin-purpose">Checking your session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="signin-screen">
      <div className="absolute inset-0 z-0">
        <Image src="/login_bg.webp" alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/45" />
      </div>

      <div className="signin-card relative z-10">
        <div className="mb-6 flex justify-center -space-x-3">
          <div className="relative z-20 h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
            <Image src="/logo1.png" alt="" fill className="object-contain p-2" />
          </div>
          <div className="relative z-10 h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-white shadow-md">
            <Image src="/logo2.png" alt="" fill className="object-contain p-2" />
          </div>
        </div>

        <p className="signin-kicker">SSS & PE</p>
        <h1>Client management</h1>
        <p className="signin-purpose">Birthdays, memberships, and the daily work of the front desk.</p>

        {error && <div className="signin-error" role="alert">{error}</div>}

        <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="signin-google">
          {loading ? (
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          {loading ? 'Connecting…' : 'Sign in with Google'}
        </button>

        <p className="signin-note">Your work Google account is used only to confirm who you are.</p>
      </div>
    </div>
  );
}
