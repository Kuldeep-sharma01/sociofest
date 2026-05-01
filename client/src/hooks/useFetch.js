/**
 * useFetch - Custom hook for safe data fetching with AbortController
 * Handles: loading states, error handling, cleanup on unmount, retry logic
 * 
 * Usage:
 * const { data, loading, error } = useFetch(async () => {
 *   const res = await apiClient.get('/api/endpoint');
 *   return res.data;
 * }, [dependencies]);
 */

import { useEffect, useState, useRef } from 'react';

/**
 * Custom hook for fetching data with proper error handling and cleanup
 * 
 * @param {Function} fetchFn - Async function that fetches data
 * @param {Array} dependencies - Dependencies array (like useEffect)
 * @param {Object} options - Configuration options
 * @param {boolean} options.skip - Skip fetching if true
 * @param {number} options.retries - Number of retries on failure (default: 0)
 * @returns {Object} { data, loading, error, refetch }
 */
export const useFetch = (fetchFn, dependencies = [], options = {}) => {
  const { skip = false, retries = 0 } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const retryCountRef = useRef(0);

  /**
   * Helper function to get detailed error message
   */
  const getErrorMessage = (err) => {
    // Ignore abort errors (component unmounted)
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      return null;
    }
    
    // Try to extract message from API response (Phase 2 format)
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    
    // Try legacy error format
    if (err.response?.data?.error) {
      return err.response.data.error;
    }
    
    // Timeout error
    if (err.code === 'ECONNABORTED') {
      return 'Request timeout. Please check your connection and try again.';
    }
    
    // Network error
    if (err.message === 'Network Error' || !err.response) {
      return 'Network error. Please check your internet connection.';
    }
    
    // Status message
    if (err.response?.statusText) {
      return err.response.statusText;
    }
    
    // Fallback
    return err.message || 'An error occurred. Please try again.';
  };

  /**
   * Main fetch function
   */
  const performFetch = async (retryAttempt = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();
      
      // Call the fetch function with abort signal
      const result = await fetchFn(abortControllerRef.current.signal);
      
      // Only update state if component is still mounted
      setData(result);
      retryCountRef.current = 0;
    } catch (err) {
      // Ignore errors if request was cancelled (component unmounted)
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      
      // Retry on transient failures
      if (retryAttempt < retries) {
        const delayMs = Math.pow(2, retryAttempt) * 1000; // Exponential backoff
        setTimeout(() => performFetch(retryAttempt + 1), delayMs);
        return;
      }
      
      const errorMsg = getErrorMessage(err);
      if (errorMsg) {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Effect: Fetch data on mount and dependency changes
   */
  useEffect(() => {
    if (skip) {
      setData(null);
      setLoading(false);
      return;
    }
    
    retryCountRef.current = 0;
    performFetch();
    
    /**
     * Cleanup: Abort request if component unmounts
     */
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, dependencies);

  /**
   * Manual refetch function
   */
  const refetch = () => {
    retryCountRef.current = 0;
    performFetch();
  };

  return { data, loading, error, refetch };
};

/**
 * useAsyncOperation - Hook for async operations with proper state management
 * 
 * Usage:
 * const { execute, loading, error, success } = useAsyncOperation(async () => {
 *   await apiClient.post('/api/endpoint', data);
 * });
 */
export const useAsyncOperation = (asyncFn, options = {}) => {
  const { onSuccess = null, onError = null } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const abortControllerRef = useRef(null);

  const getErrorMessage = (err) => {
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      return null;
    }
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    if (err.response?.data?.error) {
      return err.response.data.error;
    }
    if (err.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    if (err.message === 'Network Error' || !err.response) {
      return 'Network error. Please check your connection.';
    }
    return err.message || 'An error occurred.';
  };

  const execute = async (...args) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      abortControllerRef.current = new AbortController();
      
      const result = await asyncFn(...args, abortControllerRef.current.signal);
      
      setSuccess(true);
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return;
      }
      
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      onError?.(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  };

  const cancel = () => {
    abortControllerRef.current?.abort();
    reset();
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { execute, loading, error, success, reset, cancel };
};

export default useFetch;
