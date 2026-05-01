/**
 * server/controllers/analyticsController.js
 * Admin/HOD Dashboard: Statistics, Activity Logs, and Analytics
 * Supports MACRO (global/department) views for authorized users
 */

import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import Department from "../models/Department.js";
import {
  getActivitiesForUser,
  logActivity,
} from "../utils/authorizationHelpers.js";
import { ROLES } from "../utils/rbac.js";
import Attendance from "../models/Attendance.js";
import QuizSubmission from "../models/QuizSubmission.js";
import { ok, badRequest, notFound, forbidden, serverError } from "../utils/index.js";

/**
 * @desc      Get predictive dropout/at-risk students for an HOD's department
 * @route     GET /api/analytics/department/at-risk
 * @access    Private (HOD / Admin)
 */
export const getAtRiskStudents = async (req, res) => {
  try {
    // Ensure the requester is an HOD or Admin
    if (!["HOD", "Admin"].includes(req.user.role)) {
      return forbidden(res, "Not authorized to access departmental analytics.");
    }

    const departmentId = req.user.department;
    if (!departmentId && req.user.role !== "Admin") {
      return badRequest(res, "No department assigned to this HOD.");
    }

    // 1. Fetch all students in the department
    const query = { role: "Student" };
    if (departmentId) query.department = departmentId;

    const students = await User.find(query)
      .select("name rollNumber email _id")
      .lean();
    if (!students.length) return ok(res, { data: [] }, "At-risk students retrieved successfully");

    const studentIds = students.map((s) => s._id);

    // ✅ Scope to current semester (e.g., last 180 days)
    const semesterStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // 2. Fetch Attendance Records
    const attendances = await Attendance.find({
      student: { $in: studentIds },
      date: { $gte: semesterStart },
    }).lean();

    // 3. Fetch Quiz Attempts
    const quizzes = await QuizSubmission.find({
      student: { $in: studentIds },
      submittedAt: { $gte: semesterStart },
    }).lean();

    // 4. Process and Calculate Risk Factors
    const atRiskStudents = [];

    // ✅ Pre-group into Maps before the loop — O(N) lookup instead of O(N²) filter
    const attendanceMap = new Map();
    attendances.forEach(a => {
      const key = a.student.toString();
      if (!attendanceMap.has(key)) attendanceMap.set(key, []);
      attendanceMap.get(key).push(a);
    });

    const quizMap = new Map();
    quizzes.forEach(q => {
      const key = q.student.toString();
      if (!quizMap.has(key)) quizMap.set(key, []);
      quizMap.get(key).push(q);
    });

    for (const student of students) {
      const key = student._id.toString();
      const studentAttendance = attendanceMap.get(key) || [];
      const totalClasses = studentAttendance.length;
      const presentClasses = studentAttendance.filter(
        (a) => a.status?.toLowerCase() === "present",
      ).length;
      const attendancePercentage =
        totalClasses > 0
          ? Math.round((presentClasses / totalClasses) * 100)
          : 100; // Assume 100 if no classes recorded yet

      // Calculate Average Quiz Score
      let totalScore = 0;
      const studentAttempts = quizMap.get(key) || [];
      let quizCount = studentAttempts.length;

      studentAttempts.forEach((attempt) => (totalScore += attempt.score || 0));

      const avgScore = quizCount > 0 ? Math.round(totalScore / quizCount) : 100; // Assume 100 if no quizzes taken

      // 5. Apply Weighted Predictive Thresholds
      let riskScore = 0;
      let riskLevel = "None";
      const riskFactors = [];

      if (attendancePercentage < 75) {
        // Add 2 risk points for every percentage point below 75%
        riskScore += (75 - attendancePercentage) * 2;
        riskFactors.push(`Low attendance (${attendancePercentage}%)`);
      }
      if (avgScore < 60 && quizCount > 0) {
        // Add 1.5 risk points for every percentage point below 60%
        riskScore += (60 - avgScore) * 1.5;
        riskFactors.push(`Low quiz average (${avgScore}%)`);
      }

      const isAtRisk = riskScore >= 20; // Base threshold to be flagged

      if (isAtRisk) {
        // Determine severity based on total accumulated risk score
        if (riskScore >= 60) {
          riskLevel = "High";
        } else if (riskScore >= 40) {
          riskLevel = "Moderate";
        } else {
          riskLevel = "Low";
        }

        atRiskStudents.push({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber || "N/A",
          email: student.email,
          attendance: attendancePercentage,
          avgScore: avgScore,
          riskLevel: riskLevel,
          riskFactor: riskFactors.join(" and "),
        });
      }
    }

    // Sort by risk (High risk first, then by lowest attendance)
    atRiskStudents.sort((a, b) => {
      if (a.riskLevel === "High" && b.riskLevel !== "High") return -1;
      if (a.riskLevel !== "High" && b.riskLevel === "High") return 1;
      return a.attendance - b.attendance;
    });

    ok(res, { data: atRiskStudents }, "At-risk students retrieved successfully");
  } catch (error) {
    console.error("Error fetching at-risk students:", error);
    serverError(res, "Server error generating analytics.");
  }
};

