// /routes/certificates.js
import express from "express";
import { param, body } from "express-validator";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import { validateRequest } from "../middleware/validateMiddleware.js";
import {
  issueCertificate,
  getAllCertificates,
  getCertificatesByUser,
  downloadCertificate,
  deleteCertificate,
} from "../controllers/certificateController.js";

const router = express.Router();

/**
 * Reusable Validation Rules
 */
const userIdValidation = [param("userId").isMongoId().withMessage("Invalid User ID format")];
const certIdValidation = [param("id").isMongoId().withMessage("Invalid Certificate ID format")];

/**
 * GET Routes - Retrieve Certificates
 */

/**
 * @route   GET /api/certificates
 * @desc    Get all certificates
 * @access  Private/Teacher/Admin
 */
router.get("/", protect, roleCheck(["Teacher", "Admin"]), getAllCertificates);

/**
 * @route   GET /api/certificates/user/:userId
 * @desc    Get certificates for a specific user
 * @access  Private
 */
router.get("/user/:userId", protect, userIdValidation, validateRequest, getCertificatesByUser);

/**
 * @route   GET /api/certificates/download/:id
 * @desc    Download a certificate
 * @access  Private
 */
router.get("/download/:id", protect, certIdValidation, validateRequest, downloadCertificate);

/**
 * POST Routes - Create Certificates
 */

/**
 * @route   POST /api/certificates
 * @desc    Issue a new certificate to a student
 * @access  Private/Teacher/Admin
 */
router.post(
  "/",
  protect,
  roleCheck(["Teacher", "Admin"]),
  [
    body("studentId").isMongoId().withMessage("Invalid Student ID format"),
    body("eventId").optional().isMongoId().withMessage("Invalid Event ID format"),
    body("quizId").optional().isMongoId().withMessage("Invalid Quiz ID format"),
  ],
  validateRequest,
  issueCertificate
);

/**
 * DELETE Routes - Remove Certificates
 */

/**
 * @route   DELETE /api/certificates/:id
 * @desc    Delete a certificate
 * @access  Private/Admin
 */
router.delete("/:id", protect, roleCheck(["Admin"]), certIdValidation, validateRequest, deleteCertificate);

export default router;
