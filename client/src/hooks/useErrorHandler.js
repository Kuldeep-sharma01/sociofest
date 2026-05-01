/**
 * useErrorHandler - Centralized error handling for components
 * Provides consistent error messaging and user feedback
 */

import { useCallback } from 'react';

/**
 * Hook for handling errors consistently across components
 * 
 * Usage:
 * const { handleError, showError } = useErrorHandler();
 * 
 * try {
 *   await apiClient.post('/api/endpoint', data);
 * } catch (error) {
 *   handleError(error);
 * }
 */
export const useErrorHandler = () => {
  /**
   * Extract detailed error message from various error formats
   */
  const extractErrorMessage = useCallback((error) => {
    if (!error) return 'An unknown error occurred.';
    
    // Phase 2 standardized format
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    // Legacy format
    if (error.response?.data?.error) {
      return error.response.data.error;
    }
    
    // Validation errors array
    if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
      return error.response.data.errors.map(e => e.msg).join(', ');
    }
    
    // Validation errors object
    if (error.response?.data?.errors && typeof error.response.data.errors === 'object') {
      return Object.values(error.response.data.errors).flat().join(', ');
    }
    
    // Timeout
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please check your connection and try again.';
    }
    
    // Network error
    if (error.message === 'Network Error' || !error.response) {
      return 'Network error. Please check your internet connection.';
    }
    
    // HTTP status text
    if (error.response?.statusText) {
      return error.response.statusText;
    }
    
    // Error message
    if (error.message) {
      return error.message;
    }
    
    return 'An error occurred. Please try again.';
  }, []);

  /**
   * Classify error type for appropriate handling
   */
  const classifyError = useCallback((error) => {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return 'timeout';
      return 'network';
    }
    
    const status = error.response.status;
    
    if (status === 400) return 'validation';
    if (status === 401) return 'auth';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'notfound';
    if (status === 422) return 'validation';
    if (status >= 500) return 'server';
    
    return 'general';
  }, []);

  /**
   * Show error message to user
   */
  const showError = useCallback((message, options = {}) => {
    if (typeof window === 'undefined') return;
    
    const { type = 'error', duration = 5000 } = options;
    
    window.dispatchEvent(new CustomEvent('showToast', {
      detail: {
        type,
        message,
        duration
      }
    }));
  }, []);

  /**
   * Handle and display error
   */
  const handleError = useCallback((error, options = {}) => {
    const { 
      showToast = true, 
      logToConsole = true,
      onValidationError = null 
    } = options;
    
    if (logToConsole) {
      console.error('[Error Handler]', error);
    }
    
    const errorMsg = extractErrorMessage(error);
    const errorType = classifyError(error);
    
    // Handle validation errors differently (usually shown in form)
    if (errorType === 'validation' && onValidationError) {
      onValidationError(error.response?.data?.errors || errorMsg);
      return;
    }
    
    // Show toast for non-validation errors
    if (showToast && errorType !== 'validation') {
      showError(errorMsg, { type: 'error' });
    }
    
    return {
      message: errorMsg,
      type: errorType,
      error
    };
  }, [extractErrorMessage, classifyError, showError]);

  /**
   * Show success message
   */
  const showSuccess = useCallback((message, options = {}) => {
    if (typeof window === 'undefined') return;
    
    const { duration = 3000 } = options;
    
    window.dispatchEvent(new CustomEvent('showToast', {
      detail: {
        type: 'success',
        message,
        duration
      }
    }));
  }, []);

  /**
   * Show info message
   */
  const showInfo = useCallback((message, options = {}) => {
    if (typeof window === 'undefined') return;
    
    const { duration = 3000 } = options;
    
    window.dispatchEvent(new CustomEvent('showToast', {
      detail: {
        type: 'info',
        message,
        duration
      }
    }));
  }, []);

  /**
   * Show warning message
   */
  const showWarning = useCallback((message, options = {}) => {
    if (typeof window === 'undefined') return;
    
    const { duration = 4000 } = options;
    
    window.dispatchEvent(new CustomEvent('showToast', {
      detail: {
        type: 'warning',
        message,
        duration
      }
    }));
  }, []);

  return {
    handleError,
    showError,
    showSuccess,
    showInfo,
    showWarning,
    extractErrorMessage,
    classifyError
  };
};

/**
 * Higher-order component pattern for error boundary
 * Can be used to wrap components that might throw
 */
export const withErrorHandler = (Component) => {
  return (props) => {
    const errorHandler = useErrorHandler();
    
    return <Component {...props} errorHandler={errorHandler} />;
  };
};

export default useErrorHandler;
