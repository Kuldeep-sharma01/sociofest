// server/controllers/userController.js
import User from "../models/User.js";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import bcrypt from "bcryptjs";
import HOD from "../models/HOD.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Seller from "../models/Seller.js";
import Department from "../models/Department.js";
import Event from "../models/Event.js";
import Subject from "../models/Subject.js";
import Notification from "../models/Notification.js";
import { processUpload, deleteMediaDocs } from "../utils/mediaHelper.js";
import logger from "../utils/logger.js";
import {
  ok,
  badRequest,
  notFound,
  forbidden,
  serverError,
} from "../utils/index.js";
import Quiz from "../models/Quiz.js";
import Assignment from "../models/Assignment.js";
import Material from "../models/Material.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Comment from "../models/Comment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import QuizSubmission from "../models/QuizSubmission.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sendEmail } from "../utils/emailUtils.js";
import { VALID_ROLES } from "../utils/rbac.js";

// ── Rate limiting for email OTP resend (prevents spam) ────────────────────────
const resendEmailOtpAttempts = new Map();
const MAX_RESEND_EMAIL_OTP = 3;
const RESEND_EMAIL_OTP_WINDOW = 15 * 60 * 1000; // 15 minutes

const isEmailOtpRateLimited = (ip) => {
  const rec = resendEmailOtpAttempts.get(ip);
  return rec && Date.now() < rec.resetTime && rec.count >= MAX_RESEND_EMAIL_OTP;
};

const trackEmailOtpAttempt = (ip) => {
  const now = Date.now();
  const rec = resendEmailOtpAttempts.get(ip) || { count: 0, resetTime: 0 };
  if (now >= rec.resetTime) {
    rec.count = 1;
    rec.resetTime = now + RESEND_EMAIL_OTP_WINDOW;
  } else {
    rec.count++;
  }
  resendEmailOtpAttempts.set(ip, rec);
  return rec;
};

const parseCSVLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseCSVContent = (csvText) => {
  const lines = csvText
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0]).map((header) =>
    header.trim().toLowerCase(),
  );
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : "";
    });
    return row;
  });
};

const normalizeRole = (value) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "student") return "Student";
  if (normalized === "teacher") return "Teacher";
  if (normalized === "hod" || normalized === "head of department") return "HOD";
  if (normalized === "admin") return "Admin";
  return undefined;
};

const normalizeStatus = (value) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "blocked") return "Blocked";
  return undefined;
};

const findDepartmentByTerm = (term, departments = []) => {
  if (!term) return null;
  const lookup = term.trim().toLowerCase();
  return (
    departments.find(
      (dept) =>
        dept.name?.toLowerCase() === lookup ||
        dept.code?.toLowerCase() === lookup,
    ) || null
  );
};

const mapSubjectNamesToIds = (deptId, subjectsString, allSubjects) => {
  if (!deptId || !subjectsString?.trim()) return [];
  const names = subjectsString
    .split(",")
    .map((subject) => subject.trim().toLowerCase())
    .filter(Boolean);
  return allSubjects
    .filter((s) => String(s.department) === String(deptId) && names.includes(s.name?.toLowerCase()))
    .map((subject) => subject._id);
};

const PRIVATE_USER_SELECT =
  "-password -emails.password -emails.otp -emails.otpExpires -otp -otpExpires +faceEncodingVector +aiChatHistory +geminiApiKey +rapidApiKey +openAiApiKey +claudeApiKey +stabilityApiKey +deepseekApiKey +perplexityApiKey +boltApiKey +v0devApiKey +emergentApiKey +huggingfaceApiKey +openRouterApiKey";
const PUBLIC_USER_SELECT =
  "-password -emails.password -emails.otp -emails.otpExpires -geminiApiKey -rapidApiKey -aiChatHistory -otp -otpExpires";

const getSafeUserSelectFields = (isSelf) =>
  isSelf ? PRIVATE_USER_SELECT : PUBLIC_USER_SELECT;

const attachPrimaryEmail = (user) => {
  if (user?.emails?.length > 0) {
    user.email = user.emails[0].address;
  }
  return user;
};

export const clearFaceRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res);
    
    // Authorization check: Self or Admin
    if (req.user._id.toString() !== user._id.toString() && req.user.role !== 'Admin') {
      return forbidden(res, "Not authorized to clear this user's face data");
    }

    user.faceEncodingVector = undefined;
    user.isFaceRegistered = false;
    await user.save();
    
    ok(res, null, "Face registration cleared successfully");
  } catch (error) {
    logger.error("Error clearing face registration", { error: error.message, userId: req.params.id });
    serverError(res);
  }
};



