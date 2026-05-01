import { useEffect } from 'react';
import { pythonAPI } from '@/lib/api';

export const useAIPing = (stage, onOnline, endpoint = 'verifyFace') => {
  useEffect(() => {
    let pingInterval;
    if (stage === 'offline') {
      pingInterval = setInterval(async () => {
        try {
          if (endpoint === 'registerFace') {
            await pythonAPI.registerFace(new FormData());
          } else {
            await pythonAPI.verifyFace(new FormData());
          }
          onOnline();
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Service is back online! 🟢" }));
          }
        } catch (e) {
          const errorMessage = e.message || '';
          if (!errorMessage.includes('Failed to fetch') && !errorMessage.includes('NetworkError') && !errorMessage.includes('Load failed') && !errorMessage.includes('aborted')) {
            onOnline();
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Service is back online! 🟢" }));
            }
          }
        }
      }, 5000);
    }
    return () => clearInterval(pingInterval);
  }, [stage, onOnline, endpoint]);
};