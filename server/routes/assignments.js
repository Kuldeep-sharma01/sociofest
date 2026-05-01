import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import upload from "../middleware/uploadMiddleware.js";
import { param, body } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";
import {
  createAssignment,
  getAssignmentsBySubject,
  submitAssignment,
  gradeSubmission,
  updateAssignment,
  deleteAssignment,
} from "../controllers/assignmentController.js";

const router = express.Router();

// ✅ Reusable validation
const subjectIdParam = [param("subjectId").isMongoId().withMessage("Invalid Subject ID"), validateRequest];
const assignmentIdParam = [param("id").isMongoId().withMessage("Invalid Assignment ID"), validateRequest];

// --- GET ---
router.get("/:subjectId", protect, subjectIdParam, getAssignmentsBySubject); // ✅ + validation added

// --- POST ---
// ✅ CRITICAL FIX: /:id/submit MUST come before /:subjectId
router.post(
  "/:id/submit",
  protect,
  roleCheck(["Student"]),
  [param("id").isMongoId().withMessage("Invalid Assignment ID"), validateRequest], // ✅ validation added
  upload.array("files", 10),
  submitAssignment,
);

router.post(
  "/:subjectId",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  upload.array("files", 10),
  [
    body("title").trim().notEmpty().isLength({ max: 200 }).withMessage("Title required (max 200 chars)"),
    body("dueDate").isISO8601().withMessage("Invalid date format")
      .custom(v => {
        if (new Date(v).getTime() < Date.now() - 10 * 60000) {
          return Promise.reject("Due date must be in the future");
        }
        return true;
      }),
    validateRequest,
  ],
  createAssignment,
);

// --- PUT ---
// ✅ CRITICAL FIX: /:assignmentId/grade/:studentId MUST come before /:id
router.put(
  "/:assignmentId/grade/:studentId",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  [
    param("assignmentId").isMongoId(), param("studentId").isMongoId(),
    body("grade").optional().isFloat({ min: 0, max: 100 }).withMessage("Grade must be 0–100"),
    body("feedback").optional().isString().isLength({ max: 5000 }),
    validateRequest,
  ],
  gradeSubmission,
);

router.put(
  "/:id",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  upload.array("files", 10),
  assignmentIdParam,
  updateAssignment,
);

// --- DELETE ---
router.delete("/:id", protect, roleCheck(["Teacher", "HOD", "Admin"]), assignmentIdParam, deleteAssignment);

export default router;
