import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import upload from "../middleware/uploadMiddleware.js";
import { param } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";
import {
  uploadMaterial,
  getMaterialsBySubject,
  deleteMaterial,
} from "../controllers/materialController.js";

const router = express.Router();

/**
 * Reusable Validation Rules
 */
const subjectIdValidation = [param("subjectId").isMongoId().withMessage("Invalid Subject ID format")];
const materialIdValidation = [param("id").isMongoId().withMessage("Invalid Material ID format")];

/**
 * GET Routes - Retrieve Materials
 */

/**
 * @route   GET /api/materials/:subjectId
 * @desc    Get all materials for a subject
 * @access  Private
 */
router.get("/:subjectId", protect, subjectIdValidation, validateRequest, getMaterialsBySubject);

/**
 * POST Routes - Upload Materials
 */

/**
 * @route   POST /api/materials/:subjectId
 * @desc    Upload learning materials to a subject
 * @access  Private/Teacher/HOD/Admin
 */
router.post(
  "/:subjectId",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  upload.array("files", 10),
  subjectIdValidation,
  validateRequest,
  uploadMaterial,
);

/**
 * DELETE Routes - Remove Materials
 */

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete a material file
 * @access  Private/Teacher/HOD/Admin
 */
router.delete(
  "/:id",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  materialIdValidation,
  validateRequest,
  deleteMaterial,
);

export default router;
