/**
 * server/routes/governance.js
 * Admin/HOD Resource Governance Routes
 * Full editing and management capabilities
 */

import express from 'express';
import { param, body } from 'express-validator';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireElevatedPrivilege, requireAdmin } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validateMiddleware.js';
import {
  editResource,
  deleteResource,
  bulkEditResources,
  updateUserRole,
  getResourceEditHistory,
  getResourcesForManagement,
} from '../controllers/governanceController.js';
import { VALID_ROLES } from '../utils/rbac.js';

const router = express.Router();

// All routes require authentication and elevated privileges
router.use(authenticate);
router.use(requireElevatedPrivilege);

/**
 * Reusable validation rules for resource parameters
 */
// ✅ Whitelist valid resource types in the validator
const VALID_RESOURCE_TYPES = ['event', 'assignment', 'quiz', 'post', 'material', 'user', 'department'];

const resourceParamsValidation = [
  param('resourceType')
    .isIn(VALID_RESOURCE_TYPES)
    .withMessage(`resourceType must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`),
  param('resourceId')
    .isMongoId()
    .withMessage('Invalid MongoDB resource ID format'),
];

/**
 * Resource Management - Edit and Delete
 */

/**
 * @route   PUT /api/governance/resource/:resourceType/:resourceId
 * @desc    Edit any resource within scope
 * @access  Private/HOD/Admin
 */
router.put('/resource/:resourceType/:resourceId', resourceParamsValidation, validateRequest, editResource);

/**
 * @route   DELETE /api/governance/resource/:resourceType/:resourceId
 * @desc    Delete any resource within scope
 * @access  Private/HOD/Admin
 */
router.delete('/resource/:resourceType/:resourceId', resourceParamsValidation, validateRequest, deleteResource);

/**
 * Bulk Resource Operations
 */

/**
 * @route   PUT /api/governance/bulk-edit/:resourceType
 * @desc    Bulk edit multiple resources
 * @access  Private/HOD/Admin
 */
router.put('/bulk-edit/:resourceType', [
  param('resourceType')
    .isIn(VALID_RESOURCE_TYPES)
    .withMessage(`resourceType must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`),
  body('ids').isArray({ min: 1 }).withMessage('Must provide an array of resource IDs'),
  body('ids.*').isMongoId().withMessage('One or more IDs in the array are invalid')
], validateRequest, bulkEditResources);

/**
 * User Role Management
 */

/**
 * @route   PUT /api/governance/user/:userId/role
 * @desc    Change user role (Admin only)
 * @access  Private/Admin
 */
router.put('/user/:userId/role', [
  param('userId').isMongoId().withMessage('Invalid MongoDB user ID format'),
  body('newRole')
    .optional()
    .isIn(VALID_ROLES)
    .withMessage('Invalid role'),
  body('isBlocked')
    .optional()
    .isBoolean()
    .withMessage('isBlocked must be a boolean'),
  body().custom((_, { req }) => {
    if (req.body.newRole === undefined && req.body.isBlocked === undefined)
      throw new Error('Provide newRole or isBlocked');
    return true;
  })
], validateRequest, updateUserRole);

/**
 * Audit and History
 */

/**
 * @route   GET /api/governance/history/:resourceType/:resourceId
 * @desc    Get edit history for a resource
 * @access  Private/HOD/Admin
 */
router.get('/history/:resourceType/:resourceId', resourceParamsValidation, validateRequest, getResourceEditHistory);

/**
 * Resource Listing for Management
 */

/**
 * @route   GET /api/governance/resources/:resourceType
 * @desc    List all resources of a specific type for management
 * @access  Private/HOD/Admin
 */
router.get('/resources/:resourceType', [
  param('resourceType')
    .isIn(VALID_RESOURCE_TYPES)
    .withMessage(`resourceType must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`)
], validateRequest, getResourcesForManagement);

export default router;