/**
 * @desc Get dashboard statistics
 * @route GET /api/analytics/dashboard?view=macro
 * @access Admin, HOD
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { view = "micro" } = req.query;
    const user = req.user;

    if (view === 'macro' && !['Admin', 'HOD'].includes(user.role)) {
      return forbidden(res, 'Only Admin and HOD can access macro dashboard stats');
    }

    // Determine scope
    let query = {};
    if (user.role === "Admin") {
      // Admin sees global stats
      query = {};
    } else if (user.role === "HOD" && view === "macro") {
      // HOD macro view: department stats
      query = { department: user.department };
    } else {
      // Default: personal stats
      query = { _id: user._id };
    }

    // Get various statistics
    const [
      totalUsers,
      totalEvents,
      totalAssignments,
      totalQuizzes,
      activeUsers,
      recentActivities,
    ] = await Promise.all([
      // Count users
      User.countDocuments(query),

      // Count events
      Event.countDocuments(
        query.department ? { department: query.department } : {},
      ),

      // Count assignments
      Assignment.countDocuments(
        query.department ? { department: query.department } : {},
      ),

      // Count quizzes
      Quiz.countDocuments(
        query.department ? { department: query.department } : {},
      ),

      // Active users (logged in last 7 days)
      User.countDocuments({
        ...query,
        lastSeen: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),

      // Recent activity
      ActivityLog.find({
        ...(user.role === "Admin"
          ? {}
          : user.role === "HOD" && view === "macro"
            ? { departmentId: user.department }
            : { "actor.userId": user._id }),
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("actor.userId", "name"),
    ]);

    const stats = {
      scope:
        view === "macro"
          ? user.role === "Admin"
            ? "global"
            : "department"
          : "personal",
      timestamp: new Date(),
      userStats: {
        total: totalUsers,
        active: activeUsers,
      },
      contentStats: {
        events: totalEvents,
        assignments: totalAssignments,
        quizzes: totalQuizzes,
      },
      recentActivities: recentActivities.map((log) => ({
        id: log._id,
        actor: log.actor.userId?.name || "Unknown",
        action: log.action,
        resource: log.resource,
        timestamp: log.createdAt,
      })),
    };

    ok(res, stats, "Dashboard stats retrieved successfully");

    // Log this analytics view (fire-and-forget)
    logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: "dashboard_viewed",
      resource: "analytics",
      scope: view === "macro" ? "department" : "personal",
      departmentId: user.role === "HOD" ? user.department : null,
      visibility: "personal",
      tags: ["analytics", view],
    }).catch(e => console.error('Activity log failed:', e));
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    serverError(res, "Error fetching statistics");
  }
};

/**
 * @desc Get activity logs with filtering
 * @route GET /api/analytics/activities?view=macro&action=created&resource=event
 * @access Admin, HOD (macro view), Teachers/Students (personal view)
 */
