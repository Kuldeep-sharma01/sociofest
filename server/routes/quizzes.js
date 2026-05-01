// /routes/quizzes.js
import express from "express";
import {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  getQuizzesByTeacher,
  submitQuiz,
  updateQuiz,
  getQuizLeaderboard,
  closeQuiz,
  deleteQuiz,
  flagQuizAttempt,
} from "../controllers/quizController.js";
import { roleCheck } from "../middleware/roleCheck.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST Routes - Create and Submissions
 */

/**
 * @route   POST /api/quizzes
 * @desc    Create a new quiz
 * @access  Private/Teacher/HOD/Admin
 */
router.post("/", protect, roleCheck(["Teacher", "HOD", "Admin"]), createQuiz);

/**
 * @route   POST /api/quizzes/:id/submit
 * @desc    Submit quiz answers (Student)
 * @access  Private/Student
 */
router.post("/:id/submit", protect, roleCheck(["Student"]), submitQuiz);

/**
 * @route   POST /api/quizzes/:id/flag
 * @desc    Flag a quiz attempt (suspicious activity)
 * @access  Private/Student
 */
router.post("/:id/flag", protect, roleCheck(["Student"]), flagQuizAttempt);

/**
 * GET Routes - Retrieve Quizzes
 */

// ✅ Specific named routes must always be declared before parameterized routes
/**
 * @route   GET /api/quizzes
 * @desc    Get all quizzes
 * @access  Private
 */
router.get("/", protect, getAllQuizzes);

/**
 * @route   GET /api/quizzes/teacher/:teacherId
 * @desc    Get quizzes by a specific teacher
 * @access  Private
 */
router.get("/teacher/:teacherId", protect, getQuizzesByTeacher);

/**
 * @route   GET /api/quizzes/:id/leaderboard
 * @desc    Get the top performers for a quiz
 * @access  Private/Teacher/HOD/Admin
 */
router.get(
  "/:id/leaderboard",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  getQuizLeaderboard,
);

/**
 * @route   GET /api/quizzes/:id
 * @desc    Get a single quiz by ID
 * @access  Private
 */
router.get("/:id", protect, getQuizById);

/**
 * PUT Routes - Update Quiz
 */

/**
 * @route   PUT /api/quizzes/:id
 * @desc    Update a quiz
 * @access  Private/Teacher/HOD/Admin
 */
router.put("/:id", protect, roleCheck(["Teacher", "HOD", "Admin"]), updateQuiz);

/**
 * POST Routes - Quiz Management
 */

/**
 * @route   POST /api/quizzes/:id/close
 * @desc    Close a quiz to new submissions
 * @access  Private/Teacher/HOD/Admin
 */
router.post(
  "/:id/close",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  closeQuiz,
);

/**
 * DELETE Routes - Remove
 */

/**
 * @route   DELETE /api/quizzes/:id
 * @desc    Delete a quiz
 * @access  Private/Teacher/HOD/Admin
 */
router.delete(
  "/:id",
  protect,
  roleCheck(["Teacher", "HOD", "Admin"]),
  deleteQuiz,
);

export default router;