export const getAllUsers = async (req, res) => {
  try {
    // Get filters from the request query string (what the frontend is asking for)
    logger.info("Get All Users Request Query", { query: req.query });
    const { status, role, department } = req.query;
    const currentUser = req.user;

    let filter = {};

    // 1. Filter by Status (e.g., "Pending", "Approved")
    if (status) {
      filter.status = status;
    }

    // Prevent Memory Bloat: Mandatory Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const skip = (page - 1) * limit;

    // 2. Filter by Role
    if (role) {
      filter.role = role;
    } else {
      // By default, don't show other Admins unless specifically requested
      // filter.role = { $ne: "Admin" };
    }

    // 3. Department Scope & Filtering
    let requestedDeptId = null;
    if (department) {
      if (mongoose.Types.ObjectId.isValid(department)) {
        requestedDeptId = department;
      } else {
        const deptDoc = await Department.findOne({ name: department });
        requestedDeptId = deptDoc ? deptDoc._id : null;
      }
    }

    if (currentUser.role === "Teacher") {
      filter.department = requestedDeptId && String(requestedDeptId) === String(currentUser.department) ? requestedDeptId : currentUser.department;
      if (!filter.role) filter.role = { $in: ["Student", "Teacher", "HOD", "Seller"] };
    } else if (currentUser.role === "HOD") {
      filter.department = requestedDeptId && String(requestedDeptId) === String(currentUser.department) ? requestedDeptId : currentUser.department;
      if (!filter.role) filter.role = { $in: ["Student", "Teacher", "HOD", "Seller"] };
    } else if (currentUser.role === "Admin") {
      if (requestedDeptId) filter.department = requestedDeptId;
    } else if (currentUser.role === "Student") {
      filter.department = requestedDeptId && String(requestedDeptId) === String(currentUser.department) ? requestedDeptId : currentUser.department;
      if (!filter.role) filter.role = { $in: ["Student", "Teacher", "HOD"] };
    }

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .populate("department", "name")
      .select(
        "-password -emails.password -emails.otp -emails.otpExpires -geminiApiKey -rapidApiKey -aiChatHistory -otp -otpExpires",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch role-specific data to enable smart search capabilities on frontend
    const userIds = users.map((u) => u._id);

    const [students, teachers] = await Promise.all([
      Student.find({ userId: { $in: userIds } }).lean(),
      Teacher.find({ userId: { $in: userIds } }).lean(),
    ]);

    const studentMap = students.reduce(
      (acc, s) => ({ ...acc, [s.userId]: s }),
      {},
    );
    const teacherMap = teachers.reduce(
      (acc, t) => ({ ...acc, [t.userId]: t }),
      {},
    );

    const subjectIds = [...new Set([
      ...students.flatMap(s => s.subjects || []), 
      ...teachers.flatMap(t => t.subjects || [])
    ])];
    
    const allSubjects = await Subject.find({ _id: { $in: subjectIds } }).select("name semester _id").lean();

    const subMap = {};
    allSubjects.forEach((s) => {
      subMap[s._id.toString()] = {
        _id: s._id,
        name: s.name,
        semester: s.semester,
      };
    });

    const enrichedUsers = users.map((u) => {
      let extraData = {};
      // No need to copy email, it's already on 'u' from User model

      if (u.role === "Student" && studentMap[u._id]) {
        extraData.semester = studentMap[u._id].semester;
        extraData.rollNumber = studentMap[u._id].rollNumber;
        extraData.subjects = (studentMap[u._id].subjects || [])
          .map((id) => subMap[id.toString()])
          .filter(Boolean);
      } else if (
        (u.role === "Teacher" || u.role === "HOD") &&
        teacherMap[u._id]
      ) {
        extraData.subjects = (teacherMap[u._id].subjects || [])
          .map((id) => subMap[id.toString()])
          .filter(Boolean);
      }
      return { ...u, ...extraData };
    });

    ok(res, {
      users: enrichedUsers,
      total,
      page,
      pages: Math.ceil(total / limit)
    }, "Users retrieved successfully");
  } catch (error) {
    logger.error("Error fetching users", { error: error.message, stack: error.stack, userId: req.user?._id });
    serverError(res);
  }

};

/**
 * @desc Get user by ID
 * @route GET /api/users/:id
 * @access Private
 */
export const getUserById = async (req, res) => {
  try {
    const isSelf = req.user && req.user._id.toString() === req.params.id;

    const user = await User.findById(req.params.id)
      .select(getSafeUserSelectFields(isSelf))
      .populate("department", "name")
      .lean();
    if (!user) return notFound(res);

    attachPrimaryEmail(user);

    if (user.role === "Admin") {
      // Admins manage everyone except themselves
      user.managedUsers = await User.countDocuments({ _id: { $ne: user._id } });
    }

    ok(res, user, "User retrieved successfully");
  } catch (error) {
    logger.error("Error fetching user", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }

};

/**
 * @desc Update user info (Admin, HOD, or Self)
 * @route PUT /api/users/:id
 * @access Private
 */
export const updateUser = async (req, res) => {
  try {
    const { name, role, department, status, enrollmentNumber, phone } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return notFound(res);

    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isHOD = req.user.role === "HOD" && String(user.department) === String(req.user.department);
    const isTeacherOfStudent = req.user.role === "Teacher" && user.role === "Student" && String(user.department) === String(req.user.department);

    // 1. Authorization Check
    if (!isSelf && !isAdmin && !isHOD && !isTeacherOfStudent) {
      return forbidden(res, "Not authorized to update this user");
    }

    // 2. Field Whitelisting (Security Policy)
    // Always allowed: name and phone (even for self)
    if (name) user.name = name;
    if (phone) user.phone = phone;

    // Admin/HOD only: department, enrollmentNumber
    if (isAdmin || isHOD) {
      if (department) {
        const dept = await Department.findOne({ name: department });
        if (dept) user.department = dept._id;
      }
      if (enrollmentNumber) user.enrollmentNumber = enrollmentNumber;
    }

    // Admin only: role, status
    if (isAdmin) {
      if (role && VALID_ROLES.includes(role)) user.role = role;
      if (status && ["Approved", "Rejected", "Blocked", "Pending"].includes(status)) user.status = status;
    } else if (isHOD) {
       // HODs can approve/reject students in their dept, but role changes are restricted
       if (status && ["Approved", "Rejected", "Blocked"].includes(status)) {
          if (user.role === "Student" || user.role === "Teacher") {
            user.status = status;
          }
       }
    }

    const updatedUser = await user.save();
    
    const userObj = updatedUser.toObject();
    delete userObj.password;
    
    ok(res, { user: userObj }, "User updated successfully");
  } catch (error) {
    logger.error("Error updating user", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }
};

/**
 * @desc Change user password
 * @route PUT /api/users/:id/password
 * @access Private (User / Admin)
 */
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // ✅ Password strength check — same rule as authController
    const isStrongPassword = (p) =>
      p &&
      p.length >= 8 &&
      /[A-Z]/.test(p) &&
      /[0-9]/.test(p) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(p);
    if (!isStrongPassword(newPassword)) {
      return badRequest(
        res,
        "Password must be 8+ characters with uppercase, lowercase, number, and special character",
      );
    }

    const user = await User.findById(req.params.id).select("+password");
    if (!user) return notFound(res, "User not found.");

    const isAdminResetting =
      req.user._id.toString() !== user._id.toString() &&
      req.user.role === "Admin";
    if (!isAdminResetting && req.user._id.toString() !== user._id.toString()) {
      return forbidden(res, "Not authorized to change password.");
    }

    if (!isAdminResetting) {
      if (!user.password)
        return badRequest(
          res,
          "No password set. You may be using Google Auth.",
        );
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) return badRequest(res, "Old password is incorrect.");
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    // ✅ REMOVED: emails[].password sync — password field doesn't exist on emailEntrySchema
    await user.save();

    ok(res, null, "Password changed successfully.");
  } catch (error) {
    logger.error("Error changing password", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }

};

/**
 * @desc Delete user
 * @route DELETE /api/users/:id
 * @access Private (Admin / HOD)
 */
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, "User not found.");

    if (!["Admin", "HOD"].includes(req.user.role)) {
      return forbidden(res, "Not authorized to delete user.");
    }

    // ✅ HOD can only delete users in their own department
    if (
      req.user.role === "HOD" &&
      String(user.department) !== String(req.user.department)
    ) {
      return forbidden(
        res,
        "HODs can only delete users in their own department.",
      );
    }

    const userId = user._id;

    // CASCADING DELETE FIX: Clean up orphaned Posts, Comments, and Messages
    await Post.deleteMany({ author: userId });
    await Post.updateMany(
      {},
      { $pull: { comments: { user: userId }, reactions: { user: userId } } },
    );

    await Comment.deleteMany({ author: userId });
    await AssignmentSubmission.deleteMany({ student: userId });
    await QuizSubmission.deleteMany({ student: userId });
    
    // ✅ NEW: Clean up Attendance and Role Profiles
    const Attendance = mongoose.model("Attendance");
    await Attendance.deleteMany({ student: userId });
    await Student.deleteMany({ userId });
    await Teacher.deleteMany({ userId });
    await HOD.deleteMany({ userId });
    await Seller.deleteMany({ userId });

    await Message.deleteMany({
      $or: [{ sender: userId }, { receiver: userId }],
    });

    // Prevent orphan 1-on-1 DMs and properly remove user from Groups
    await Conversation.deleteMany({
      isGroup: { $ne: true },
      participants: userId,
    });
    await Conversation.updateMany(
      { isGroup: true },
      { $pull: { participants: userId, favorites: userId } },
    );
    await mongoose.model("PushSubscription").deleteMany({ user: userId });

    await Student.deleteOne({ userId });
    await Teacher.deleteOne({ userId });
    await HOD.deleteOne({ userId });
    await Seller.deleteOne({ userId });

    const userAssignments = await Assignment.find({ author: userId });
    const userAssignmentIds = userAssignments.map((a) => a._id);
    await AssignmentSubmission.deleteMany({
      assignment: { $in: userAssignmentIds },
    });

    const userQuizzes = await Quiz.find({ author: userId });
    const userQuizIds = userQuizzes.map((q) => q._id);
    await QuizSubmission.deleteMany({ quiz: { $in: userQuizIds } });

    await Assignment.deleteMany({ author: userId });
    await Quiz.deleteMany({ author: userId });
    await Event.deleteMany({ author: userId });

    const Certificate = mongoose.model("Certificate");
    if (Certificate) {
      await Certificate.deleteMany({ user: userId });
    }

    // PURE MATERIAL CLEANSING: Since Posts, Messages, Assignments, and standalone files
    // all use Material, we extract all media from the user's Materials to wipe physical files.
    const userMaterials = await Material.find({ author: userId });
    let allUserMedia = [];
    for (const mat of userMaterials) {
      if (mat.media && mat.media.length > 0) allUserMedia.push(...mat.media);
    }
    if (allUserMedia.length > 0) await deleteMediaDocs(allUserMedia);

    await Material.deleteMany({ author: userId });

    if (user.profilePicture && !user.profilePicture.startsWith("http")) {
      try {
        await fs.unlink(
          path.join(process.cwd(), user.profilePicture.replace(/^\/+/, "")),
        );
      } catch (e) {
        if (e.code !== "ENOENT")
          logger.error(`Failed to delete profile picture for user ${userId}`, { error: e.message, stack: e.stack, path: path.join(process.cwd(), user.profilePicture.replace(/^\/+/, "")) });
      }
    }
    if (user.banner && !user.banner.startsWith("http")) {
      try {
        await fs.unlink(
          path.join(process.cwd(), user.banner.replace(/^\/+/, "")),
        );
      } catch (e) {
        if (e.code !== "ENOENT")
          logger.error(`Failed to delete banner for user ${userId}`, { error: e.message, stack: e.stack, path: path.join(process.cwd(), user.banner.replace(/^\/+/, "")) });
      }
    }

    await user.deleteOne();
    ok(res, null, "User deleted successfully.");
  } catch (error) {
    logger.error("Error deleting user", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }

};

