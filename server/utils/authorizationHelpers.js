/**
 * server/utils/authorizationHelpers.js
 * Helper functions for checking permissions and logging activities
 * Maintains abstraction by centralizing authorization logic
 */

import mongoose from 'mongoose';
import { isIPv4, isIPv6 } from 'net';
import ActivityLog from '../models/ActivityLog.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import Connection from '../models/Connection.js';
import { hasPermission } from './rbac.js';

/**
 * Check if user can perform action on resource with given scope
 * @param {Object} user - User object from req.user
 * @param {string} resource - Resource type
 * @param {string} action - Action to perform
 * @param {Object} context - Additional context for permission check
 * @returns {Promise<Object>} { allowed: boolean, reason: string }
 */
export const checkPermission = async (user, resource, action, context = {}) => {
  if (!user) {
    return { allowed: false, reason: 'Not authenticated' };
  }

  const permission = hasPermission(user.role, resource, action);
  
  if (!permission) {
    return {
      allowed: false,
      reason: `Role '${user.role}' cannot ${action} ${resource}`,
    };
  }

  // Scope-based permission checks
  if (typeof permission === 'string') {
    return await checkScopedPermission(user, permission, resource, action, context);
  }

  return { allowed: true };
};

/**
 * Check scoped permissions (e.g., 'ownDepartment', 'department', 'all')
 */
export const checkScopedPermission = async (user, scope, resource, action, context = {}) => {
  const {
    targetUserId,
    targetDepartmentId,
    targetSubjectId,
    author,
    ownedBy,
    departmentId,
    isPublic,
  } = context;

  const effectiveDepartmentId = targetDepartmentId || departmentId || ownedBy;

  switch (scope) {
    // Can access/modify anything
    case 'all':
    case 'selfAndAll':
      return { allowed: true };

    // Can only access their own content
    case 'self':
      if (targetUserId && targetUserId.toString() !== user._id.toString()) {
        return { allowed: false, reason: 'Can only access your own content' };
      }
      return { allowed: true };

    case 'department':
    case 'ownDepartment':
      if (!user.department) {
        return { allowed: false, reason: 'Your account has no department assigned' };
      }
      if (!effectiveDepartmentId) {
        return { allowed: false, reason: 'Resource has no department assignment' };
      }
      if (effectiveDepartmentId.toString() !== user.department?.toString()) {
        return {
          allowed: false,
          reason: 'Can only access content from your department',
        };
      }
      return { allowed: true };

    case 'departmentAndSelf': {
      const isSelf = targetUserId && targetUserId.toString() === user._id.toString();
      if (isSelf) return { allowed: true };
      if (!user.department) return { allowed: false, reason: 'Your account has no department assigned' };
      const isSameDepartment = effectiveDepartmentId && effectiveDepartmentId.toString() === user.department.toString();
      if (!isSameDepartment) {
        return {
          allowed: false,
          reason: 'Can only access your own content or your department content',
        };
      }
      return { allowed: true };
    }

    // Can access own department AND public content
    case 'departmentAndPublic':
      if (isPublic) return { allowed: true };
      if (!user.department) return { allowed: false, reason: 'Your account has no department assigned' };
      if (isPublic === false && effectiveDepartmentId && effectiveDepartmentId.toString() !== user.department.toString()) {
        return {
          allowed: false,
          reason: 'Content is private to another department',
        };
      }
      return { allowed: true };

    // Can access own created content AND department content (for HOD)
    case 'ownCreatedAndDepartment': {
      const isCreator = author && author.toString() === user._id.toString();
      if (isCreator) return { allowed: true };
      if (!user.department) return { allowed: false, reason: 'Your account has no department assigned' };
      const isDepartmentContent = effectiveDepartmentId && effectiveDepartmentId.toString() === user.department.toString();
      
      if (!isDepartmentContent) {
        return {
          allowed: false,
          reason: 'Can only access your created content or department content',
        };
      }
      return { allowed: true };
    }

    // Can only access own created content
    case 'ownCreated':
      if (author && author.toString() !== user._id.toString()) {
        return {
          allowed: false,
          reason: 'Can only access your own created content',
        };
      }
      return { allowed: true };

    case 'ownContent':
      if (author && author.toString() !== user._id.toString()) {
        return {
          allowed: false,
          reason: 'Can only access your own content',
        };
      }
      return { allowed: true };

    case 'ownSubmissions': {
      const submissionOwner = author || targetUserId;
      if (!submissionOwner) return { allowed: false, reason: 'Cannot verify submission ownership' };
      if (submissionOwner.toString() !== user._id.toString()) {
        return { allowed: false, reason: 'Can only access your own submissions' };
      }
      return { allowed: true };
    }

    // Can see own subjects only
    case 'ownSubjects':
      if (targetSubjectId && !(await userTeachesSubject(user._id, targetSubjectId))) {
        return {
          allowed: false,
          reason: 'You do not teach this subject',
        };
      }
      return { allowed: true };

    // Can see subjects they teach AND public
    case 'ownSubjectsAndPublic':
      if (
        isPublic === false &&
        targetSubjectId &&
        !(await userTeachesSubject(user._id, targetSubjectId))
      ) {
        return {
          allowed: false,
          reason: 'Cannot access private content from subjects you do not teach',
        };
      }
      return { allowed: true };

    // Can see enrolled subjects
    case 'enrolledSubjects':
      if (targetSubjectId && !(await userIsEnrolled(user._id, targetSubjectId))) {
        return {
          allowed: false,
          reason: 'You are not enrolled in this subject',
        };
      }
      return { allowed: true };

    // Department and connections
    case 'departmentAndConnections':
      if (await isUserConnection(user._id, targetUserId)) return { allowed: true };
      if (!user.department) return { allowed: false, reason: 'Your account has no department assigned' };
      if (
        effectiveDepartmentId &&
        effectiveDepartmentId.toString() !== user.department.toString()
      ) {
        return {
          allowed: false,
          reason: 'You can only view users in your department or connections',
        };
      }
      return { allowed: true };

    // Public and connections only
    case 'publicAndConnections': {
      const isSelf = targetUserId && targetUserId.toString() === user._id.toString();
      if (isSelf) return { allowed: true };
      if (targetUserId && !isPublic && !(await isUserConnection(user._id, targetUserId))) {
        return {
          allowed: false,
          reason: 'You can only view public profiles or connections',
        };
      }
      return { allowed: true };
    }

    // All departments (for admin creating assignments/quizzes)
    case 'allDepartments':
      return { allowed: true };

    case 'public':
      if (!isPublic) {
        return { allowed: false, reason: 'Content is not public' };
      }
      return { allowed: true };

    case 'publicOnly':
      if (!isPublic) {
        return { allowed: false, reason: 'Guest users can only view public content' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown permission scope' };
  }
};

/**
 * Helper: Check if user teaches a subject
 */
const userTeachesSubject = async (userId, subjectId) => {
  if (!userId || !subjectId) return false;
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(subjectId)) {
    return false;
  }

  const teacher = await Teacher.findOne({
    userId,
    subjects: subjectId,
  }).lean();

  return !!teacher;
};

/**
 * Helper: Check if user is enrolled in subject
 */
const userIsEnrolled = async (userId, subjectId) => {
  if (!userId || !subjectId) return false;
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(subjectId)) {
    return false;
  }

  const student = await Student.findOne({
    userId,
    subjects: subjectId,
  }).lean();

  return !!student;
};

