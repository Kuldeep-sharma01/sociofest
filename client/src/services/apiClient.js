/**
 * apiClient.js
 * 
 * Shared Serialization Convention:
 * When sending complex objects via multipart/form-data (using `toFormData`),
 * nested objects are JSON.stringify'd and a companion field `${key}__type = 'json'`
 * is appended. Server-side middleware should look for `__type` fields to automatically
 * JSON.parse the corresponding string fields back into objects.
 */
import axios from "axios"; //
import { API_URL } from "@/config/constants"; //
import { store } from "@/redux/store";
import { logout } from "@/redux/authSlice";

/**
 * Request timeout configuration
 * 30 seconds for regular requests, 120 seconds for file uploads
 */
export const REQUEST_TIMEOUT = 30000;
export const UPLOAD_TIMEOUT = 120000;

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof File) &&
  !(value instanceof Blob) &&
  !(value instanceof FormData);

const normalizePrimitive = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isNaN(value)) {
    return null;
  }
  return value;
};

export const normalizeApiPayload = (payload) => {
  if (payload === undefined) {
    return undefined;
  }
  if (payload === null) {
    return null;
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiPayload(item));
  }
  if (!isPlainObject(payload)) {
    return normalizePrimitive(payload);
  }

  const normalized = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    normalized[key] = normalizeApiPayload(value);
  });
  return normalized;
};

const normalizeApiResponse = (payload) => {
  if (!isPlainObject(payload) || !Object.prototype.hasOwnProperty.call(payload, "success")) {
    return {
      data: payload,
      meta: {},
    };
  }

  // If 'data' key is present, use it. 
  // Otherwise, if it's a flat successful response, use the payload itself as data
  const data = Object.prototype.hasOwnProperty.call(payload, "data")
    ? payload.data
    : payload;

  const meta = {
    success: payload.success,
    message: payload.message,
    pagination: payload.pagination || null,
    statusCode: payload.statusCode,
    errors: payload.errors || null,
  };

  return { data, meta };
};

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT,
});

// Dev:  Always use relative /python-api to leverage Vite proxy and avoid CORS.
// Prod: Use absolute VITE_PYTHON_URL if provided.
const pythonBaseURL = (import.meta.env.MODE === 'development') 
  ? "/python-api" 
  : (import.meta.env.VITE_PYTHON_URL ? import.meta.env.VITE_PYTHON_URL.replace(/\/+$/, "") : "/python-api");

export const pythonClient = axios.create({
  baseURL: pythonBaseURL,
  timeout: REQUEST_TIMEOUT,
});


const authInterceptor = (config) => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

apiClient.interceptors.request.use(authInterceptor, (error) => Promise.reject(error));
pythonClient.interceptors.request.use(authInterceptor, (error) => Promise.reject(error));

// Shared request interceptor for data normalization and FormData handling
const requestDataInterceptor = (config) => {
  if (config.data instanceof FormData) {
    config.timeout = UPLOAD_TIMEOUT;
    
    const originalOnUploadProgress = config.onUploadProgress;
    config.onUploadProgress = (progressEvent) => {
      if (originalOnUploadProgress) originalOnUploadProgress(progressEvent);
      if (progressEvent.total && progressEvent.total > 50 * 1024) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        window.dispatchEvent(
          new CustomEvent("globalUploadProgress", {
            detail: { progress: percentCompleted },
          }),
        );
      }
    };
  } else if (isPlainObject(config.data) || Array.isArray(config.data)) {
    config.data = normalizeApiPayload(config.data);
  }

  if (isPlainObject(config.params) || Array.isArray(config.params)) {
    config.params = normalizeApiPayload(config.params);
  }
  return config;
};

apiClient.interceptors.request.use(requestDataInterceptor);
pythonClient.interceptors.request.use(requestDataInterceptor);

// Global Response Interceptor for 401 Unauthorized (Token Expiration)
const responseInterceptor = (response) => {
  const { data, meta } = normalizeApiResponse(response.data);
  response.rawData = response.data;
  response.meta = meta;
  response.data = data;
  return response;
};

/**
 * Enhanced error interceptor with better error message extraction
 * Handles different error scenarios and displays appropriate messages
 */