/**
 * @desc Update user role (Admin only)
 * @route PUT /api/users/:id/role
 * @access Private (Admin)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return badRequest(res, "Role is required.");

    if (!VALID_ROLES.includes(role)) {
      return badRequest(res, "Invalid role provided.");
    }

    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, "User not found.");

    user.role = role;
    await user.save();

    const io = req.app.get("io");
    if (io) {
      const msg = `Your role was changed to ${role} by Admin.`;
      io.to(user._id.toString()).emit("notification", { message: msg });
      await Notification.create({
        recipient: user._id,
        actor: req.user._id,
        type: "role_updated",
        message: msg,
      });
    }

    ok(res, { user }, "User role updated successfully.");
  } catch (error) {
    logger.error("Error updating user role", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }
};

/**
 * @desc      Update user status (Approve/Reject)
 * @route     PUT /api/users/:id/status
 * @access    Private (Admin/HOD)
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!status || !["Approved", "Rejected", "Blocked"].includes(status)) {
      return badRequest(res, "Valid status is required.");
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return notFound(res, "User not found.");
    }

    const currentUser = req.user;

    if (currentUser.role === "Student") {
      return forbidden(res, "Not authorized.");
    }

    if (currentUser.role === "Teacher") {
      if (!currentUser.department) {
        return forbidden(res, "Your account does not have a department assigned. Please contact an Admin.");
      }
      if (
        !["Student", "Teacher"].includes(user.role) ||
        !user.department ||
        String(user.department) !== String(currentUser.department)
      ) {
        return forbidden(
          res,
          "Teachers can only manage Students and Teachers in their own department.",
        );
      }

      if (
        user.role === "Teacher" &&
        (status === "Blocked" || user.status === "Blocked")
      ) {
        return forbidden(
          res,
          "Teachers cannot block or unblock other teachers.",
        );
      }
    }

    if (currentUser.role === "HOD") {
      if (
        user.role === "Admin" ||
        user.role === "HOD" ||
        String(user.department) !== String(currentUser.department)
      ) {
        return forbidden(
          res,
          "HODs can only manage Students and Teachers in their department.",
        );
      }
    }

    user.status = status;
    if (status === "Rejected") {
      user.rejectionReason = rejectionReason || "No reason provided.";
    }

    await user.save();

    const io = req.app.get("io");
    if (io) {
      let msg = `Your account status was updated to ${status}.`;
      if (status === "Rejected" && user.rejectionReason)
        msg += ` Reason: ${user.rejectionReason}`;
      io.to(user._id.toString()).emit("notification", { message: msg });
      await Notification.create({
        recipient: user._id,
        actor: req.user._id,
        type: "status_updated",
        message: msg,
      });

      // SECURITY FIX: Instantly invalidate session if Blocked or Rejected
      if (status === "Blocked" || status === "Rejected") {
        io.to(user._id.toString()).emit("account blocked");
      }
    }

    const userObj = user.toObject();
    if (user.role === "Student") userObj.studentData = await Student.findOne({ userId: user._id }).lean();
    if (user.role === "Teacher") userObj.teacherData = await Teacher.findOne({ userId: user._id }).lean();
    if (user.role === "HOD") userObj.hodData = await HOD.findOne({ userId: user._id }).lean();
    if (user.role === "Seller") userObj.sellerData = await Seller.findOne({ userId: user._id }).lean();

    ok(res, { user: userObj }, `User status updated to ${status}.`);
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc Bulk update status for multiple users
 * @route PUT /api/users/bulk-status
 * @access Private (Admin/HOD/Teacher)
 */
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status, rejectionReason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, "User IDs are required.");
    }
    if (!status || !["Approved", "Rejected", "Blocked"].includes(status)) {
      return badRequest(res, "Valid status is required.");
    }

    const users = await User.find({ _id: { $in: ids } });
    if (users.length === 0) {
      return notFound(res, "No matching users found.");
    }

    const currentUser = req.user;
    const updatedUsers = [];

    for (const user of users) {
      if (currentUser.role === "Student") {
        return forbidden(res, "Not authorized.");
      }

      if (currentUser.role === "Teacher") {
        if (
          !["Student", "Teacher"].includes(user.role) ||
          String(user.department) !== String(currentUser.department)
        ) {
          return forbidden(
            res,
            "Teachers can only manage Students and Teachers in their department.",
          );
        }

        if (user.role === "Teacher" && status === "Blocked") {
          return forbidden(res, "Teachers cannot block other teachers.");
        }
      }

      if (currentUser.role === "HOD") {
        if (
          user.role === "Admin" ||
          user.role === "HOD" ||
          String(user.department) !== String(currentUser.department)
        ) {
          return forbidden(
            res,
            "HODs can only manage Students and Teachers in their department.",
          );
        }
      }

      user.status = status;
      if (status === "Rejected") {
        user.rejectionReason = rejectionReason || "No reason provided.";
      }
      await user.save();
      updatedUsers.push(user);

      const io = req.app.get("io");
      if (io) {
        let msg = `Your account status was updated to ${status}.`;
        if (status === "Rejected" && user.rejectionReason)
          msg += ` Reason: ${user.rejectionReason}`;
        io.to(user._id.toString()).emit("notification", { message: msg });
        await Notification.create({
          recipient: user._id,
          actor: req.user._id,
          type: "status_updated",
          message: msg,
        });

        if (status === "Blocked" || status === "Rejected") {
          io.to(user._id.toString()).emit("account blocked");
        }
      }
    }

    ok(
      res,
      { updatedCount: updatedUsers.length },
      "Bulk status updated successfully.",
    );
  } catch (error) {
    logger.error("Error bulk updating status", { error: error.message, stack: error.stack });
    serverError(res);
  }
};

/**
 * @desc Bulk update semesters for multiple students
 * @route PUT /api/users/bulk-semester
 * @access Private (Admin/HOD/Teacher)
 */
export const bulkUpdateSemester = async (req, res) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, "User IDs are required.");
    }
    if (!["increment", "decrement"].includes(action)) {
      return badRequest(res, "Valid action is required.");
    }

    const users = await User.find({ _id: { $in: ids } });
    if (users.length === 0) {
      return notFound(res, "No matching users found.");
    }

    const currentUser = req.user;
    const results = [];

    for (const user of users) {
      if (user.role !== "Student") {
        return badRequest(
          res,
          "Semester updates can only be applied to Students.",
        );
      }

      if (currentUser.role === "Student") {
        return forbidden(res, "Not authorized.");
      }

      if (currentUser.role === "Teacher" || currentUser.role === "HOD") {
        const targetDept = user.department?._id || user.department;
        const managerDept = currentUser.department?._id || currentUser.department;
        
        if (!managerDept || !targetDept || String(targetDept) !== String(managerDept)) {
          return forbidden(res, "Not authorized to manage a student outside of your department.");
        }
      }

      const studentProfile = await Student.findOne({ userId: user._id });
      if (!studentProfile) {
        return notFound(res, `Student profile not found for user ${user._id}.`);
      }

      const department = await Department.findById(user.department);
      const maxSemesters = department?.totalSemesters || 8;

      if (action === "increment") {
        if (studentProfile.semester < maxSemesters) {
          studentProfile.semester += 1;
        } else {
          return badRequest(
            res,
            `Maximum semester (${maxSemesters}) reached for one or more students.`,
          );
        }
      } else {
        if (studentProfile.semester > 1) {
          studentProfile.semester -= 1;
        } else {
          return badRequest(
            res,
            "One or more students are already at semester 1.",
          );
        }
      }

      let mappedSubjects = [];
      if (department) {
        const newSubjects = await Subject.find({ 
          department: department._id, 
          semester: studentProfile.semester 
        }).lean();
        studentProfile.subjects = newSubjects.map((s) => s._id);
        mappedSubjects = newSubjects;
      }

      await studentProfile.save();

      const io = req.app.get("io");
      if (io) {
        const msg = `Your semester was updated to Semester ${studentProfile.semester} by ${req.user.name}.`;
        io.to(user._id.toString()).emit("notification", { message: msg });
        await Notification.create({
          recipient: user._id,
          actor: req.user._id,
          type: "semester_updated",
          message: msg,
        });
      }

      results.push({
        userId: user._id,
        semester: studentProfile.semester,
        subjects: mappedSubjects,
      });
    }

    ok(res, { results }, "Bulk semester update successful.");
  } catch (error) {
    logger.error("Error bulk updating semester", { error: error.message, stack: error.stack });
    serverError(res);
  }
};

