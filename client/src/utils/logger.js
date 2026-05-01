import { useCallback } from 'react';

const useLogger = () => {
  const logError = useCallback((message, error) => {
    console.error(`[CLIENT ERROR] ${message}`, error);
    // TODO: Integrate Sentry
    window.dispatchEvent(new CustomEvent('showToast', { 
      detail: `${message} ❌` 
    }));
  }, []);

  const logWarn = useCallback((message, data) => {
    console.warn(`[CLIENT WARN] ${message}`, data);
  }, []);

  return { logError, logWarn };
};

export default useLogger;
