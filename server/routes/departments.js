// server/routes/departments.js
import express from "express";
import {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  assignHod,
  addSubjectToDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";

const router = express.Router();

/**
 * GET Routes - Retrieve Departments
 */

/**
 * @route   GET /api/departments
 * @desc    Get all departments
 * @access  Private
 */
router.get("/", protect, getAllDepartments);

/**
 * @route   GET /api/departments/:id
 * @desc    Get a specific department by ID
 * @access  Private
 */
router.get("/:id", protect, getDepartmentById);

/**
 * POST Routes - Create and Manage
 */

/**
 * @route   POST /api/departments
 * @desc    Create a new department
 * @access  Private/Admin
 */
router.post("/", protect, roleCheck(["Admin"]), createDepartment);

/**
 * @route   POST /api/departments/:id/assignHod
 * @desc    Assign an HOD to a department
 * @access  Private/Admin
 */
router.post("/:id/assignHod", protect, roleCheck(["Admin"]), assignHod);

/**
 * @route   POST /api/departments/:id/addSubject
 * @desc    Add a subject to a department
 * @access  Private/Admin/HOD
 */
router.post("/:id/addSubject", protect, roleCheck(["Admin", "HOD"]), addSubjectToDepartment);

/**
 * PUT Routes - Update
 */

/**
 * @route   PUT /api/departments/:id
 * @desc    Update department details
 * @access  Private/Admin
 */
router.put("/:id", protect, roleCheck(["Admin"]), updateDepartment);

/**
 * DELETE Routes - Remove
 */

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete a department
 * @access  Private/Admin
 */
router.delete("/:id", protect, roleCheck(["Admin"]), deleteDepartment);

export default router;
