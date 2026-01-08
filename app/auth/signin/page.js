'use client';

import { signInWithGoogle } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/auth';
import Image from 'next/image';

export default function SignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect if already signed in
    const user = getCurrentUser();
    if (user) {
      router.push('/');
    }
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        router.push('/');
      } else {
        setError(result.error || 'Failed to sign in');
        setLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An error occurred during sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/login_bg.jpg" 
          alt="Background" 
          fill 
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Card: Transparent on mobile, blurred on desktop */}
        <div className="sm:bg-black/20 sm:backdrop-blur-md sm:rounded-3xl sm:shadow-2xl sm:border sm:border-white/10 sm:p-10 text-center">
          <div className="mb-10">
            {/* Dual Logo Icons */}
            <div className="flex justify-center -space-x-4 mb-8">
              <div className="w-16 h-16 rounded-full border-4 border-white/20 bg-white overflow-hidden shadow-2xl rotate-[-6deg] relative z-20">
                <Image src="/logo1.png" alt="Logo 1" fill className="object-contain p-2" />
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-white/20 bg-white overflow-hidden shadow-2xl rotate-[6deg] relative z-10">
                <Image src="/logo2.png" alt="Logo 2" fill className="object-contain p-2" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight leading-tight">
              SSS & PE <br/>
              <span className="text-white/90">Client Mgt System</span>
            </h1>
            <p className="text-lg font-medium text-white/70">
              (Birthdays & Memberships)
            </p>
          </div>
          
          {error && (
            <div className="mb-6 bg-rose-500/20 border border-rose-500/30 text-white px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}
          
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 bg-white hover:bg-slate-50 text-slate-900 border-none rounded-2xl px-6 py-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {loading ? 'Connecting...' : 'Sign in with Google'}
          </button>

          <p className="mt-8 text-sm text-white/60 font-medium">
            Secure Access for Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
