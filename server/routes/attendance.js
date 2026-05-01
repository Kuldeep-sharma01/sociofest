import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import WiFiWhitelist from '../models/WiFiWhitelist.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { isIPInRange } from '../utils/network.js';
import { ok, created, badRequest, forbidden, serverError } from '../utils/index.js';
import { readSystemSettings } from "../utils/systemSettings.js";

const router = express.Router();

// Pass-through middleware (Redis removed)
const cacheMiddleware = (prefix) => (req, res, next) => next();

// Cache clearing removed (Redis removed)

/**
 * Mark Attendance
 */

/**
 * @route   POST /api/attendance/mark
 * @desc    Mark attendance for a student
 * @access  Private/Teacher/Admin/HOD/Student
 */
router.post(
  '/mark',
  authenticate,
  authorize('teacher', 'admin', 'student', 'hod'),
  [
    body('studentId')
      .notEmpty().withMessage('Student ID is required')
      .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid student ID format'),
    body('curriculum').notEmpty().withMessage('Curriculum ID is required').isMongoId().withMessage('Invalid Curriculum ID'),
    body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid status'),
    body('recognitionMethod').optional().isIn(['facial_recognition', 'manual', 'qr_code']).withMessage('Invalid recognition method'),
    body('recognitionConfidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1'),
  ],
  async (req, res) => {
    try {
      const systemSettings = await readSystemSettings();
      const controls = systemSettings.serviceControls || {};
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return badRequest(res, 'Validation failed', errors.array());
      }

      const { studentId, curriculum: curriculumId, status, recognitionMethod = 'manual', recognitionConfidence = 0 } = req.body;

      // Server-side WiFi verification to prevent spoofing
      // SECURITY FIX: Never trust x-forwarded-for strictly from the client for security boundaries 
      const clientIP = (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');
      let wifiVerified = false;
      const whitelistedRanges = await WiFiWhitelist.find({ isActive: true });
      
      for (const entry of whitelistedRanges) {
        try {
          if (isIPInRange(clientIP, entry.ipRange)) {
            wifiVerified = true;
            break;
          }
        } catch (e) { /* ignore invalid IP formats */ }
      }

      // Strict security: Students cannot manually tick themselves or others
      if (req.user.role.toLowerCase() === 'student') {
        if (req.user._id.toString() !== studentId.toString()) {
          return forbidden(res, 'Students can only mark their own attendance');
        }
        if (controls.faceRecognitionEnabled !== false && recognitionMethod !== 'facial_recognition') {
          return forbidden(res, 'Manual attendance requires teacher verification');
        }
        if (controls.wifiEnforcementEnabled !== false && !wifiVerified) {
          return forbidden(res, 'Legitimacy check failed: You must be on the campus network to self-mark attendance.');
        }
      }

      // Create start and end of the current day to check for existing records
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Use findOneAndUpdate with upsert to prevent duplicate records on the same day
      const attendance = await Attendance.findOneAndUpdate(
        {
          student: studentId,
          curriculum: curriculumId,
          date: { $gte: today, $lt: tomorrow }
        },
        {
          $set: {
            teacher: req.user.role.toLowerCase() === 'student' ? null : req.user._id,
            status,
            recognitionMethod,
            recognitionConfidence,
            wifiVerified,
            ipAddress: clientIP,
            timestamp: new Date()
          },
          $setOnInsert: {
            date: new Date()
          }
        },
        { new: true, upsert: true }
      );
      
      created(res, attendance, 'Attendance marked successfully');
    } catch (error) {
      serverError(res, error.message);
    }
  }
);

/**
 * Retrieve Attendance - By Student
 */

/**
 * @route   GET /api/attendance/student/:studentId
 * @desc    Get attendance records for a specific student
 * @access  Private
 */
router.get('/student/:studentId', authenticate, cacheMiddleware('attendance:student'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    // ✅ Validate studentId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return badRequest(res, 'Invalid student ID format');
    }

    // ✅ Gate: students can only view their own records
    const role = req.user.role.toLowerCase();
    if (role === 'student' && req.user._id.toString() !== studentId) {
      return forbidden(res, 'Students can only view their own attendance');
    }

    // ✅ Validate before using as Date constructor
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return badRequest(res, 'Invalid startDate format');
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return badRequest(res, 'Invalid endDate format');
    }

    const query = { student: studentId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'name rollNumber')
      .populate('teacher', 'name email')
      .sort({ date: -1 });

    ok(res, attendance, 'Attendance records retrieved successfully');
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * Retrieve Attendance - By Class
 */

