/**
 * server/middleware/rbacMiddleware.js
 * Enhanced RBAC middleware for resource-level authorization
 * Works alongside roleCheck but with more granular control
 */

import { checkPermission, logActivity } from '../utils/authorizationHelpers.js';

/**
 * Permission-based middleware factory
 * Usage: router.post('/users/:id', authorize({ resource: 'users', action: 'edit' }), controller)
 * 
 * @param {Object} options - Authorization options
 * @param {string} options.resource - Resource type (e.g., 'users', 'events')
 * @param {string} options.action - Action (e.g., 'view', 'edit', 'delete')
 * @param {Function} options.contextBuilder - Optional function to build context from req/params
 * @returns {Function} Middleware function
 */
export const authorize = (options) => {
  return async (req, res, next) => {
    const { resource, action, contextBuilder } = options;

    try {
      // Check basic authentication
      if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Build context for permission check
      let context = {};
      if (contextBuilder && typeof contextBuilder === 'function') {
        context = await contextBuilder(req);
      }

      // Check permission
      const permCheck = await checkPermission(req.user, resource, action, context);

      if (!permCheck.allowed) {
        // Log failed authorization attempt
        await logActivity({
          actor: {
            userId: req.user._id,
            name: req.user.name,
            role: req.user.role,
            department: req.user.department,
          },
          action: `${action}_attempted`,
          resource,
          status: 'failed',
          errorMessage: permCheck.reason,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          visibility: 'admin_only',
          tags: ['authorization_failure'],
        });

        return res.status(403).json({
          message: 'Access denied',
          reason: permCheck.reason,
        });
      }

      // Store permission result in request for later use
      req.permission = permCheck;
      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

/**
 * Middleware to ensure resource belongs to user's accessible scope
 * Usage: router.get('/events/:id', ownsOrCanAccess('events'), controller)
 * 
 * @param {string} resource - Resource type
 * @param {Object} options - Additional options
 * @returns {Function} Middleware function
 */
export const ownsOrCanAccess = (resource, options = {}) => {
  return async (req, res, next) => {
    const { resourceIdParam = 'id', dataLoaderKey } = options;
    const resourceId = req.params[resourceIdParam];

    try {
      // Load resource data (implement as needed for your model)
      let resourceData = req[dataLoaderKey] || {}; // Pre-loaded by another middleware
      
      // If not pre-loaded, you'd fetch it here (implement based on your needs)
      // const resourceData = await getResourceById(resource, resourceId);

      // Check if user can access this resource
      const context = {
        author: resourceData.author,
        departmentId: resourceData.department,
        targetSubjectId: resourceData.subject,
        isPublic: resourceData.isPublic,
      };

      const permCheck = await checkPermission(req.user, resource, 'view', context);

      if (!permCheck.allowed) {
        return res.status(403).json({
          message: 'Cannot access this resource',
          reason: permCheck.reason,
        });
      }

      // Attach resource data to request for use in controller
      req.targetResource = resourceData;
      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      res.status(500).json({ message: 'Access check failed' });
    }
  };
};

/**
 * Middleware to ensure user is in the same department or is admin
 */
export const departmentScopeCheck = (req, res, next) => {
  const { departmentId } = req.params;

  if (req.user.role === 'Admin') {
    return next(); // Admins can access all departments
  }
if (!req.user?.department) {
  return res.status(403).json({ message: "User department is not assigned" });
}
  if (req.user.role === 'HOD' && req.user.department.toString() !== departmentId) {
    return res.status(403).json({
      message: 'HOD can only access their own department',
    });
  }

  if (['Teacher', 'Student'].includes(req.user.role) && req.user.department.toString() !== departmentId) {
    return res.status(403).json({
      message: 'You can only access your own department',
    });
  }

  next();
};

/**
 * Middleware to auto-log all CRUD operations
 */
export const auditLog = (resource, action) => {
  return async (req, res, next) => {
    // Store original methods
    const originalSend = res.send;
    const originalJson = res.json;

    const handleLog = () => {
      if (req._hasLoggedAudit) return;
      req._hasLoggedAudit = true;
      
      const redactedBody = { ...req.body };
      for (const key of ["password", "newPassword", "otp", "token", "idToken", "authorization"]) {
        if (key in redactedBody) redactedBody[key] = "[REDACTED]";
      }
      
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logActivity({
          actor: {
            userId: req.user?._id,
            name: req.user?.name,
            role: req.user?.role,
            department: req.user?.department,
          },
          action: `${resource}_${action}`,
          resource,
          resourceId: req.params.id || req.body?.resourceId,
          resourceName: req.body?.title || req.body?.name || '',
          scope: determineScope(req),
          departmentId: req.user?.department,
          details: {
            after: redactedBody,
          },
          status: 'success',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          visibility: determineVisibility(req.user?.role),
          tags: [resource, action],
        }).catch((err) => console.error('Audit logging error:', err));
      }
    };

    // Override send method to capture response
    res.send = function (data) {
      handleLog();
      // Call original send method
      return originalSend.call(this, data);
    };

    // Override json method to capture response
    res.json = function (data) {
      handleLog();
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Helper: Determine visibility level based on user role
 */
const determineVisibility = (userRole) => {
  switch (userRole) {
    case 'Admin':
      return 'admin_only';
    case 'HOD':
      return 'hod_only';
    default:
      return 'personal';
  }
};

/**
 * Helper: Determine scope of activity
 */
const determineScope = (req) => {
  if (req.user?.role === 'Admin') return 'global';
  if (req.user?.role === 'HOD') return 'department';
  if (req.user?.role === 'Teacher') return 'subject';
  return 'personal';
};

/**
 * Middleware to inject role-based query filters
 * Auto-filters results based on user's accessible scope
 */
export const injectRoleBasedFilters = (resource) => {
  return (req, res, next) => {
    // This will be called before controller to inject proper filters
    req.roleBasedFilters = buildFiltersForRole(req.user, resource);
    next();
  };
};

/**
 * Build mongo filters based on user role and resource
 */
const buildFiltersForRole = (user, resource) => {
  const filters = {};

  if (user.role === 'Admin') {
    // Admin sees everything
    return filters;
  }

  if (user.role === 'HOD') {
    // HOD sees department + public
    filters.$or = [
      { department: user.department },
      { isPublic: true },
    ];
    return filters;
  }

  if (user.role === 'Teacher') {
    // Teacher sees own department and public
    filters.$or = [
      { author: user._id },
      { department: user.department },
      { isPublic: true },
    ];
    return filters;
  }

  if (user.role === 'Student') {
    // Student sees public and their enrolled subjects
    filters.$or = [
      { isPublic: true },
      { author: user._id },
      // Add enrolled subjects filter if applicable
    ];
    return filters;
  }

  // Default: only personal content
  filters.author = user._id;
  return filters;
};

/**
 * Middleware to check if user has elevated privileges (Admin/HOD)
 */
export const requireElevatedPrivilege = (req, res, next) => {
  if (!['Admin', 'HOD'].includes(req.user?.role)) {
    return res.status(403).json({
      message: 'This action requires elevated privileges (Admin or HOD)',
    });
  }
  next();
};

/**
 * Middleware to check if user has admin privileges
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({
      message: 'This action requires admin privileges',
    });
  }
  next();
};

/**
 * Middleware to determine view type (micro vs macro) based on query param
 */
export const parseViewType = (req, res, next) => {
  const viewType = req.query.view || 'micro';

  if (!['micro', 'macro'].includes(viewType)) {
    return res.status(400).json({
      message: 'Invalid view type. Must be "micro" or "macro"',
    });
  }

  // Only Admin and HOD can access macro views
  if (viewType === 'macro' && !['Admin', 'HOD'].includes(req.user?.role)) {
    return res.status(403).json({
      message: 'Only Admin and HOD can access macro views',
    });
  }

  req.viewType = viewType;
  next();
};