const errorInterceptor = (error) => {
  // Extract error message from various response formats
  const getErrorMessage = (err) => {
    // Phase 2 standardized format
    if (err.response?.data?.message) {
      return err.response.data.message;
    }
    // Legacy format
    if (err.response?.data?.error) {
      return err.response.data.error;
    }
    // Validation errors
    if (err.response?.data?.errors) {
      const errors = err.response.data.errors;
      if (Array.isArray(errors)) {
        return errors.map(e => e.msg).join(', ');
      }
      if (typeof errors === 'object') {
        return Object.values(errors).flat().join(', ');
      }
    }
    // HTTP status messages
    if (err.response?.statusText) {
      return err.response.statusText;
    }
    // Timeout error
    if (err.code === 'ECONNABORTED') {
      return 'Request timeout. Please check your connection and try again.';
    }
    // Network error
    if (err.message === 'Network Error') {
      return 'Network error. Please check your internet connection.';
    }
    // Default message
    return 'An error occurred. Please try again.';
  };

  // Prevent "Session expired" logic from firing during login/signup attempts
  const isLoginFlow = ['/auth/login', '/auth/register', '/auth/google'].some(route => error.config?.url?.includes(route));

  // Handle 401 Unauthorized - Auto logout
  if (error.response?.status === 401 && !isLoginFlow) {
    store.dispatch(logout());

    if (typeof window !== "undefined" && !error._toastShown) {
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: "Session expired. Please log in again. 🔒"
      }));
      error._toastShown = true;
    }
    return Promise.reject(error);
  }

  // Handle other errors - Extract and display message
  if (error.response || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
    const errorMsg = getErrorMessage(error);
    const statusCode = error.response?.status;

    // ✅ Only show the toast on final failure, and prevent duplicates from nested retry chains
    if (statusCode !== 422 && typeof window !== "undefined" && !error._toastShown) {
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: errorMsg
      }));
      error._toastShown = true;
    }
  }

  return Promise.reject(error);
};

apiClient.interceptors.response.use(responseInterceptor, errorInterceptor);
pythonClient.interceptors.response.use(responseInterceptor, errorInterceptor);

/**
 * Retry interceptor for transient failures (5xx errors, timeouts, network errors)
 * Implements exponential backoff to avoid overwhelming the server
 */
const createRetryInterceptor = (client) => {
  client.interceptors.response.use(
    response => response,
    async (error) => {
      const config = error.config;

      // Don't retry if no config (shouldn't happen) or already retried max times
      if (!config) return Promise.reject(error);

      config.retryCount = config.retryCount || 0;
      const MAX_RETRIES = 3;

      const status = error.response?.status;

      if (status === 429) {
        if (config.retryCount === 0) {
          const retryAfter = error.response.headers?.['retry-after'];
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
          await new Promise(r => setTimeout(r, Math.min(waitMs, 60000)));
          // Only retry ONCE after respecting Retry-After
          config.retryCount = MAX_RETRIES - 1;
          return client(config);
        }
        return Promise.reject(error);
      }

      const isRetryable = !error.response || (status >= 500) || status === 408;

      if (isRetryable && config.retryCount < MAX_RETRIES) {
        config.retryCount++;

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, config.retryCount - 1) * 1000;

        await new Promise(resolve => setTimeout(resolve, delayMs));

        return client(config);
      }

      return Promise.reject(error);
    }
  );
};

createRetryInterceptor(apiClient);
createRetryInterceptor(pythonClient);



export const toFormData = (payload = {}) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        formData.append(key, JSON.stringify([]));
        formData.append(`${key}__type`, "json");
      } else {
        const hasFiles = value.some(item =>
          item instanceof File ||
          item instanceof Blob ||
          (item && (item.file instanceof File || item.file instanceof Blob))
        );
        if (hasFiles) {
          value.forEach(item => {
            if (item instanceof File || item instanceof Blob) {
              formData.append(key, item);
            } else if (item && (item.file instanceof File || item.file instanceof Blob)) {
              formData.append(key, item.file);
            }
          });
        } else {
          formData.append(key, JSON.stringify(value));
          formData.append(`${key}__type`, "json");
        }
      }
    } else if (
      typeof value === "object" &&
      !(value instanceof File || value instanceof Blob || value instanceof Date)
    ) {
      formData.append(key, JSON.stringify(value));
      formData.append(`${key}__type`, "json");
    } else if (value instanceof Date) {
      formData.append(key, value.toISOString());
    } else {
      formData.append(key, value);
    }
  });
  return formData;
};

export const appendFiles = (
  formData,
  attachments = [],
  fieldName = "files",
) => {
  attachments.forEach((att) => {
    if (!att) return;
    if (att.file) {
      formData.append(fieldName, att.file);
    } else if (att instanceof File || att instanceof Blob) {
      formData.append(fieldName, att);
    }
  });
  return formData;
};

const getAuthHeaders = () => {
  const token = store.getState().auth.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchResource = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    store.dispatch(logout());
    throw new Error("Session expired");
  }
  return res;
};

export const fetchJsonResource = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    store.dispatch(logout());
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.statusText}`);
  return res.json();
};

export const fetchTextResource = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    store.dispatch(logout());
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`Failed to fetch text: ${res.statusText}`);
  return res.text();
};
