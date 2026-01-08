import { useEffect, useCallback } from 'react';

export function useBackButton(onBack, isHome) {
  useEffect(() => {
    // Push a state to the history so we can intercept the back button
    window.history.pushState({ page: 'current' }, '');

    const handlePopState = (event) => {
      // When back button is pressed, the state is popped
      // We prevent the default behavior and call our custom handler
      if (onBack) {
        onBack();
      }
      
      // Push the state back so the next back button press can also be intercepted
      window.history.pushState({ page: 'current' }, '');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack, isHome]);
}