export const getActivityLogs = async (req, res) => {
  try {
    const {
      view = "micro",
      action,
      resource,
      status,
      days = 30,
      limit = 50,
      skip = 0,
    } = req.query;

    const user = req.user;

    // Only Admin and HOD can request macro views
    if (view === "macro" && !["Admin", "HOD"].includes(user.role)) {
      return forbidden(res, "Only Admin and HOD can access macro activity logs");
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200); // 1–200
    const safeSkip  = Math.max(parseInt(skip)  || 0, 0);
    const safeDays  = Math.min(Math.max(parseInt(days)  || 30, 1), 365);

    if (isNaN(safeLimit) || isNaN(safeSkip)) return badRequest(res, 'Invalid pagination parameters');

    // Build filter query
    let filterQuery = {
      createdAt: {
        $gte: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000),
      },
    };

    // Role-based filtering
    if (user.role === "Admin") {
      // Admin sees all (no additional filter)
    } else if (user.role === "HOD" && view === "macro") {
      // HOD macro: see department activities
      filterQuery.departmentId = user.department;
    } else {
      // Personal view: only own activities
      filterQuery["actor.userId"] = user._id;
    }

    // Add optional filters
    if (action) filterQuery.action = action;
    if (resource) filterQuery.resource = resource;
    if (status) filterQuery.status = status;

    // Get total count for pagination
    const totalCount = await ActivityLog.countDocuments(filterQuery);

    // Get paginated logs
    const logs = await ActivityLog.find(filterQuery)
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .skip(safeSkip)
      .populate("actor.userId", "name email role")
      .populate("departmentId", "name")
      .lean();

    ok(res, {
      view,
      scope:
        view === "macro"
          ? user.role === "Admin"
            ? "global"
            : "department"
          : "personal",
      data: logs,
      pagination: {
        total: totalCount,
        limit: safeLimit,
        skip: safeSkip,
        pages: Math.ceil(totalCount / safeLimit),
      },
      filters: {
        action,
        resource,
        status,
        days: safeDays,
      },
    }, "Activity logs retrieved successfully");
  } catch (error) {
    console.error("Error getting activity logs:", error);
    serverError(res, "Error fetching activity logs");
  }
};

/**
 * @desc Get activity timeline (micro view for personal, macro for department)
 * @route GET /api/analytics/timeline?view=micro&days=7
 * @access All authenticated users
 */
export const getActivityTimeline = async (req, res) => {
  try {
    const { view = "micro", days = 7 } = req.query;
    const user = req.user;

    // Fetch activities
    const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), 90);
const activities = await getActivitiesForUser(user, view, { days: safeDays });

    // Group by date for timeline
    const timeline = {};
    activities.forEach((log) => {
      const date = log.createdAt.toISOString().split("T")[0];
      if (!timeline[date]) {
        timeline[date] = [];
      }
      timeline[date].push({
        id: log._id,
        actor: log.actor.userId?.name || log.actor.name,
        action: log.action,
        resource: log.resource,
        resourceName: log.resourceName,
        time: log.createdAt.toISOString(),
      });
    });

    ok(res, {
      view,
      scope: view === "macro" ? "department" : "personal",
      timeline,
      totalActivities: activities.length,
    }, "Activity timeline retrieved successfully");
  } catch (error) {
    console.error("Error getting timeline:", error);
    serverError(res, "Error fetching timeline");
  }
};

/**
 * @desc Get user activity report (admin/HOD viewing specific user)
 * @route GET /api/analytics/user/:userId?view=macro
 * @access Admin, HOD (for own department)
 */
export const getUserActivityReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { view = 'micro', limit = 50, skip = 0 } = req.query;
  const safeLimit = Math.min(parseInt(limit) || 50, 200);
  const safeSkip  = Math.max(parseInt(skip) || 0, 0);
    const requester = req.user;

    // Check if requester can view this user's activities
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return notFound(res, "User not found");
    }

    // Authorization check
    if (requester.role === "Admin") {
      // Admin can view anyone
    } else if (requester.role === "HOD" && view === "macro") {
      // HOD can view department members in macro view
      if (
        !targetUser.department ||
        !requester.department ||
        targetUser.department.toString() !== requester.department.toString()
      ) {
        return forbidden(res, "Can only view activities of users in your department");
      }
    } else if (requester._id.toString() !== userId) {
      // Others can only view their own
      return forbidden(res, "Can only view your own activities");
    }

    // Get user's activities
    const [activities, total] = await Promise.all([
      ActivityLog.find({ "actor.userId": userId })
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .skip(safeSkip)
        .populate("actor.userId", "name email role department")
        .lean(),
      ActivityLog.countDocuments({ "actor.userId": userId }),
    ]);

    // Generate summary
    const actionCounts = {};
    activities.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    ok(res, {
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      view,
      activities: activities.map((log) => ({
        id: log._id,
        action: log.action,
        resource: log.resource,
        resourceName: log.resourceName,
        timestamp: log.createdAt,
        status: log.status,
      })),
      summary: {
        totalActivities: total,
        actionBreakdown: actionCounts,
        lastActivity: activities[0]?.createdAt,
      },
      pagination: {
        total,
        limit: safeLimit,
        skip: safeSkip,
      },
    }, "User activity report retrieved successfully");
  } catch (error) {
    console.error("Error getting user activity report:", error);
    serverError(res, "Error fetching user activity report");
  }
};

/**
 * @desc Get department-wide analytics
 * @route GET /api/analytics/department?departmentId=xyz
 * @access Admin, HOD (own department)
 */
