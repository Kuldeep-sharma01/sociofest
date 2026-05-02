import mongoose from "mongoose";
import { validationResult } from "express-validator";
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import WiFiWhitelist from "../models/WiFiWhitelist.js";
import { isIPInRange } from "../utils/network.js";
import { ok, created, badRequest, forbidden, serverError, notFound } from "../utils/index.js";
import { readSystemSettings } from "../utils/systemSettings.js";
import logger from "../utils/logger.js";

/**
 * @desc    Mark attendance for a student
 * @route   POST /api/attendance/mark
 * @access  Private
 */
export const markAttendance = async (req, res) => {
  try {
    const systemSettings = await readSystemSettings();
    const controls = systemSettings.serviceControls || {};
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, "Validation failed", errors.array());
    }

    const { studentId, curriculum: curriculumId, status, recognitionMethod = "manual", recognitionConfidence = 0 } = req.body;

    // 0. Authorization & Student Status Check
    const targetStudent = await User.findById(studentId);
    if (!targetStudent) return notFound(res, "Student not found.");
    if (targetStudent.status !== "Approved") {
      return forbidden(res, `Cannot mark attendance for a student with status: ${targetStudent.status}`);
    }

    // 1. Legitimacy check (WiFi)
    const clientIP = (req.ip || req.connection?.remoteAddress || "").replace(/^::ffff:/, "");
    let wifiVerified = false;
    const whitelistedRanges = await WiFiWhitelist.find({ isActive: true });

    for (const entry of whitelistedRanges) {
      try {
        if (isIPInRange(clientIP, entry.ipRange)) {
          wifiVerified = true;
          break;
        }
      } catch (e) { /* ignore */ }
    }

    // 2. Role-based restrictions
    if (req.user.role.toLowerCase() === "student") {
      if (req.user._id.toString() !== studentId.toString()) {
        return forbidden(res, "Students can only mark their own attendance");
      }
      if (controls.faceRecognitionEnabled !== false && recognitionMethod !== "facial_recognition") {
        return forbidden(res, "Manual attendance requires teacher verification");
      }
      if (controls.wifiEnforcementEnabled !== false && !wifiVerified) {
        return forbidden(res, "Legitimacy check failed: You must be on the campus network to self-mark attendance.");
      }
    }

    // 3. Upsert attendance record
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const attendance = await Attendance.findOneAndUpdate(
      {
        student: studentId,
        curriculum: curriculumId,
        date: { $gte: today, $lt: tomorrow },
      },
      {
        $set: {
          status,
          markedBy: req.user._id,
          recognitionMethod,
          recognitionConfidence,
          wifiVerified,
          ipAddress: clientIP,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          student: studentId,
          curriculum: curriculumId,
          date: new Date(),
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    ok(res, attendance, "Attendance marked successfully");
  } catch (error) {
    logger.error("Error marking attendance", { error: error.message });
    serverError(res);
  }
};

/**
 * @desc    Verify face with Python AI service and mark attendance
 * @route   POST /api/attendance/verify-and-mark
 * @access  Private/Student
 */
export const verifyAndMarkAttendance = async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "Face image required");
    const { curriculum: curriculumId } = req.body;
    if (!curriculumId) return badRequest(res, "Curriculum ID required");

    const systemSettings = await readSystemSettings();
    if (systemSettings.serviceControls?.faceRecognitionEnabled === false) {
      return forbidden(res, "Biometric face recognition is currently disabled by admin.");
    }

    const userId = req.user._id;
    const pythonUrl = process.env.PYTHON_INTERNAL_URL || process.env.PYTHON_URL || "http://localhost:5001";

    // 1. Call Python AI API for Biometric Verification
    const form = new FormData();
    form.append("image", fs.createReadStream(req.file.path));
    form.append("userId", userId.toString());
    form.append("clientLivenessVerified", "true"); // Still sent as legacy, but Python now assessed quality

    const response = await axios.post(`${pythonUrl}/verify-face`, form, {
      headers: { 
        ...form.getHeaders(),
        'Authorization': req.headers.authorization 
      },
    });

    if (response.data.verified) {
      // 2. Verification success -> delegate to markAttendance logic internally
      // Simulate req.body for markAttendance
      req.body = {
        studentId: userId,
        curriculum: curriculumId,
        status: "present",
        recognitionMethod: "facial_recognition",
        recognitionConfidence: response.data.confidence || 1.0
      };
      return markAttendance(req, res);
    } else {
      return forbidden(res, "Biometric verification failed: Face does not match registered profile.");
    }
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message;
    logger.error("Biometric verification error", { status, message });
    return res.status(status).json({ success: false, message });
  } finally {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  }
};

/**
 * @desc    Get attendance stats for a student
 * @route   GET /api/attendance/stats/:studentId
 */
export const getStudentAttendanceStats = async (req, res) => {
  try {
    const { studentId } = req.params;
    const stats = await Attendance.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    ok(res, stats);
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc    Get attendance for a specific curriculum
 * @route   GET /api/attendance/curriculum/:curriculumId
 */
export const getCurriculumAttendance = async (req, res) => {
  try {
    const { curriculumId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(curriculumId)) {
      return badRequest(res, "Invalid curriculum ID");
    }

    const attendance = await Attendance.find({ curriculum: curriculumId })
      .populate("student", "name email rollNumber semester")
      .sort({ date: -1 })
      .lean();

    ok(res, attendance);
  } catch (error) {
    logger.error("Error fetching curriculum attendance", { error: error.message });
    serverError(res);
  }
};

/**
 * @desc    Get attendance for a specific department
 * @route   GET /api/attendance/department/:department
 */
export const getDepartmentAttendance = async (req, res) => {
  try {
    const { department } = req.params;
    
    // Find students in this department
    const students = await User.find({ department, role: 'Student' }).select('_id');
    const studentIds = students.map(s => s._id);

    const attendance = await Attendance.find({ student: { $in: studentIds } })
      .populate("student", "name email rollNumber semester")
      .populate("curriculum", "name subjectId")
      .sort({ date: -1 })
      .lean();

    ok(res, attendance);
  } catch (error) {
    logger.error("Error fetching department attendance", { error: error.message });
    serverError(res);
  }
};