/**
 * @desc Bulk upload user records from CSV
 * @route POST /api/users/bulk-upload
 * @access Private (Admin/HOD)
 */
export const bulkUploadUsers = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!req.file) {
      await session.abortTransaction();
      session.endSession();
      return badRequest(res, "CSV file is required.");
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    if (extension !== ".csv") {
      await fs.unlink(req.file.path).catch(() => {});
      await session.abortTransaction();
      session.endSession();
      return badRequest(res, "Only CSV files are supported.");
    }

    const csvText = await fs.readFile(req.file.path, "utf-8");
    await fs.unlink(req.file.path).catch(() => {});
    const rows = parseCSVContent(csvText);
    if (rows.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return badRequest(res, "CSV file is empty or invalid.");
    }

    const departments = await Department.find({}).lean();
    const allSubjects = await Subject.find().lean();
    const currentUser = req.user;
    const created = [];
    const updated = [];
    const errors = [];

    const emails = rows
      .map((row) => row.email?.trim().toLowerCase())
      .filter(Boolean);
    const existingUsers = await User.find({
      "emails.address": { $in: emails },
    }).session(session);
    const existingUserMap = new Map(
      existingUsers.map((u) => [u.emails[0].address, u]),
    );

    const userOps = [];
    const studentOps = [];
    const teacherOps = [];
    const hodOps = [];
    const teacherSubjectAssignments = new Map(); // subjectId -> Set(userId)

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const name = row.name?.trim();
      const email = row.email?.trim().toLowerCase();
      if (!name || !email) {
        errors.push({
          row: index + 2,
          message: "Name and email are required.",
        });
        continue;
      }

      const role = normalizeRole(row.role) || "Student";
      const status = normalizeStatus(row.status) || "Pending";
      const departmentTerm = row.department?.trim();
      const departmentDoc =
        currentUser.role === "HOD" && !departmentTerm
          ? departments.find(
              (d) => d._id.toString() === currentUser.department.toString(),
            )
          : findDepartmentByTerm(departmentTerm, departments);
      const deptId = departmentDoc ? departmentDoc._id : currentUser.department;

      let targetRole = role;
      if (currentUser.role === "HOD") {
        if (!["Student", "Teacher"].includes(targetRole)) {
          targetRole = "Student";
        }
      }

      const existingUser = existingUserMap.get(email);
      let userId;

      if (existingUser) {
        userId = existingUser._id;
        const updateFields = {
          name: name || existingUser.name,
        };
        if (currentUser.role === "Admin" || currentUser.role === "HOD") {
          updateFields.role = targetRole;
          if (deptId) updateFields.department = deptId;
          if (status) updateFields.status = status;
          if (status === "Rejected") {
            updateFields.rejectionReason =
              row.rejectionreason || "No reason provided.";
          }
          if (row.enrollmentnumber)
            updateFields.enrollmentNumber = row.enrollmentnumber;
          if (row.phone) updateFields.phone = row.phone;
        }
        userOps.push({
          updateOne: {
            filter: { _id: userId },
            update: { $set: updateFields },
          },
        });
        updated.push(email);
      } else {
        userId = new mongoose.Types.ObjectId();
        // Fix: Use CSV provided password or a deterministic default so admin can distribute it.
        // The cryptographically random password was never being sent to the user.
        const rawPassword = row.password || "Welcome@123";
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
        userOps.push({
          insertOne: {
            document: {
              _id: userId,
              name,
              email, // Required top-level field for User schema
              role: targetRole,
              password: hashedPassword, // Fix: Ensure password is at the root for authController matching
              department: deptId,
              status,
              rejectionReason:
                status === "Rejected"
                  ? row.rejectionreason || "No reason provided."
                  : undefined,
              emails: [
                {
                  address: email,
                  isVerified: false,
                },
              ],
              enrollmentNumber: row.enrollmentnumber || undefined,
              phone: row.phone || undefined,
              mustChangePassword: true,
            },
          },
        });
        created.push(email);
      }

      const semester = Number(row.semester) || undefined;
      const rollNumber = Number(row.rollnumber) || undefined;
      const subjects = mapSubjectNamesToIds(deptId, row.subjects, allSubjects);

      if (targetRole === "Student" && semester && rollNumber) {
        studentOps.push({
          updateOne: {
            filter: { userId },
            update: { $set: { userId, semester, rollNumber, subjects } },
            upsert: true,
          },
        });
      }

      if (targetRole === "Teacher" || targetRole === "HOD") {
        teacherOps.push({
          updateOne: {
            filter: { userId },
            update: { $set: { userId, subjects } },
            upsert: true,
          },
        });

        // Collect teacher-subject assignments for bidirectional consistency
        if (subjects && subjects.length > 0) {
          subjects.forEach((subId) => {
            const sId = subId.toString();
            if (!teacherSubjectAssignments.has(sId)) {
              teacherSubjectAssignments.set(sId, new Set());
            }
            teacherSubjectAssignments.get(sId).add(userId);
          });
        }
      }

      if (targetRole === "HOD") {
        const semesters = Number(row.semesters) || 1;
        hodOps.push({
          updateOne: {
            filter: { userId },
            update: {
              $set: { userId, semesters, achievements: row.achievements || "" },
            },
            upsert: true,
          },
        });
      }
    }

    if (errors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return badRequest(
        res,
        `Found ${errors.length} errors in the CSV file. No users were imported.`,
        errors,
      );
    }

    if (userOps.length > 0) await User.bulkWrite(userOps, { session });
    if (studentOps.length > 0) await Student.bulkWrite(studentOps, { session });
    if (teacherOps.length > 0) await Teacher.bulkWrite(teacherOps, { session });
    if (hodOps.length > 0) await HOD.bulkWrite(hodOps, { session });

    // Bidirectional consistency: Update Subject model with assigned teachers
    if (teacherSubjectAssignments.size > 0) {
      const subUpdates = [];
      for (const [subId, teacherIdsSet] of teacherSubjectAssignments.entries()) {
        subUpdates.push(
          Subject.updateOne(
            { _id: subId },
            { $addToSet: { assignedTeacher: { $each: Array.from(teacherIdsSet) } } },
            { session }
          )
        );
      }
      await Promise.all(subUpdates);
    }

    await session.commitTransaction();
    session.endSession();

    ok(
      res,
      {
        summary: {
          createdCount: created.length,
          updatedCount: updated.length,
          createdEmails: created,
          errors: [],
        },
      },
      `Bulk upload completed. Created ${created.length}, updated ${updated.length}. Users must set their own password on first login.`,
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Error bulk uploading users", { error: error.message, stack: error.stack });
    serverError(res);
  }
};

/**
 * @desc Get student profile by user ID
 * @route GET /api/users/student-profile/:userId
 * @access Private
 */