/**
 * @route   GET /api/attendance/class/:className
 * @desc    Get attendance records for a class
 * @access  Private/Teacher/Admin/HOD
 */
router.get('/class/:className', authenticate, authorize('teacher', 'admin', 'hod'), cacheMiddleware('attendance:class'), async (req, res) => {
  try {
    const { className } = req.params;
    const { date } = req.query;

    const curricula = await mongoose.model("Curriculum").find({ class: className }).select('_id');
    const curriculumIds = curricula.map(c => c._id);
    const query = { curriculum: { $in: curriculumIds } };

    // ✅ Add a default date window when no date is provided
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query.date = { $gte: targetDate, $lt: nextDay };

    const attendance = await Attendance.find(query)
      .populate('student', 'name rollNumber')
      .populate('teacher', 'name email')
      .sort({ timestamp: -1 });

    ok(res, attendance, 'Attendance records retrieved successfully');
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * @route   GET /api/attendance/curriculum/:curriculumId
 * @desc    Get attendance records for a curriculum
 * @access  Private/Teacher/Admin/HOD
 */
router.get('/curriculum/:curriculumId', authenticate, authorize('teacher', 'admin', 'hod'), cacheMiddleware('attendance:curriculum'), async (req, res) => {
  try {
    const { curriculumId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(curriculumId)) {
      return badRequest(res, 'Invalid curriculum ID format');
    }

    const query = { curriculum: curriculumId };
    const targetDate = date ? new Date(date) : null;
    if (targetDate && !isNaN(targetDate.getTime())) {
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'name rollNumber')
      .populate('teacher', 'name email')
      .populate('curriculum', 'name class')
      .sort({ timestamp: -1 });

    ok(res, attendance, 'Curriculum attendance retrieved successfully');
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * Retrieve Attendance - By Department
 */

/**
 * @route   GET /api/attendance/department/:department
 * @desc    Get attendance records for an entire department
 * @access  Private/Teacher/Admin/HOD
 */
// Get department attendance
router.get('/department/:department', authenticate, authorize('teacher', 'admin', 'hod'), cacheMiddleware('attendance:department'), async (req, res) => {
  try {
    const { department } = req.params;
    const { date } = req.query;

    let departmentId = null;
    if (mongoose.Types.ObjectId.isValid(department)) {
      departmentId = department;
    } else {
      const deptDoc = await Department.findOne({ name: department }).select('_id');
      departmentId = deptDoc?._id || null;
    }

    if (!departmentId) {
      return ok(res, [], 'No department found');
    }

    const students = await User.find({ role: { $in: ['Student', 'student'] }, department: departmentId }).select('_id');
    const studentIds = students.map(s => s._id);
    if (studentIds.length === 0) return ok(res, [], 'No students found in department');

    const query = { student: { $in: studentIds } };

    // ✅ Add a default date window when no date is provided
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    query.date = { $gte: targetDate, $lt: nextDay };

    const attendance = await Attendance.find(query)
      .populate('student', 'name rollNumber department')
      .populate('teacher', 'name')
      .sort({ timestamp: -1 });

    ok(res, attendance, 'Department attendance retrieved successfully');
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * Attendance Statistics
 */

/**
 * @route   GET /api/attendance/stats/student/:studentId
 * @desc    Get attendance statistics for a student
 * @access  Private
 */
// Get attendance statistics
router.get('/stats/student/:studentId', authenticate, cacheMiddleware('attendance:student:stats'), async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ Validate studentId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return badRequest(res, 'Invalid student ID format');
    }

    // ✅ Gate: students can only view their own records
    const role = req.user.role.toLowerCase();
    if (role === 'student' && req.user._id.toString() !== studentId) {
      return forbidden(res, 'Students can only view their own attendance stats');
    }

    const attendance = await Attendance.find({ student: studentId });

    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

    ok(res, {
      total,
      present,
      absent,
      late,
      percentage,
    }, 'Attendance statistics retrieved successfully');
  } catch (error) {
    serverError(res, error.message);
  }
});

export default router;
