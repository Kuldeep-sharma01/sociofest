import { useState, useEffect } from 'react';
import { wifiService } from '@/services';

export function useWiFiDetection(token) {
  const [wifiStatus, setWifiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkWiFi = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!token) {
          setLoading(false);
          return;
        }

        const data = await wifiService.verify();
        setWifiStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'WiFi verification failed');
        // Set a default unverified status
        setWifiStatus({
          verified: false,
          clientIP: 'unknown',
          schoolName: null,
          message: 'Unable to verify WiFi connection',
        });
      } finally {
        setLoading(false);
      }
    };

    checkWiFi();

    // Check WiFi status every 5 minutes
    const interval = setInterval(checkWiFi, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  return { wifiStatus, loading, error };
}

// Browser-based WiFi detection using NetworkInformation API
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Check online status
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection type using NetworkInformation API
    const connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (connection) {
      setConnectionType(connection.type || connection.effectiveType);

      const handleChange = () => {
        setConnectionType(connection.type || connection.effectiveType);
      };

      connection.addEventListener('change', handleChange);

      return () => {
        connection.removeEventListener('change', handleChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}
