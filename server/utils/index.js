/**
 * server/utils/index.js
 * Centralized exports for all backend utilities
 * Organizes utilities into logical categories for easy imports
 */

// ==================== RESPONSE & ERROR HANDLING ====================
export {
  sendSuccess,
  sendPaginated,
  sendError,
  respond,
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  unprocessableEntity,
} from './responseHandler.js';

// ==================== REQUEST LOGGING & AUDITING ====================
export { logActivity } from './authorizationHelpers.js';
export {
  activityLoggerMiddleware,
  debugLog,
  errorLog,
} from './requestLogger.js';

// ==================== AUTHENTICATION & JWT ====================
export {
  generateToken,
  verifyToken,
  getTokenFromHeader,
} from './jwtUtils.js';

// ==================== RBAC (ROLE-BASED ACCESS CONTROL) ====================
export {
  ROLES,
  VALID_ROLES,
  PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  ROLE_HIERARCHY,
  isRoleHigherOrEqual,
  getRolesWithPermission,
} from './rbac.js';

// ==================== MEDIA PROCESSING & FILE UPLOADS ====================
export {
  processUpload,
  deleteMediaDocs,
  getFfmpegConfig,
  updateFfmpegConfig,
} from './mediaHelper.js';

// ==================== EMAIL & COMMUNICATION ====================
export {
  sendEmail,
} from './emailUtils.js';

// ==================== CERTIFICATE GENERATION ====================
export {
  generateCertificatePDF,
} from './certificateGenerator.js';

// ==================== METADATA & LINK PREVIEW ====================
export {
  getLinkPreview,
} from './metadataHelper.js';

/**
 * UTILS ORGANIZATION REFERENCE
 * 
 * Response & Error Handling:
 *   - responseHandler: Standard API response formats
 *   - requestLogger: Activity logging and auditing
 * 
 * Authentication & Authorization:
 *   - jwtUtils: JWT token generation and verification
 *   - rbac: Role-based permissions and access control
 * 
 * File & Media Processing:
 *   - mediaHelper: File uploads, deduplication, FFmpeg config
 *   - certificateGenerator: PDF certificate generation
 * 
 * Communication & Metadata:
 *   - emailUtils: Email sending functionality
 *   - metadataHelper: Link previews and metadata extraction
 */
