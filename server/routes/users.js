// server/routes/users.js
import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  bulkUpdateStatus,
  bulkUpdateSemester,
  bulkUploadUsers,
  updateUser,
  changePassword,
  deleteUser,
  getDepartments,
  getSem,
  getDepartmentHODKeys,
  getSubjects,
  getStudentProfile,
  getTeacherProfile,
  getHODProfile,
  updateUserProfile,
  updateStudentSemester,
  addEmail,
  verifyNewEmail,
  resendNewEmailOTP,
  clearFaceRegistration,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import { ROLES, VALID_ROLES } from "../utils/rbac.js";
import upload from "../middleware/uploadMiddleware.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";

const router = express.Router();

// ✅ Add input validation to PUT /:id
const updateUserValidation = [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("role").optional().isIn(VALID_ROLES).withMessage("Invalid role"),
  body("department").optional().trim().notEmpty().withMessage("Department cannot be empty"),
];

// ==========================================
// 1. NAMED / BULK ROUTES
// ==========================================

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin or HOD only)
 * @access  Private/Admin/HOD
 */
router.get(
  "/",
  protect,
  roleCheck([ROLES.ADMIN, ROLES.HOD, ROLES.TEACHER]),
  getAllUsers,
);

// Bulk operations
router.put("/bulk-status",   protect, roleCheck([ROLES.ADMIN, ROLES.HOD]),          bulkUpdateStatus);
router.put("/bulk-semester", protect, roleCheck([ROLES.ADMIN, ROLES.HOD, ROLES.TEACHER]), bulkUpdateSemester);
router.post("/bulk-upload",  protect, roleCheck([ROLES.ADMIN, ROLES.HOD]), upload.single("file"), bulkUploadUsers);

// Email management routes
/**
 * @route   POST /api/users/add-email
 * @desc    Add a new email to user profile
 * @access  Private
 */
router.post("/add-email", protect, [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address")
], validateRequest, addEmail);

/**
 * @route   POST /api/users/verify-email
 * @desc    Verify newly added email with OTP
 * @access  Private
 */
router.post("/verify-email", protect, [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),
  body("otp").isLength({ min: 6, max: 6 }).isNumeric().withMessage("OTP must be exactly 6 digits")
], validateRequest, verifyNewEmail);
router.post("/resend-email-otp", protect, resendNewEmailOTP);

// Department and subject related routes
router.get("/departments", getDepartments);
router.get("/hods/department/:name", getSem);
router.get("/hods/department/:name/keys", protect, getDepartmentHODKeys);
router.get("/teachers/department/:name/semester/:semester", getSubjects);

// ==========================================
// 2. PROFILE ROUTES
// ==========================================

/**
 * @route   GET /api/users/student-profile/:userId
 * @desc    Get a student's profile by their user ID
 * @access  Private
 */
router.get("/student-profile/:userId", protect, getStudentProfile);

/**
 * @route   GET /api/users/teacher-profile/:userId
 * @desc    Get a teacher's profile by their user ID
 * @access  Private
 */
router.get("/teacher-profile/:userId", protect, getTeacherProfile);

/**
 * @route   GET /api/users/hod-profile/:userId
 * @desc    Get an HOD's profile by their user ID
 * @access  Private
 */
router.get("/hod-profile/:userId", protect, getHODProfile);

/**
 * @route   PUT /api/users/profile/:id
 * @desc    Update user's own profile details
 * @access  Private (Self or Admin)
 */
router.put(
  "/profile/:id",
  protect,
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  updateUserProfile,
);

// ==========================================
// 3. WILDCARD ROUTES (/:id)
// ==========================================

/**
 * @route   GET /api/users/:id
 * @desc    Get a specific user by ID
 * @access  Private
 */
router.get("/:id",           protect,                                                 getUserById);
router.put("/:id",           protect, updateUserValidation, validateRequest,          updateUser);
router.put("/:id/status",    protect, roleCheck([ROLES.ADMIN, ROLES.HOD, ROLES.TEACHER]), updateUserStatus);
router.put("/:id/role",      protect, roleCheck([ROLES.ADMIN]),                       updateUserRole);
router.put("/:id/password",  protect,                                                 changePassword);
router.post("/:id/clear-face", protect,                                                clearFaceRegistration);
router.put("/:id/semester",  protect, roleCheck([ROLES.ADMIN, ROLES.HOD, ROLES.TEACHER]), updateStudentSemester);
router.delete("/:id",        protect, roleCheck([ROLES.ADMIN]),                       deleteUser);

export default router;