/**
 * Helper: Check if users are connections
 */
const isUserConnection = async (userId1, userId2) => {
  if (!userId1 || !userId2) return false;

  if (!mongoose.isValidObjectId(userId1) || !mongoose.isValidObjectId(userId2)) {
    return false;
  }

  const connection = await Connection.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' },
    ],
  }).lean();

  return !!connection;
};

const sanitizeIp = (ip) => {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, ''); // strip IPv4-mapped IPv6
  if (isIPv4(clean) || isIPv6(clean)) return clean;
  return null; // reject non-IP strings
};

/**
 * Log an activity
 * @param {Object} options - Activity details
 */
export const logActivity = async (options) => {
  const {
    actor,
    action,
    resource,
    resourceId,
    resourceName,
    scope = 'personal',
    departmentId,
    subjectId,
    details,
    status = 'success',
    errorMessage,
    ipAddress,
    userAgent,
    visibility = 'personal',
    tags = [],
  } = options;

  try {
    const log = new ActivityLog({
      actor,
      action,
      resource,
      resourceId,
      resourceName,
      scope,
      departmentId,
      subjectId,
      details,
      status,
      errorMessage,
      ipAddress: sanitizeIp(ipAddress),
      userAgent,
      visibility,
      tags,
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging failure shouldn't break the main operation
    return null;
  }
};

/**
 * Get activities based on user role and view type
 * @param {Object} user - User object
 * @param {string} viewType - 'micro' (personal) or 'macro' (department/global)
 * @param {Object} filters - Additional filters
 */
export const getActivitiesForUser = async (user, viewType = 'micro', filters = {}) => {
  const { page = 1, limit = 50 } = filters;
  const safeLimit = Math.min(100, parseInt(limit) || 50);
  const skip = (Math.max(1, parseInt(page)) - 1) * safeLimit;

  const query = {
    // Base visibility check
    $or: [
      { visibility: 'global' },
      { visibility: 'personal', 'actor.userId': user._id },
    ],
  };

  // Role-based scope filtering
  switch (user.role) {
    case 'Admin':
      // Admin can see all activities in all views
      return ActivityLog.find({
        ...query,
        $or: [
          { visibility: 'global' },
          { visibility: 'admin_only' },
          { visibility: 'personal', 'actor.userId': user._id },
        ],
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('actor.userId', 'name email')
        .populate('departmentId', 'name');

    case 'HOD':
      if (viewType === 'macro') {
        // Department-level view
        return ActivityLog.find({
          ...query,
          $or: [
            { visibility: 'global' },
            { visibility: 'department', departmentId: user.department },
            { visibility: 'hod_only', 'actor.department': user.department },
            { visibility: 'personal', 'actor.userId': user._id },
          ],
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .populate('actor.userId', 'name email')
          .populate('departmentId', 'name');
      } else {
        // Personal view
        return ActivityLog.find({
          'actor.userId': user._id,
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit);
      }

    case 'Teacher':
    case 'Student':
      // Both roles only ever see their own activities, regardless of viewType
      return ActivityLog.find({
        'actor.userId': user._id,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit);
  }

  return ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(safeLimit);
};

/**
 * Autonomously check if user can edit resource
 * Centralizes authorization logic
 */
export const canEditResource = async (user, resource, context = {}) => {
  if (!resource?.type) {
    console.warn('canEditResource called without resource.type — denying by default');
    return false;
  }
  const permCheck = await checkPermission(user, resource.type, 'edit', {
    author: resource.author,
    departmentId: resource.department,
    targetSubjectId: resource.subject,
    isPublic: resource.isPublic,
    ...context,
  });
  return permCheck.allowed;
};

/**
 * Autonomously check if user can delete resource
 */
export const canDeleteResource = async (user, resource, context = {}) => {
  if (!resource?.type) {
    console.warn('canDeleteResource called without resource.type — denying by default');
    return false;
  }
  const permCheck = await checkPermission(user, resource.type, 'delete', {
    author: resource.author,
    departmentId: resource.department,
    ...context,
  });
  return permCheck.allowed;
};

/**
 * Autonomously check if user can view resource
 */
export const canViewResource = async (user, resource, context = {}) => {
  if (!resource?.type) {
    console.warn('canViewResource called without resource.type — denying by default');
    return false;
  }
  const permCheck = await checkPermission(user, resource.type, 'view', {
    author: resource.author,
    departmentId: resource.department,
    targetSubjectId: resource.subject,
    isPublic: resource.isPublic,
    ...context,
  });
  return permCheck.allowed;
};

/**
 * Autonomously check if user can grade submissions
 */
export const canGradeSubmission = async (user, resource, context = {}) => {
  if (!resource?.type) {
    console.warn('canGradeSubmission called without resource.type — denying by default');
    return false;
  }
  const permCheck = await checkPermission(user, resource.type, 'grade', {
    author: resource.author,
    departmentId: resource.department,
    targetSubjectId: resource.subject,
    ...context,
  });
  return permCheck.allowed;
};

const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'otp', 'otpExpires',
  'resetPasswordToken', 'geminiApiKey', 'rapidApiKey',
  'resetPasswordExpire', 'aiChatHistory', 'token', 
  'emails.password', 'emails.otp', 'idToken'
]);

/**
 * Get comparison between old and new values for change tracking
 */
export const getChanges = (oldObj, newObj, fieldsToTrack = []) => {
  const changes = [];
  
  const fieldsToCheck = (fieldsToTrack.length > 0 ? fieldsToTrack : Object.keys(newObj))
    .filter(f => !SENSITIVE_FIELDS.has(f));
  
  fieldsToCheck.forEach((field) => {
    const oldValue = oldObj[field];
    const newValue = newObj[field];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field,
        oldValue,
        newValue,
      });
    }
  });
  
  return changes;
};
