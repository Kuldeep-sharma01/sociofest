/**
 * server/utils/responseHandler.js
 * Standardizes all API responses across the application
 * Ensures consistent format: { success, data, message, errors, pagination }
 */

/**
 * Success response wrapper
 * @param {*} data - Response data payload
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status (default: 200)
 * @returns {Object} Formatted response
 */
export const sendSuccess = (data, message = 'Success', statusCode = 200) => {
  return {
    success: true,
    statusCode,
    data,
    message,
  };
};

/**
 * Paginated response wrapper
 * @param {Array} data - Array of items
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {string} message - Optional message
 * @returns {Object} Formatted paginated response
 */
export const sendPaginated = (data, total, page, limit, message = 'Success') => {
  const safePage  = Math.max(1, parseInt(page)  || 1);
  const safeLimit = Math.max(1, parseInt(limit) || 20);
  return {
    success: true,
    data,
    pagination: {
      total,
      page:  safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    },
    message,
  };
};

/**
 * Error response wrapper
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status (default: 400)
 * @param {Object} errors - Optional detailed errors object
 * @returns {Object} Formatted error response
 */
export const sendError = (message, statusCode = 400, errors = null) => {
  return {
    success: false,
    statusCode,
    message,
    errors,
  };
};

/**
 * Express middleware wrapper - sends response automatically
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} responseData - Response object from sendSuccess/sendError
 */
export const respond = (res, statusCode, responseData) => {
  return res.status(statusCode).json(responseData);
};

/**
 * Success response with Express - shorthand
 */
export const ok = (res, data, message = 'Success') => {
  return respond(res, 200, sendSuccess(data, message));
};

/**
 * Created response with Express - shorthand
 */
export const created = (res, data, message = 'Resource created successfully') => {
  return respond(res, 201, sendSuccess(data, message));
};

/**
 * Error response with Express - shorthand
 */
export const badRequest = (res, message = 'Bad request', errors = null) => {
  return respond(res, 400, sendError(message, 400, errors));
};

/**
 * Unauthorized response
 */
export const unauthorized = (res, message = 'Unauthorized access') => {
  return respond(res, 401, sendError(message, 401));
};

/**
 * Forbidden response
 */
export const forbidden = (res, message = 'Access forbidden') => {
  return respond(res, 403, sendError(message, 403));
};

/**
 * Not found response
 */
export const notFound = (res, message = 'Resource not found') => {
  return respond(res, 404, sendError(message, 404));
};

/**
 * Conflict response (e.g., duplicate entry)
 */
export const conflict = (res, message = 'Resource conflict') => {
  return respond(res, 409, sendError(message, 409));
};

/**
 * Server error response
 */
export const serverError = (res, message = 'Internal server error', error = null) => {
  if (error) console.error('[SERVER ERROR]', error?.message || error);  // always log, never send
  return respond(res, 500, sendError(message, 500));  // never include error in response
};

/**
 * Unprocessable entity (validation failed)
 */
export const unprocessableEntity = (res, message = 'Validation failed', errors = null) => {
  return respond(res, 422, sendError(message, 422, errors));
};