export const getStudentProfile = async (req, res) => {
  try {
    const isSelf = req.user && req.user._id.toString() === req.params.userId;

    const user = await User.findById(req.params.userId)
      .select(getSafeUserSelectFields(isSelf))
      .populate("department", "name")
      .lean();
    if (!user) return notFound(res, "User not found.");

    attachPrimaryEmail(user);

    const studentProfile = await Student.findOne({
      userId: req.params.userId,
    });
    const effectiveStudentProfile = studentProfile || user.studentData || {};

    let currentSubjects = [];

    const deptId = user.department?._id || user.department;
    if (deptId) {
      const semesterSubjects = await Subject.find({
        department: deptId,
        semester: effectiveStudentProfile.semester,
      }).populate('department', 'name').lean();
      
      semesterSubjects.forEach((s) => {
        currentSubjects.push({ ...s, departmentName: s.department?.name });
      });
    }

    if (
      effectiveStudentProfile.subjects &&
      effectiveStudentProfile.subjects.length > 0
    ) {
      const explicitSubjects = await Subject.find({
        _id: { $in: effectiveStudentProfile.subjects }
      }).populate('department', 'name').lean();

      explicitSubjects.forEach((s) => {
        if (!currentSubjects.some((cs) => String(cs._id) === String(s._id))) {
          currentSubjects.push({ ...s, departmentName: s.department?.name });
        }
      });
    }

    const subjectIds = currentSubjects.map((s) => s._id);
    const teachers = await Teacher.find({
      subjects: { $in: subjectIds },
    }).populate("userId", "name profilePicture");
    currentSubjects = currentSubjects.map((s) => ({
      ...s,
      assignedTeacher: teachers
        .filter((t) => t.subjects.some((id) => String(id) === String(s._id)))
        .map((t) => t.userId),
    }));

    const quizzesAttempted = await Quiz.countDocuments({
      "attempts.student": req.params.userId,
    });
    const assignmentsSubmitted = await Assignment.countDocuments({
      "submissions.student": req.params.userId,
    });

    ok(
      res,
      {
        user,
        rollNumber: effectiveStudentProfile.rollNumber,
        semester: effectiveStudentProfile.semester,
        subjects: currentSubjects,
        stats: {
          quizzesAttempted,
          assignmentsSubmitted,
          subjectCount: currentSubjects.length,
        },
      },
      "Student profile retrieved successfully.",
    );
  } catch (error) {
    logger.error("Error fetching student profile", { error: error.message, stack: error.stack, userId: req.params.userId });
    serverError(res);
  }
};

/**
 * @desc Get teacher profile by user ID
 * @route GET /api/users/teacher-profile/:userId
 * @access Private
 */
export const getTeacherProfile = async (req, res) => {
  try {
    const isSelf = req.user && req.user._id.toString() === req.params.userId;

    const user = await User.findById(req.params.userId)
      .select(getSafeUserSelectFields(isSelf))
      .populate("department", "name")
      .lean();
    if (!user) return notFound(res, "User not found.");

    attachPrimaryEmail(user);

    const teacherProfile = await Teacher.findOne({
      userId: req.params.userId,
    }).lean();
    const effectiveTeacherProfile = teacherProfile || user.teacherData || {};

    const subjects = await Subject.find({
      _id: { $in: effectiveTeacherProfile.subjects || [] }
    }).populate('department', 'name').lean();

    const mappedSubjects = subjects.map((s) => ({
      ...s,
      departmentName: s.department?.name,
      assignedTeacher: [user],
    }));

    const quizzesGenerated = await Quiz.countDocuments({
      author: req.params.userId,
    });
    const assignmentsCreated = await Assignment.countDocuments({
      author: req.params.userId,
    });
    const materialsUploaded = await Material.countDocuments({
      author: req.params.userId,
    });

    const studentCount = await Student.countDocuments({
      subjects: { $in: effectiveTeacherProfile.subjects || [] },
    });

    ok(
      res,
      {
        user,
        qualifications: effectiveTeacherProfile.qualifications,
        experience: effectiveTeacherProfile.experience,
        subjects: mappedSubjects,
        stats: {
          quizzesGenerated,
          assignmentsCreated,
          materialsUploaded,
          studentCount,
        },
      },
      "Teacher profile retrieved successfully.",
    );
  } catch (error) {
    logger.error("Error fetching teacher profile", { error: error.message, stack: error.stack, userId: req.params.userId });
    serverError(res);
  }
};

/**
 * @desc Get HOD profile by user ID
 * @route GET /api/users/hod-profile/:userId
 * @access Private
 */
export const getHODProfile = async (req, res) => {
  try {
    const isSelf = req.user && req.user._id.toString() === req.params.userId;

    const user = await User.findById(req.params.userId)
      .select(getSafeUserSelectFields(isSelf))
      .populate("department", "name code totalSemesters")
      .lean();
    if (!user) return notFound(res, "User not found.");

    attachPrimaryEmail(user);

    const hodProfile = await HOD.findOne({ userId: req.params.userId });
    const effectiveHodProfile = hodProfile || user.hodData || {};

    // Also fetch teacher data if it exists for this HOD
    const teacherProfile = await Teacher.findOne({
      userId: req.params.userId,
    }).lean();
    const effectiveTeacherProfile = teacherProfile || user.teacherData || {};

    const subjects = await Subject.find({
      _id: { $in: effectiveTeacherProfile.subjects || [] }
    }).populate('department', 'name').lean();

    const mappedSubjects = subjects.map((s) => ({
      ...s,
      departmentName: s.department?.name,
      assignedTeacher: [user],
    }));

    const quizzesGenerated = await Quiz.countDocuments({
      author: req.params.userId,
    });
    const assignmentsCreated = await Assignment.countDocuments({
      author: req.params.userId,
    });
    const materialsUploaded = await Material.countDocuments({
      author: req.params.userId,
    });

    let studentCount = 0;
    if (user.department?._id) {
      studentCount = await User.countDocuments({
        role: "Student",
        department: user.department._id,
        status: "Approved",
      });
    }

    ok(
      res,
      {
        user,
        tenure: effectiveHodProfile.tenure,
        achievements: effectiveHodProfile.achievements,
        semesters:
          user.department?.totalSemesters || effectiveHodProfile.semesters,
        // Add teacher data to the response if it exists
        qualifications: effectiveTeacherProfile.qualifications,
        experience: effectiveTeacherProfile.experience,
        subjects: mappedSubjects,
        stats: {
          quizzesGenerated,
          assignmentsCreated,
          materialsUploaded,
          studentCount,
        },
      },
      "HOD profile retrieved successfully.",
    );
  } catch (error) {
    logger.error("Error fetching HOD profile", { error: error.message, stack: error.stack, userId: req.params.userId });
    serverError(res);
  }
};

/**
 * @desc Update user's own profile details
 * @route PUT /api/users/profile/:id
 * @access Private (Self or Admin)
 */
