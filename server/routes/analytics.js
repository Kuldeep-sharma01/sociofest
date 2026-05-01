/**
 * server/routes/analytics.js
 * Analytics and Activity Log Routes
 * Admin and HOD dashboards with macro/micro views
 */

import express from 'express';
import { param, query as qv } from 'express-validator';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireElevatedPrivilege, requireAdmin, parseViewType } from '../middleware/rbacMiddleware.js';
import { validateRequest } from '../middleware/validateMiddleware.js';
import {
  getAtRiskStudents,
  getDashboardStats,
  getActivityLogs,
  getActivityTimeline,
  getUserActivityReport,
  getDepartmentAnalytics,
  exportActivities,
} from '../controllers/analyticsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * Dashboard and Overview
 */

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/dashboard', parseViewType, getDashboardStats);

/**
 * Activity Tracking and Logs
 */

/**
 * @route   GET /api/analytics/activities
 * @desc    Get activity logs
 * @access  Private
 */
router.get('/activities',
  [
    qv('view').optional().isIn(['micro', 'macro']).withMessage('Invalid view type'),
    qv('days').optional().isInt({ min: 1, max: 365 }).withMessage('days must be 1-365'),
    qv('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1-200'),
    qv('skip').optional().isInt({ min: 0 }).withMessage('skip must be non-negative'),
  ],
  validateRequest,
  parseViewType,
  getActivityLogs
);

/**
 * @route   GET /api/analytics/timeline
 * @desc    Get activity timeline
 * @access  Private
 */
router.get('/timeline', parseViewType, getActivityTimeline);

/**
 * Data Export
 */

/**
 * @route   GET /api/analytics/export
 * @desc    Export activity data
 * @access  Private/HOD/Admin
 */
router.get('/export', 
  requireElevatedPrivilege, 
  [
    qv('format').optional().isIn(['csv', 'json']).withMessage('format must be csv or json'),
    qv('numberOfDays').optional().isInt({ min: 1, max: 365 }).withMessage('numberOfDays must be 1–365'),
    qv('view').optional().isIn(['micro', 'macro']).withMessage('Invalid view type'),
  ],
  validateRequest,
  exportActivities
);

/**
 * User and Department Analytics
 */

/**
 * @route   GET /api/analytics/user/:userId
 * @desc    Get user activity report
 * @access  Private
 */
router.get('/user/:userId', 
  [param('userId').isMongoId().withMessage('Invalid user ID')],
  validateRequest,
  parseViewType, 
  getUserActivityReport);

/**
 * @route   GET /api/analytics/department/at-risk
 * @desc    Get at-risk students for authenticated HOD/Admin scope
 * @access  Private
 */
router.get('/department/at-risk', getAtRiskStudents);

/**
 * @route   GET /api/analytics/department/:departmentId
 * @desc    Get department-level analytics
 * @access  Private/HOD/Admin
 */
router.get('/department/:departmentId', requireElevatedPrivilege, getDepartmentAnalytics);

export default router;
