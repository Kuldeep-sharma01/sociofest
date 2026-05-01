// server/routes/subjects.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignTeacherToSubject,
  getSubjectsByDepartment,
} from "../controllers/subjectController.js";

const router = express.Router();

/**
 * GET Routes - Retrieve Subjects
 * ✅ IMPORTANT: Always declare specific routes before parameterized wildcards (like /:id) to prevent route shadowing.
 */

/**
 * @route   GET /api/subjects
 * @desc    Get all subjects
 * @access  Private
 */
router.get("/", protect, roleCheck(["Admin", "HOD", "Teacher", "Student"]), getAllSubjects);

/**
 * @route   GET /api/subjects/department/:departmentId
 * @desc    Get subjects by department
 * @access  Private
 */
router.get("/department/:departmentId", protect, getSubjectsByDepartment);

/**
 * @route   GET /api/subjects/:id
 * @desc    Get subject by ID
 * @access  Private
 */
router.get("/:id", protect, getSubjectById);

/**
 * POST Routes - Create and Assign
 */

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject
 * @access  Private/Admin/HOD
 */
router.post("/", protect, roleCheck(["Admin", "HOD"]), createSubject);

/**
 * @route   POST /api/subjects/:id/assign
 * @desc    Assign a teacher to a subject
 * @access  Private/HOD/Admin
 */
router.post("/:id/assign", protect, roleCheck(["HOD", "Admin"]), assignTeacherToSubject);

/**
 * PUT Routes - Update
 */

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject details
 * @access  Private/Admin/HOD
 */
router.put("/:id", protect, roleCheck(["Admin", "HOD"]), updateSubject);

/**
 * DELETE Routes - Remove
 */

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete a subject
 * @access  Private/Admin
 */
router.delete("/:id", protect, roleCheck(["Admin"]), deleteSubject);

export default router;