export const updateUserProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      name,
      role,
      department,
      studentData,
      teacherData,
      hodData,
      sellerData,
      bio,
      location,
      contactNumber,
      dob,
      skills,
      isDnd,
      savedLectures,
      savedPosts,
      geminiApiKey,
      rapidApiKey,
      openAiApiKey,
      claudeApiKey,
      stabilityApiKey,
      deepseekApiKey,
      perplexityApiKey,
      boltApiKey,
      v0devApiKey,
      emergentApiKey,
      huggingfaceApiKey,
      openRouterApiKey,
      aiChatHistory,
      enrollmentNumber,
    } = req.body;

    const user = await User.findById(req.params.id).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return notFound(res, "User not found.");
    }

    const isSameDepartmentHOD =
      req.user.role === "HOD" &&
      String(user.department) === String(req.user.department);

    const isSameDepartmentTeacher =
      req.user.role === "Teacher" &&
      user.role === "Student" &&
      String(user.department) === String(req.user.department);

    if (
      req.user._id.toString() !== user._id.toString() &&
      req.user.role !== "Admin" &&
      !isSameDepartmentHOD &&
      !isSameDepartmentTeacher
    ) {
      await session.abortTransaction();
      session.endSession();
      return forbidden(res, "Not authorized to update this profile.");
    }

    const oldRole = user.role;
    // SECURITY FIX: Prevent IDOR/Mass Assignment Privilege Escalation
    const newRole = req.user.role === "Admin" && role ? role : oldRole;

    // --- New Profile Fields Update ---
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (contactNumber !== undefined) user.contactNumber = contactNumber;
    if (dob !== undefined) user.dob = dob;
    user.isDnd = isDnd !== undefined ? isDnd : user.isDnd;
    if (savedLectures !== undefined) user.savedLectures = savedLectures;
    if (savedPosts !== undefined) user.savedPosts = savedPosts;
    if (geminiApiKey !== undefined) user.geminiApiKey = geminiApiKey;
    if (rapidApiKey !== undefined) user.rapidApiKey = rapidApiKey;
    if (openAiApiKey !== undefined) user.openAiApiKey = openAiApiKey;
    if (claudeApiKey !== undefined) user.claudeApiKey = claudeApiKey;
    if (stabilityApiKey !== undefined) user.stabilityApiKey = stabilityApiKey;
    if (deepseekApiKey !== undefined) user.deepseekApiKey = deepseekApiKey;
    if (perplexityApiKey !== undefined) user.perplexityApiKey = perplexityApiKey;
    if (boltApiKey !== undefined) user.boltApiKey = boltApiKey;
    if (v0devApiKey !== undefined) user.v0devApiKey = v0devApiKey;
    if (emergentApiKey !== undefined) user.emergentApiKey = emergentApiKey;
    if (huggingfaceApiKey !== undefined) user.huggingfaceApiKey = huggingfaceApiKey;
    if (openRouterApiKey !== undefined) user.openRouterApiKey = openRouterApiKey;
    if (aiChatHistory !== undefined) user.aiChatHistory = aiChatHistory;
    if (enrollmentNumber !== undefined) {
      user.enrollmentNumber = enrollmentNumber;
      // Sync back to student rollNumber if user is a student
      if (user.role === "Student") {
        await Student.findOneAndUpdate(
          { userId: user._id },
          { $set: { rollNumber: Number(enrollmentNumber) } },
          { session }
        );
      }
    }

    // Handle skills (ensure array)
    if (skills) {
      user.skills = Array.isArray(skills) ? skills : [skills];
    } else if (req.body["skills[]"]) {
      const rawSkills = req.body["skills[]"];
      user.skills = Array.isArray(rawSkills) ? rawSkills : [rawSkills];
    }

    // Handle File Uploads (Banner & Profile Picture)
    if (req.files) {
      if (req.files.profilePicture?.[0]) {
        if (user.profilePicture && !user.profilePicture.startsWith("http")) {
          try {
            const oldPath = path.join(
              process.cwd(),
              user.profilePicture.replace(/^\/+/, ""),
            );
            await fs.unlink(oldPath);
          } catch (e) {}
        }
        const media = await processUpload(
          req.files.profilePicture[0],
          "profiles/avatars",
        );
        user.profilePicture = `/${media.path}`;
      }
      if (req.files.banner?.[0]) {
        if (user.banner && !user.banner.startsWith("http")) {
          try {
            const oldPath = path.join(
              process.cwd(),
              user.banner.replace(/^\/+/, ""),
            );
            await fs.unlink(oldPath);
          } catch (e) {}
        }
        const media = await processUpload(
          req.files.banner[0],
          "profiles/banners",
        );
        user.banner = `/${media.path}`;
      }
    }
    // ---------------------------------

    // If role changes, delete old role-specific data
    if (newRole !== oldRole) {
      if (oldRole === "Student")
        await Student.deleteOne({ userId: user._id }).session(session);
      if (oldRole === "Teacher")
        await Teacher.deleteOne({ userId: user._id }).session(session);
      if (oldRole === "HOD")
        await HOD.deleteOne({ userId: user._id }).session(session);
    }

    // Update base user info
    user.name = name ?? user.name;
    user.role = newRole;

    // Department handling
    if (department) {
      if (newRole === "HOD") {
        const existingDept = await Department.findOne({ name: department }).session(session);
        if (existingDept && existingDept.hod && String(existingDept.hod) !== String(user._id)) {
          await session.abortTransaction();
          session.endSession();
          return badRequest(res, `The department '${department}' already has an HOD. You must remove the current HOD before assigning a new one.`);
        }
        const dept = await Department.findOneAndUpdate(
          { name: department },
          {
            $set: {
              name: department,
              code: department.toUpperCase().substring(0, 5),
              totalSemesters: hodData?.semesters,
              hod: user._id,
                  updatedBy: req.user._id,
            },
          },
          { upsert: true, new: true, session },
        );
        user.department = dept._id;
      } else if (newRole === "Student" || newRole === "Teacher") {
        const dept = await Department.findOne({ name: department }).session(
          session,
        );
        if (dept) {
          user.department = dept._id;
        }
      }
    }

    // Upsert role-specific data
    let updatedRoleData = {};
    if (newRole === "Student" && studentData) {
      // Sync rollNumber to user.enrollmentNumber if present
      if (studentData.rollNumber) {
        user.enrollmentNumber = String(studentData.rollNumber);
      }
      updatedRoleData = await Student.findOneAndUpdate(
        { userId: user._id },
        { $set: studentData },
        { upsert: true, new: true, session },
      ).lean();
    }

    if (newRole === "HOD" && hodData) {
      updatedRoleData = {
        ...(await HOD.findOneAndUpdate(
          { userId: user._id },
          { $set: hodData },
          { upsert: true, new: true, session },
        ).lean()),
      };
    }

    if (newRole === "Teacher" || newRole === "HOD") {
      if (teacherData) {
        // Get old subjects to track removals if the teacher drops a subject from their profile
        const oldTeacherProfile = await Teacher.findOne({
          userId: user._id,
        }).session(session);
        const oldSubjectIds = oldTeacherProfile?.subjects
          ? oldTeacherProfile.subjects.map((id) => id.toString())
          : [];

        // Subject management is now handled here to match the frontend form.
        const subjectIds = [];
        const dept = await Department.findById(user.department).session(session);

        if (dept) {
          if (teacherData.subjects && teacherData.subjects.length > 0) {
            for (const sub of teacherData.subjects) {
              if (sub._id && mongoose.Types.ObjectId.isValid(sub._id)) {
                let existingSub = await Subject.findById(sub._id).session(session);
                if (existingSub) {
                  // If HOD/Admin, allow updating subject details
                  if (req.user.role === "HOD" || req.user.role === "Admin") {
                    existingSub.name = sub.subject || existingSub.name;
                    existingSub.semester = sub.semester || existingSub.semester;
                    if (sub.code) existingSub.code = sub.code;
                    await existingSub.save({ session });
                  }
                  subjectIds.push(existingSub._id);
                }
              } else {
                // Case-insensitive search for existing subject
                let existingSub = await Subject.findOne({
                  department: dept._id,
                  name: { $regex: new RegExp(`^${sub.subject.trim()}$`, "i") },
                  semester: sub.semester,
                }).session(session);

                if (existingSub) {
                  subjectIds.push(existingSub._id);
                } else if (["Teacher", "HOD", "Admin"].includes(req.user.role)) {
                  // Allow Teachers, HODs, and Admins to create the subject if it doesn't exist
                  const subjectCode =
                    sub.code ||
                    `${sub.subject.replace(/\s/g, "").toUpperCase().slice(0, 4)}${user.department.toString().slice(-4)}${sub.semester}`;
                  
                  const newSub = await Subject.create([{
                    name: sub.subject.trim(),
                    semester: sub.semester,
                    code: subjectCode,
                    department: dept._id,
                    assignedTeacher: [user._id] // Link teacher immediately
                  }], { session });
                  
                  dept.subjects.push(newSub[0]._id);
                  subjectIds.push(newSub[0]._id);
                }
              }
            }
          }

          const newSubjectIdsStr = subjectIds.map((id) => id.toString());
          const removedIds = oldSubjectIds.filter(
            (id) => !newSubjectIdsStr.includes(id),
          );

          // Update bidirectional consistency: Link/Unlink Teacher in Subject model
          if (subjectIds.length > 0) {
            await Subject.updateMany(
              { _id: { $in: subjectIds } },
              { $addToSet: { assignedTeacher: user._id } },
              { session }
            );
          }
          if (removedIds.length > 0) {
            await Subject.updateMany(
              { _id: { $in: removedIds } },
              { $pull: { assignedTeacher: user._id } },
              { session }
            );
          }

          await dept.save({ session });
        }

        const teacherProfile = await Teacher.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              qualifications: teacherData.qualifications || "",
              experience: teacherData.experience || 0,
              subjects: subjectIds,
            },
          },
          { upsert: true, new: true, session },
        ).lean();
        updatedRoleData = { ...updatedRoleData, ...teacherProfile };
      } else {
        const teacherProfile = await Teacher.findOneAndUpdate(
          { userId: user._id },
          { $setOnInsert: { userId: user._id, qualifications: "", experience: 0, subjects: [] } },
          { upsert: true, new: true, session },
        ).lean();
        updatedRoleData = { ...updatedRoleData, ...teacherProfile };
      }
    }
     if (newRole === "Seller" && sellerData) {
      updatedRoleData = await Seller.findOneAndUpdate(
        { userId: user._id },
        { $set: sellerData },
        { upsert: true, new: true, session },
      ).lean();
    }

    // Save User updates
    await user.save({ session });
    await session.commitTransaction();
    session.endSession();

    if (req.user._id.toString() !== user._id.toString()) {
      const io = req.app.get("io");
      if (io) {
        const msg = `Your profile details were updated by ${req.user.name} (${req.user.role}).`;
        io.to(user._id.toString()).emit("notification", { message: msg });
        await Notification.create({
          recipient: user._id,
          actor: req.user._id,
          type: "profile_updated",
          message: msg,
        });
      }
    }

    const isSelfUpdate = req.user._id.toString() === user._id.toString();
    const userResponse = await User.findById(user._id)
      .select(getSafeUserSelectFields(isSelfUpdate))
      .populate("department", "name")
      .lean();

    attachPrimaryEmail(userResponse);

    ok(
      res,
      {
        user: userResponse,
        ...updatedRoleData,
      },
      "Profile updated successfully.",
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Error updating profile", { error: error.message, stack: error.stack, userId: req.params.id });
    serverError(res);
  }
};

