/**
 * server/utils/requestLogger.js
 * Centralized request/response logging
 * Logs important API calls for debugging and auditing
 */

import ActivityLog from '../models/ActivityLog.js';
import { logActivity } from './authorizationHelpers.js';


/**
 * Create middleware for automatic activity logging
 * @returns {Function} Express middleware
 */
export const activityLoggerMiddleware = (action) => {
  return async (req, res, next) => {
    // Store action for later use in controllers
    req.logAction = action;
    // ✅ Log aborts and failures too
    // Also ensure res.on('finish') is idempotent — use res.once instead of res.on
    res.once('finish', async () => {
      if (req.user) {
        try {
          await logActivity({
            actor: {
              userId: req.user._id,
              name: req.user.name,
              role: req.user.role,
              department: req.user.department,
            },
            action,
            resource: req.body?.resourceType || 'api',
            resourceId: req.params?.id || null,
            details: { changes: req.body?.changes || {} },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: res.statusCode < 400 ? 'success' : 'failed'
          });
        } catch (error) {
          console.warn('Async logging failed:', error.message);
        }
      }
    });

    // ✅ Register the aborted listener only once per request using req.once
    req.once('aborted', async () => {
      if (req.user) {
        try {
          await logActivity({
            actor: {
              userId: req.user._id,
              name: req.user.name,
              role: req.user.role,
              department: req.user.department,
            },
            action,
            resource: req.body?.resourceType || 'api',
            resourceId: req.params?.id || null,
            details: { changes: req.body?.changes || {} },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'failed'
          });
        } catch {}
      }
    });

    next();
  };
};

/**
 * Debug log for development
 */
export const debugLog = (label, data) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${label}:`, data);
  }
};

/**
 * Error log
 */
export const errorLog = (label, error) => {
  console.error(`[ERROR] ${label}:`, error.message || error);
};