export const getDepartmentAnalytics = async (req, res) => {
  try {
    const departmentId = req.params.departmentId || req.query.departmentId;
    const requester = req.user;

    if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
      return badRequest(res, 'Valid departmentId query parameter is required');
    }

    // Authorization check
    if (
      requester.role !== "Admin" &&
      (requester.role !== "HOD" ||
        requester.department.toString() !== departmentId)
    ) {
      return forbidden(res, "Not authorized to view this department analytics");
    }

    const dept = await Department.findById(departmentId);
    if (!dept) {
      return notFound(res, "Department not found");
    }

    // Get department statistics
    const [
      userCount,
      teacherCount,
      studentCount,
      eventCount,
      assignmentCount,
      quizCount,
      activeUsers,
    ] = await Promise.all([
      User.countDocuments({ department: departmentId }),
      User.countDocuments({ department: departmentId, role: "Teacher" }),
      User.countDocuments({ department: departmentId, role: "Student" }),
      Event.countDocuments({ department: departmentId }),
      Assignment.countDocuments({ department: departmentId }),
      Quiz.countDocuments({ department: departmentId }),
      User.countDocuments({
        department: departmentId,
        lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    ok(res, {
      department: {
        id: dept._id,
        name: dept.name,
      },
      statistics: {
        users: {
          total: userCount,
          teachers: teacherCount,
          students: studentCount,
          active24h: activeUsers,
        },
        content: {
          events: eventCount,
          assignments: assignmentCount,
          quizzes: quizCount,
        },
      },
      timestamp: new Date(),
    }, "Department analytics retrieved successfully");
  } catch (error) {
    console.error("Error getting department analytics:", error);
    serverError(res, "Error fetching department analytics");
  }
};

/**
 * @desc Export activities as CSV (Admin/HOD only)
 * @route GET /api/analytics/export?format=csv&view=macro
 * @access Admin, HOD (macro view)
 */
export const exportActivities = async (req, res) => {
  try {
    const { format = "csv", view = "micro", numberOfDays = 30 } = req.query;
    const user = req.user;

    // Only Admin and HOD can export
    if (!["Admin", "HOD"].includes(user.role)) {
      return forbidden(res, "Only Admin and HOD can export activities");
    }

    // ✅ Validate and clamp numberOfDays
    const rawDays = parseInt(numberOfDays);
    if (isNaN(rawDays) || rawDays < 1) return badRequest(res, 'numberOfDays must be a positive integer');
    const safeDays = Math.min(rawDays, 365); // hard cap at 1 year

    // Build query
    let query = {
      createdAt: {
        $gte: new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000),
      },
    };

    if (user.role === "HOD" && view === "macro") {
      query.departmentId = user.department;
    } else if (view === "micro") {
      query["actor.userId"] = user._id;
    }

    // Get activities
    const activities = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .populate("actor.userId", "name email role")
      .lean();

    if (format === "csv") {
      // Generate CSV
      const csv = generateActivityCSV(activities);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="activities_${new Date().toISOString()}.csv"`,
      );
      res.send(csv);
    } else if (format === "json") {
      ok(res, { data: activities, count: activities.length }, "Activities exported successfully");
    } else {
      badRequest(res, "Invalid format. Use csv or json");
    }

    // Log the export
    await logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: "export_started",
      resource: "activities",
      scope: view === "macro" ? "department" : "personal",
      departmentId: user.role === "HOD" ? user.department : null,
      details: { format, numberOfDays: safeDays },
      visibility: "admin_only",
      tags: ["export"],
    });
  } catch (error) {
    console.error("Error exporting activities:", error);
    serverError(res, "Error exporting activities");
  }
};

/**
 * Helper: Generate CSV from activities
 */
const escCsvField = (value) => {
  const s = String(value ?? '');
  // Prefix formula-triggering chars with a single quote
  const safe = s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')
    ? `'${s}`
    : s;
  // Escape internal double-quotes and wrap in quotes
  return `"${safe.replace(/"/g, '""')}"`;
};

const generateActivityCSV = (activities) => {
  const headers = [
    "Timestamp",
    "Actor",
    "Role",
    "Action",
    "Resource",
    "Resource Name",
    "Status",
  ];

  const rows = activities.map((log) => [
    log.createdAt.toISOString(),
    log.actor.userId?.name || log.actor.name || "Unknown",
    log.actor.role,
    log.action,
    log.resource,
    log.resourceName || "-",
    log.status,
  ].map(escCsvField).join(','));

  const csv = [
    headers.map(escCsvField).join(","),
    ...rows,
  ].join("\n");

  return csv;
};
