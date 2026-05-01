import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import rateLimit from "express-rate-limit";
import { query } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";

// Import existing controller logic required by the frontend Admin Service
import {
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from "../controllers/userController.js";

import {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";

import {
  getDashboardStats,
  getActivityLogs,
  exportActivities,
} from "../controllers/analyticsController.js";

import { getUserCounts } from "../controllers/statsController.js";
import { getResourceEditHistory } from "../controllers/governanceController.js";
import {
  getEmailSettings,
  getSystemSettings,
  updateSystemSettings,
  getFfmpegConfig,
  updateFfmpegConfig
} from "../controllers/settingsController.js";

const router = express.Router();

// Enforce authentication and Admin role for all routes in this file
router.use(protect);
router.use(roleCheck(["Admin"]));

const settingsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: {
    message: "Too many settings update attempts, please try again later.",
  },
});

const actionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit bulk destructive/sensitive actions
  message: {
    message: "Too many administrative actions performed, please wait.",
  },
});

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict limit on data exports to prevent CPU/Memory exhaustion (DoS)
  message: {
    message: "Too many data export requests, please try again later.",
  },
});

const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // More permissive than export but still bounded
  message: { message: 'Too many audit log requests, please slow down.' },
});

const statsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20,
  message: { message: 'Too many stats requests.' },
});

/**
 * Overview & System Statistics
 */

router.get("/overview", statsLimiter, getDashboardStats);
router.get("/stats", statsLimiter, getUserCounts);

/**
 * User Management
 */

router.get("/users", getAllUsers);
router.put("/users/:id/role", actionLimiter, updateUserRole);
router.put("/users/:id/status", actionLimiter, updateUserStatus);
router.delete("/users/:id", actionLimiter, deleteUser);

/**
 * Department Management
 */

router.get("/departments", getAllDepartments);
router.post("/departments", actionLimiter, createDepartment);
router.put("/departments/:id", actionLimiter, updateDepartment);
router.delete("/departments/:id", actionLimiter, deleteDepartment);

/**
 * Audit Logs and Activity Tracking
 */

router.get("/logs", auditLimiter, getActivityLogs);
router.get("/audit/:resourceType/:resourceId", auditLimiter, getResourceEditHistory);

/**
 * Data Export
 */

router.get(
  "/export",
  exportLimiter,
  [
    query("format").optional().isIn(["csv", "json"]),
    query("view").optional().isIn(["micro", "macro"]),
    query("numberOfDays").optional().isInt({ min: 1, max: 365 }),
  ],
  validateRequest,
  exportActivities
);

/**
 * System and Email Settings
 */

router.get("/settings", getSystemSettings);
router.put("/settings", settingsLimiter, updateSystemSettings);
router.get("/email-settings", getEmailSettings);

// Admin Configuration Routes
router.get("/ffmpeg-config", settingsLimiter, getFfmpegConfig);
router.put("/ffmpeg-config", settingsLimiter, updateFfmpegConfig);

export default router;
