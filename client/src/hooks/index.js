/**
 * client/src/hooks/index.js
 * Centralized exports for all custom hooks
 */

export { useFetch, useAsyncOperation } from './useFetch';
export { useErrorHandler, withErrorHandler } from './useErrorHandler';

/**
 * HOOKS REFERENCE
 * 
 * 1. useFetch - Safe data fetching with AbortController
 *    Usage: const { data, loading, error, refetch } = useFetch(fetchFn, [deps]);
 *    
 * 2. useAsyncOperation - Async operations with state management
 *    Usage: const { execute, loading, error, success } = useAsyncOperation(asyncFn);
 *    
 * 3. useErrorHandler - Centralized error handling
 *    Usage: const { handleError, showError } = useErrorHandler();
 *    
 * All hooks include proper cleanup and AbortController support
 */
