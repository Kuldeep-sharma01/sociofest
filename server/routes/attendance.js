import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { 
  markAttendance, 
  verifyAndMarkAttendance, 
  getStudentAttendanceStats,
  getCurriculumAttendance,
  getDepartmentAttendance
} from '../controllers/attendanceController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });

/**
 * @route   POST /api/attendance/mark
 * @desc    Mark attendance for a student (Manual or Auto)
 * @access  Private
 */
router.post(
  '/mark',
  authenticate,
  authorize('teacher', 'admin', 'student', 'hod'),
  [
    body('studentId').notEmpty().isMongoId(),
    body('curriculum').notEmpty().isMongoId(),
    body('status').isIn(['present', 'absent', 'late', 'excused']),
  ],
  markAttendance
);

/**
 * @route   POST /api/attendance/verify-and-mark
 * @desc    Verify face and mark attendance automatically
 * @access  Private/Student
 */
router.post(
  '/verify-and-mark',
  authenticate,
  authorize('student'),
  upload.single('image'),
  verifyAndMarkAttendance
);

/**
 * @route   GET /api/attendance/stats/:studentId
 * @desc    Get attendance summary for a student
 * @access  Private
 */
router.get(
  '/stats/:studentId',
  authenticate,
  getStudentAttendanceStats
);

/**
 * @route   GET /api/attendance/curriculum/:curriculumId
 * @desc    Get attendance for a curriculum
 * @access  Private
 */
router.get(
  '/curriculum/:curriculumId',
  authenticate,
  getCurriculumAttendance
);

/**
 * @route   GET /api/attendance/department/:department
 * @desc    Get attendance for a department
 * @access  Private
 */
router.get(
  '/department/:department',
  authenticate,
  getDepartmentAttendance
);

export default router;
