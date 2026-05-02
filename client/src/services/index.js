/**
 * client/src/services/index.js
 * Centralized exports for all frontend services
 * Organizes services into logical categories
 */

// ==================== AUTHENTICATION ====================
export {
  registerUser,
  loginUser,
  logoutUser,
  verifyOTP,
  resetPassword,
  requestPasswordReset,
  verifyResetOtp,
  oauthLogin,
  resendVerificationOTP,
  getProfile
} from './userService';

// ==================== USER MANAGEMENT ====================
export * as userService from './userService';

// ==================== ACADEMIC SERVICES ====================
export * as quizService from './quizService';
export * as assignmentService from './assignmentService';
export * as materialService from './materialService';
export * as subjectService from './subjectService';

// ==================== SOCIAL SERVICES ====================
export * as contentService from './contentService';
export * as chatService from './chatService';
export * as connectionService from './connectionService';

// ==================== EVENTS & CERTIFICATES ====================
export * as eventService from './eventService'; 
export * as certificateService from './certificateService';
export * as attendanceService from './attendanceService';

// ==================== ADMIN & MANAGEMENT ====================
export * as adminService from './adminService';
export * as departmentService from './departmentService';
export * as statsService from './statsService';

// ==================== AI & MEDIA ====================
export * as aiService from './aiService';
export * as aiClientService from './aiClient';

// ==================== UTILITY SERVICES ====================
export * as searchService from './searchService';
export * as pushService from './pushService';
export * as wifiService from './wifiService';

// ==================== API CLIENT & UTILITIES ====================
export { apiClient, pythonClient, toFormData } from './apiClient';

/**
 * SERVICES ORGANIZATION REFERENCE
 * 
 * Services follow a consistent pattern:
 * - Async functions that return promises
 * - Always use apiClient for requests
 * - Include JSDoc comments
 * - Handle errors at service level (not component level)
 * - Named exports only (no default)
 * 
 * Service Categories:
 * 
 * 1. Authentication (userService)
 *    - register, login, logout
 *    - verifyOTP, resetPassword
 *    - getProfile, updateProfile
 * 
 * 2. User Management (userService)
 *    - getAllUsers, getUserById
 *    - updateUser, deleteUser
 *    - updateRole, updateStatus
 * 
 * 3. Academic (quizService, assignmentService, etc.)
 *    - CRUD operations for quizzes, assignments, materials
 *    - Submission management
 *    - Grading operations
 * 
 * 4. Social (contentService, chatService, connectionService)
 *    - Post/comment CRUD
 *    - Message conversations
 *    - Connection requests
 * 
 * 5. Admin (adminService, departmentService, statsService)
 *    - User management
 *    - Department/subject management
 *    - Analytics and statistics
 * 
 * 6. AI & Media (aiService, aiClientService)
 *    - Content generation
 *    - Image processing
 *    - File uploads
 */