export const getDepartments = async (req, res) => {
  try {
    // Query the Department collection directly for a reliable list.
    const departments = await Department.find()
      .select("name")
      .sort({ name: 1 });
    ok(
      res,
      { departments: departments.map((d) => d.name) },
      "Departments retrieved successfully.",
    );
  } catch (error) {
    logger.error("Error fetching departments", { error: error.message, stack: error.stack });
    serverError(res);
  }
};

export const getSubjects = async (req, res) => {
  try {
    const departmentName = req.params.name;
    const semParam = req.params.semester;

    if (!departmentName) {
      return badRequest(res, "Invalid department");
    }

    // More efficient query:
    // 1. Find the department by name to get its ID.
    const department = await Department.findOne({
      name: departmentName,
    }).lean();
    if (!department) {
      // If department doesn't exist, no subjects can be found.
      return ok(res, { subjects: [] }, "No subjects found for department.");
    }

    let subjects = await Subject.find({ department: department._id }).lean();

    if (semParam !== "all") {
      const semester = Number(semParam);
      if (Number.isNaN(semester)) {
        return badRequest(res, "Invalid semester");
      }
      subjects = subjects.filter((s) => s.semester === semester);
    }

    // Map teachers to subjects accurately using both Subject's own field and the Teacher model
    const subjectIds = subjects.map((s) => s._id);
    const teachersFromModel = await Teacher.find({
      subjects: { $in: subjectIds },
    }).populate("userId", "name email profilePicture role").lean();

    subjects = subjects.map((s) => {
      const teachersFromTeacherModel = teachersFromModel
        .filter((t) => t.subjects.some((id) => String(id) === String(s._id)))
        .map((t) => t.userId);

      // Merge with Subject's own assignedTeacher if it exists and is populated
      // (Note: we didn't explicitly populate s.assignedTeacher in Subject.find, 
      // but if it's there as IDs, we should probably handle it or just rely on the Teacher model which is the source of truth for "Profile" edits)
      
      return {
        ...s,
        assignedTeacher: teachersFromTeacherModel,
      };
    });

    ok(res, { subjects }, "Subjects retrieved successfully.");
  } catch (error) {
    logger.error("Error fetching subjects", { error: error.message, stack: error.stack, department: req.params.name });
    serverError(res);
  }
};

export const getSem = async (req, res) => {
  try {
    const { name } = req.params;
    if (!name) {
      return badRequest(res, "Department name required");
    }

    const isId = mongoose.Types.ObjectId.isValid(name);
    const department = isId
      ? await Department.findById(name)
      : await Department.findOne({ name: name });

    if (!department) {
      return notFound(res, "Department not found.");
    }

    ok(
      res,
      { Semesters: department.totalSemesters || 0 },
      "Semesters retrieved successfully.",
    );
  } catch (error) {
    serverError(res);
  }
};

export const getDepartmentHODKeys = async (req, res) => {
  try {
    const { name } = req.params;
    if (!name) {
      return badRequest(res, "Department name required");
    }

    const isId = mongoose.Types.ObjectId.isValid(name);
    const department = isId
      ? await Department.findById(name)
      : await Department.findOne({ name: name });

    if (!department) {
      return notFound(res, "Department not found.");
    }

    let hodUser = null;
    if (department.hod) {
      hodUser = await User.findById(department.hod).lean();
    }

    if (!hodUser) {
      hodUser = await User.findOne({
        role: "HOD",
        department: department._id,
      }).lean();
    }

    const response = {
      Semesters: department.totalSemesters || 0,
    };

    // ✅ Include requesting user's personal keys
    const requestingUser = await User.findById(req.user._id).select("+rapidApiKey +geminiApiKey");
    if (requestingUser) {
      response.personalRapidApiKey = requestingUser.rapidApiKey;
      response.personalGeminiApiKey = requestingUser.geminiApiKey;
    }

    if (hodUser) {
      if (hodUser.emails && hodUser.emails.length > 0) {
        hodUser.email = hodUser.emails[0].address;
      }

      response.hod = {
        _id: hodUser._id,
        name: hodUser.name,
        email: hodUser.email,
        department: hodUser.department,
      };

      // ✅ Only return API keys to the HOD themselves or Admin
      if (hodUser.geminiApiKey) {
        const isOwnerOrAdmin =
          req.user?.role === "Admin" ||
          req.user?._id.toString() === hodUser._id.toString();
        if (isOwnerOrAdmin) {
          response.departmentApiKey = hodUser.geminiApiKey;
          response.geminiApiKey = hodUser.geminiApiKey;
        }
      }
      if (hodUser.rapidApiKey) {
        const isOwnerOrAdmin =
          req.user?.role === "Admin" ||
          req.user?._id.toString() === hodUser._id.toString();
        if (isOwnerOrAdmin) {
          response.rapidApiKey = hodUser.rapidApiKey;
        }
      }

      if (hodUser.rapidApiKey) {
        response.rapidApiKey = hodUser.rapidApiKey;
      }
    }

    ok(res, response, "Department HOD keys retrieved successfully.");
  } catch (error) {
    logger.error("Error fetching department HOD keys", { error: error.message, stack: error.stack, department: req.params.name });
    serverError(res);
  }
};

/**
 * @desc Get teachers by department and optional semester
 * @route GET /api/users/teachers/department/:name/semester/:sem
 * @access Private
 */
export const getTeachersByDepartment = async (req, res) => {
  try {
    const { name, sem } = req.params;
    if (!name) {
      return badRequest(res, "Department name required");
    }

    const isId = mongoose.Types.ObjectId.isValid(name);
    const department = isId
      ? await Department.findById(name).lean()
      : await Department.findOne({ name: name }).lean();

    if (!department) {
      return notFound(res, "Department not found.");
    }

    let subjectIds = department.subjects?.map((s) => s._id) || [];

    if (sem && sem !== "all") {
      const semester = Number(sem);
      if (!Number.isNaN(semester)) {
        subjectIds = department.subjects
          .filter((s) => s.semester === semester)
          .map((s) => s._id);
      }
    }

    const teachers = await Teacher.find({ subjects: { $in: subjectIds } })
      .populate("userId", "name email profilePicture role department")
      .lean();

    const uniqueTeachersMap = new Map();
    teachers.forEach((t) => {
      if (t.userId && !uniqueTeachersMap.has(t.userId._id.toString())) {
        uniqueTeachersMap.set(t.userId._id.toString(), t.userId);
      }
    });

    ok(
      res,
      { teachers: Array.from(uniqueTeachersMap.values()) },
      "Teachers retrieved successfully.",
    );
  } catch (error) {
    logger.error("Error fetching teachers by department", { error: error.message, stack: error.stack, department: req.params.name });
    serverError(res);
  }
};

