import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import {
  getAllQuizStats,
  getHodOverview,
  getQuizStats,
  getStudentOverview,
  getTeacherStats,
  getUserCounts,
} from "../controllers/statsController.js";

const router = express.Router();

/**
 * User Count Statistics
 */
router.get("/user-counts", protect, roleCheck(['Admin', 'HOD']), getUserCounts);

/**
 * Quiz Statistics
 */
router.get("/quiz-stats/:quizId", protect, getQuizStats);
router.get("/all-quiz-stats", protect, getAllQuizStats);

/**
 * Role-based Overview Statistics
 */
router.get("/student-overview", protect, getStudentOverview);
router.get("/teacher-overview", protect, getTeacherStats);
router.get("/hod-overview", protect, roleCheck(['Admin', 'HOD']), getHodOverview);

export default router;
