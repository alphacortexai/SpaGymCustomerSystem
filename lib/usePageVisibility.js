'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to track whether the current page is visible.
 * Useful for pausing/resuming background operations like polling intervals
 * and firebase listeners when the user switches tabs or minimizes the window.
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState !== 'hidden');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

export default usePageVisibility;