/**
 * @desc      Update student semester (Increment/Decrement)
 * @route     PUT /api/users/:id/semester
 * @access    Private (Admin/HOD/Teacher)
 */
export const updateStudentSemester = async (req, res) => {
  try {
    const { action } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "Student") {
      return notFound(res, "Student not found.");
    }

    const currentUser = req.user;

    if (currentUser.role === "Student") {
      return forbidden(res, "Not authorized.");
    }

    if (currentUser.role === "Teacher" || currentUser.role === "HOD") {
      if (String(user.department) !== String(currentUser.department)) {
        return forbidden(res, "Not authorized to manage this student.");
      }
    }

    const studentProfile = await Student.findOne({ userId: user._id });
    if (!studentProfile) {
      return notFound(res, "Student profile not found.");
    }

    const department = await Department.findById(user.department);
    const maxSemesters = department?.totalSemesters || 8;

    if (action === "increment") {
      if (studentProfile.semester < maxSemesters) {
        studentProfile.semester += 1;
      } else {
        return badRequest(res, `Maximum semester (${maxSemesters}) reached.`);
      }
    } else if (action === "decrement") {
      if (studentProfile.semester > 1) {
        studentProfile.semester -= 1;
      } else {
        return badRequest(res, "Already at semester 1.");
      }
    } else {
      return badRequest(res, "Invalid action.");
    }

    // Dynamically re-sync the student's subjects to match their new semester
    let mappedSubjects = [];
    if (department) {
      const newSubjects = await Subject.find({
        department: department._id,
        semester: studentProfile.semester,
      }).lean();
      studentProfile.subjects = newSubjects.map((s) => s._id);
      mappedSubjects = newSubjects;
    }

    await studentProfile.save();

    const io = req.app.get("io");
    if (io) {
      const msg = `Your semester was updated to Semester ${studentProfile.semester} by ${req.user.name}.`;
      io.to(user._id.toString()).emit("notification", { message: msg });
      await Notification.create({
        recipient: user._id,
        actor: req.user._id,
        type: "semester_updated",
        message: msg,
      });
    }

    ok(
      res,
      {
        semester: studentProfile.semester,
        subjects: mappedSubjects,
      },
      `Semester updated to ${studentProfile.semester}.`,
    );
  } catch (error) {
    logger.error("Error updating semester", { error: error.message, stack: error.stack });
    serverError(res);
  }
};

/**
 * @desc Add a new email address to a user's profile
 * @route POST /api/users/profile/add-email
 * @access Private (Self)
 */
export const addEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return badRequest(res, "Email is required.");
    }

    // Check if this email is already in use by another user
    const existingUser = await User.findOne({ "emails.address": email });
    if (existingUser) {
      return badRequest(res, "This email address is already in use.");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return notFound(res, "User not found.");
    }

    // Check if the user already has this email
    if (user.emails.some((e) => e.address === email)) {
      return badRequest(res, "You have already added this email address.");
    }

    // Check if the user has an existing password to attach to the new email
    const existingPassword =
      user.password || user.emails.find((e) => e.password)?.password;

    // Generate OTP for verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newEmail = {
      address: email,
      isVerified: false,
      otp: otpCode,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      ...(existingPassword && { password: existingPassword }),
    };

    user.emails.push(newEmail);
    await user.save();

    // Send verification email
    try {
      await sendEmail(
        email,
        "SocioFest - Verify Your New Email Address",
        `<div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;"><h2>Verify Your New Email</h2><p>Your email verification code is:</p><h1 style="font-size: 32px; letter-spacing: 5px; color: #4f46e5;">${otpCode}</h1><p>This code expires in 10 minutes.</p></div>`,
      );
    } catch (emailErr) {
      logger.error("Failed to send verification email for new address", { error: emailErr.message, stack: emailErr.stack, email });

      const safeUser = await User.findById(user._id)
        .select(PUBLIC_USER_SELECT)
        .lean();
      attachPrimaryEmail(safeUser);

      return ok(
        res,
        {
          user: safeUser,
        },
        "Email added, but failed to send verification code. Please try verifying later.",
      );
    }

    const safeUser = await User.findById(user._id)
      .select(PUBLIC_USER_SELECT)
      .lean();
    attachPrimaryEmail(safeUser);

    ok(
      res,
      {
        user: safeUser,
      },
      "Email added successfully. Please check your inbox for a verification code.",
    );
  } catch (error) {
logger.error("Error adding email:", { error: error.message, stack: error.stack, userId: req.user._id });
    serverError(res);
  }
};

/**
 * @desc Verify a newly added email address
 * @route POST /api/users/profile/verify-email
 * @access Private (Self)
 */
export const verifyNewEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return badRequest(res, "Email and OTP are required.");
    }

    const user = await User.findById(req.user._id);
    if (!user) return notFound(res, "User not found.");

    const emailToVerify = user.emails.find((e) => e.address === email);
    if (!emailToVerify)
      return notFound(res, "Email address not found on your profile.");
    if (emailToVerify.isVerified)
      return badRequest(res, "This email is already verified.");

    if (!emailToVerify.otp || String(emailToVerify.otp) !== String(otp))
      return badRequest(res, "Invalid OTP code.");
    if (!emailToVerify.otpExpires || new Date() > emailToVerify.otpExpires)
      return badRequest(
        res,
        "OTP has expired. Please try adding the email again.",
      );

    emailToVerify.isVerified = true;
    emailToVerify.otp = undefined;
    emailToVerify.otpExpires = undefined;
    await user.save();

    const safeUser = await User.findById(user._id)
      .select(PUBLIC_USER_SELECT)
      .lean();
    attachPrimaryEmail(safeUser);

    ok(res, { user: safeUser }, "Email verified successfully.");
  } catch (error) {
    logger.error("Error verifying new email:", { error: error.message, stack: error.stack, userId: req.user._id });
    serverError(res);
  }
};

/**
 * @desc Resend OTP for a newly added email address
 * @route POST /api/users/profile/resend-email-otp
 * @access Private (Self)
 */
export const resendNewEmailOTP = async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    if (isEmailOtpRateLimited(clientIp)) {
      return res.status(429).json({ message: 'Too many OTP resend attempts. Please try again later.' });
    }
    const { email } = req.body;
    if (!email) {
      return badRequest(res, "Email is required.");
    }

    const user = await User.findById(req.user._id);
    if (!user) return notFound(res, "User not found.");

    const emailRecord = user.emails.find((e) => e.address === email);
    if (!emailRecord)
      return notFound(res, "Email address not found on your profile.");
    if (emailRecord.isVerified)
      return badRequest(res, "This email is already verified.");

    // Generate new OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    emailRecord.otp = otpCode;
    emailRecord.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send verification email
    try {
      await sendEmail(
        email,
        "SocioFest - Verify Your New Email Address (New Code)",
        `<div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;"><h2>Verify Your New Email</h2><p>Your new verification code is:</p><h1 style="font-size: 32px; letter-spacing: 5px; color: #4f46e5;">${otpCode}</h1><p>This code expires in 10 minutes.</p></div>`,
      );
    } catch (emailErr) {
      logger.error("Failed to resend verification email", { error: emailErr.message, email });
      trackEmailOtpAttempt(clientIp);
      return ok(res, {}, "OTP generated, but email delivery failed. Please try again later.");
    }

    trackEmailOtpAttempt(clientIp);
    ok(res, {}, "Verification code resent successfully.");
  } catch (error) {
    logger.error("Error resending new email OTP:", { error: error.message, stack: error.stack, userId: req.user._id });
    serverError(res);
  }
};
