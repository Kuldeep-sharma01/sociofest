/**
 * client/src/utils/index.js
 * Centralized exports for all frontend utilities
 * Organizes utilities into logical categories
 */

// ==================== USER UTILITIES ====================
export {
  getPrimaryEmail,
  getUserSubtitle,
} from './userUtils';

// ==================== ROLE & PERMISSION UTILITIES ====================
export {
  canCreateQuiz,
  canEditUser,
  hasAdminAccess,
} from './roleUtils';

// ==================== THEME & STYLING ====================
export {
  getThemeColors,
  applyTheme,
} from './themeUtils';

// ==================== FILE & DOWNLOAD UTILITIES ====================
export {
  downloadFile,
  downloadJSON,
  downloadCSV,
} from './downloadUtils';

// ==================== TEXT & STRING UTILITIES ====================
export {
  truncateText,
  formatDate,
  sanitizeHtml,
} from './textUtils';

// ==================== CONSTANTS ====================
export { API_URL, PYTHON_API_URL, SD_API_URL } from '@/config/constants';

/**
 * UTILS ORGANIZATION REFERENCE
 * 
 * Utilities provide pure functions with no side effects:
 * 
 * User Utils:
 *   - Email extraction
 *   - Display name formatting
 *   - User subtitle generation
 * 
 * Role Utils:
 *   - Permission checks
 *   - Role-based rendering
 *   - Access control helpers
 * 
 * Theme Utils:
 *   - Color management
 *   - Theme switching
 *   - CSS variable management
 * 
 * Download Utils:
 *   - File downloads
 *   - CSV export
 *   - JSON export
 * 
 * Text Utils:
 *   - String formatting
 *   - Date formatting
 *   - HTML sanitization
 */
