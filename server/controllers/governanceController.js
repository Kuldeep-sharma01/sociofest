/**
 * server/controllers/governanceController.js
 * Admin/HOD Governance: Full editing and management capabilities
 * Implements "Admin/HOD can edit anything within their scope"
 */

import User from "../models/User.js";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import Post from "../models/Post.js";
import Material from "../models/Material.js";
import Department from "../models/Department.js";
import Comment from "../models/Comment.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import QuizSubmission from "../models/QuizSubmission.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import HOD from "../models/HOD.js";
import Seller from "../models/Seller.js";
import {
  logActivity,
  getChanges,
  canEditResource,
} from "../utils/authorizationHelpers.js";
import { ROLES, VALID_ROLES } from "../utils/rbac.js";
import { ok, badRequest, notFound, forbidden, serverError } from "../utils/index.js";

const allowedFields = {
  event:      ['title', 'description', 'date', 'location', 'isActive', 'tags'],
  assignment: ['title', 'description', 'dueDate', 'totalMarks', 'isActive'],
  quiz:       ['title', 'description', 'duration', 'isActive', 'questions'],
  post:       ['title', 'content', 'tags', 'isPublished'],
  material:   ['title', 'description', 'isDownloadable', 'tags'],
  user:       ['name', 'bio', 'location', 'contactNumber', 'profilePicture'],
  department: ['name', 'description', 'subjects'],
};

/**
 * @desc Edit any resource as Admin/HOD
 * @route PUT /api/governance/resource/:resourceType/:resourceId
 * @access Admin, HOD (scoped to department)
 */
export const editResource = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const update = req.body;
    const user = req.user;
    const io = req.app.get("io");

    // Model map
    const modelMap = {
      event: Event,
      assignment: Assignment,
      quiz: Quiz,
      post: Post,
      material: Material,
      user: User,
      department: Department,
    };

    const Model = modelMap[resourceType];
    if (!Model) {
      return badRequest(res, "Invalid resource type");
    }

    // Fetch current resource
    const resource = await Model.findById(resourceId);
    if (!resource) {
      return notFound(res, `${resourceType} not found`);
    }

    // Authorization check
    if (user.role === "HOD") {
      if (
        !resource.department ||
        !user.department ||
        resource.department.toString() !== user.department.toString()
      ) {
        return forbidden(res, `HOD can only edit ${resourceType === 'user' ? 'users' : 'resources'} in their department`);
      }
    }

    const permitted = allowedFields[resourceType];
    if (!permitted) return badRequest(res, 'Invalid resource type');

    const filteredUpdate = {};
    permitted.forEach(f => { if (update[f] !== undefined) filteredUpdate[f] = update[f]; });

    // Track changes
    const fieldsToTrack = Object.keys(filteredUpdate);
    const oldValues = {};
    fieldsToTrack.forEach((field) => {
      oldValues[field] = resource[field];
    });

    // Apply updates
    fieldsToTrack.forEach((field) => {
      resource[field] = filteredUpdate[field];
    });

    // Add editor info
    if (!resource.editHistory) {
      resource.editHistory = [];
    }
    resource.editHistory.push({
      editor: user._id,
      editorName: user.name,
      editorRole: user.role,
      changedAt: new Date(),
      changes: getChanges(oldValues, filteredUpdate, fieldsToTrack),
    });

    await resource.save();

    // Log activity
    await logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: `${resourceType}_updated`,
      resource: resourceType,
      resourceId: resource._id,
      resourceName: resource.title || resource.name || resource.email,
      scope: user.role === "Admin" ? "global" : "department",
      departmentId: resource.department || user.department,
      details: {
        before: oldValues,
        after: Object.fromEntries(
          fieldsToTrack.map((field) => [field, resource[field]]),
        ),
        changes: getChanges(oldValues, filteredUpdate, fieldsToTrack),
      },
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      visibility: user.role === "Admin" ? "admin_only" : "hod_only",
      tags: ["governance", "edit", resourceType],
    });

    // Notify affected parties via socket
    if (io && (resourceType === "event" || resourceType === "assignment")) {
      if (resource.department) {
        io.to(`dept:${resource.department.toString()}`).emit('resource_updated', {
          resourceType,
          resourceId: resource._id,
          timestamp: new Date()
        });
      } else {
        io.to(`role:Admin`).emit('resource_updated', {
          resourceType,
          resourceId: resource._id,
          timestamp: new Date()
        });
      }
    }

    ok(res, {
      resource,
      changes: getChanges(oldValues, filteredUpdate, fieldsToTrack),
    }, `${resourceType} updated successfully`);
  } catch (error) {
    console.error("Error editing resource:", error);
    serverError(res, "Error updating resource");
  }
};

/**
 * @desc Delete any resource as Admin/HOD
 * @route DELETE /api/governance/resource/:resourceType/:resourceId
 * @access Admin, HOD (scoped to department)
 */
export const deleteResource = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const user = req.user;
    const io = req.app.get("io");

    const modelMap = {
      event: Event,
      assignment: Assignment,
      quiz: Quiz,
      post: Post,
      material: Material,
    };

    const Model = modelMap[resourceType];
    if (!Model) {
      return badRequest(res, "Invalid resource type");
    }

    const resource = await Model.findById(resourceId);
    if (!resource) {
      return notFound(res, `${resourceType} not found`);
    }

    // Authorization check
    if (user.role === "HOD") {
      if (
        !resource.department ||
        !user.department ||
        resource.department.toString() !== user.department.toString()
      ) {
        return forbidden(res, "HOD can only delete department resources");
      }
    }

    // Store info before deletion
    const resourceInfo = {
      title: resource.title || resource.name,
      author: resource.author,
      department: resource.department,
    };

    await Model.findByIdAndDelete(resourceId);

    if (resourceType === "post" && Comment)
      await Comment.deleteMany({ post: resourceId });
    if (resourceType === "quiz" && QuizSubmission)
      await QuizSubmission.deleteMany({ quiz: resourceId });
    if (resourceType === "assignment" && AssignmentSubmission)
      await AssignmentSubmission.deleteMany({ assignment: resourceId });

    // Log activity
    await logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: `${resourceType}_deleted`,
      resource: resourceType,
      resourceId,
      resourceName: resourceInfo.title,
      scope: user.role === "Admin" ? "global" : "department",
      departmentId: resourceInfo.department || user.department,
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      visibility: user.role === "Admin" ? "admin_only" : "hod_only",
      tags: ["governance", "delete", resourceType],
    });

    // Notify via socket
    if (io) {
      if (resourceInfo.department) {
        io.to(`dept:${resourceInfo.department.toString()}`).emit('resource_deleted', {
          resourceType,
          resourceId,
          timestamp: new Date()
        });
      } else {
        io.to(`role:Admin`).emit('resource_deleted', {
          resourceType,
          resourceId,
          timestamp: new Date()
        });
      }
    }

    ok(res, {
      id: resourceId,
    }, `${resourceType} deleted successfully`);
  } catch (error) {
    console.error("Error deleting resource:", error);
    serverError(res, "Error deleting resource");
  }
};

/**
 * @desc Bulk edit resources
 * @route PUT /api/governance/bulk-edit/:resourceType
 * @access Admin, HOD
 */
export const bulkEditResources = async (req, res) => {
  try {
    const { resourceType } = req.params;
    const { ids, updates } = req.body; // ids: array of IDs, updates: object with fields to update
    const user = req.user;

    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest(res, "Invalid ids array");
    }
    if (ids.length > 100) return badRequest(res, 'Maximum 100 resources per bulk operation');

    const modelMap = {
      event: Event,
      assignment: Assignment,
      quiz: Quiz,
      post: Post,
      material: Material,
      user: User,
    };

    const Model = modelMap[resourceType];
    if (!Model) {
      return badRequest(res, "Invalid resource type");
    }

    // For HOD, ensure all resources are in their department
    let filter = { _id: { $in: ids.filter(id => mongoose.Types.ObjectId.isValid(id)) } };
    if (user.role === "HOD") {
      if (!user.department) return forbidden(res, "HOD must have an assigned department");
      if (resourceType === 'user') {
        filter.department = user.department;
      } else {
        filter.department = user.department;
      }
    }

    const permitted = allowedFields[resourceType];
    if (!permitted) return badRequest(res, 'Invalid resource type');

    const filteredUpdates = {};
    permitted.forEach(f => {
      if (updates[f] !== undefined) filteredUpdates[f] = updates[f];
    });

    const result = await Model.updateMany(filter, {
      $set: filteredUpdates,
    });

    if (result.matchedCount === 0) {
      return notFound(res, "No resources found to update");
    }

    // Log bulk edit
    await logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: `${resourceType}_bulk_updated`,
      resource: resourceType,
      scope: user.role === "Admin" ? "global" : "department",
      departmentId: user.department,
      details: {
        resourceCount: result.matchedCount,
        updates: filteredUpdates,
      },
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      visibility: user.role === "Admin" ? "admin_only" : "hod_only",
      tags: ["governance", "bulk_edit", resourceType],
    });

    ok(res, {
      updatedCount: result.matchedCount,
    }, `${result.matchedCount} ${resourceType}(s) updated successfully`);
  } catch (error) {
    console.error("Error bulk updating:", error);
    serverError(res, "Error performing bulk update");
  }
};

/**
 * @desc Change user role/status (Admin only for role changes)
 * @route PUT /api/governance/user/:userId/role
 * @access Admin, HOD (block/unblock only)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole, isBlocked } = req.body;
    const user = req.user;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return notFound(res, "User not found");
    }

    // Only Admin can change roles
    if (newRole && user.role !== "Admin") {
      return forbidden(res, "Only Admin can change user roles");
    }

    if (newRole && !VALID_ROLES.includes(newRole)) {
      return badRequest(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    if (newRole && user._id.toString() === userId) {
      return badRequest(res, 'Admins cannot change their own role');
    }

    // HOD can block/unblock department users
    if (isBlocked !== undefined && user.role === "HOD") {
      if (
        !targetUser.department ||
        !user.department ||
        targetUser.department.toString() !== user.department.toString()
      ) {
        return forbidden(res, "HOD can only manage users in their department");
      }
    }

    const oldRole = targetUser.role;
    const oldStatus = targetUser.status;

    if (newRole) {
      targetUser.role = newRole;
    }
    if (isBlocked !== undefined) {
      targetUser.status = isBlocked ? 'Blocked' : 'Approved';
    }

    await targetUser.save();

    // Profile lifecycle management
    if (newRole) {
      // 1. Delete irrelevant profiles (Only if NOT moving to Admin)
      if (newRole !== "Admin") {
        if (newRole !== "HOD") {
          await HOD.deleteOne({ userId: targetUser._id });
          await Department.updateMany({ hod: targetUser._id }, { $set: { hod: null } });
        }
        if (newRole !== "Teacher" && newRole !== "HOD") {
          await Teacher.deleteOne({ userId: targetUser._id });
        }
        if (newRole !== "Student") {
          await Student.deleteOne({ userId: targetUser._id });
        }
        if (newRole !== "Seller") {
          await Seller.deleteOne({ userId: targetUser._id });
        }
      }

      // 2. Ensure target profile exists for the primary role
      if (newRole === "HOD") {
        const existing = await HOD.findOne({ userId: targetUser._id });
        if (!existing) await HOD.create({ userId: targetUser._id, department: targetUser.department });
        const existingTeacher = await Teacher.findOne({ userId: targetUser._id });
        if (!existingTeacher) await Teacher.create({ userId: targetUser._id, department: targetUser.department });
      } else if (newRole === "Teacher") {
        const existing = await Teacher.findOne({ userId: targetUser._id });
        if (!existing) await Teacher.create({ userId: targetUser._id, department: targetUser.department });
      } else if (newRole === "Student") {
        const existing = await Student.findOne({ userId: targetUser._id });
        if (!existing) await Student.create({ userId: targetUser._id, department: targetUser.department });
      } else if (newRole === "Seller") {
        const existing = await Seller.findOne({ userId: targetUser._id });
        if (!existing) await Seller.create({ userId: targetUser._id });
      }
    }

    // Log the change
    await logActivity({
      actor: {
        userId: user._id,
        name: user.name,
        role: user.role,
        department: user.department,
      },
      action: newRole ? "user_role_changed" : "user_status_changed",
      resource: "user",
      resourceId: targetUser._id,
      resourceName: targetUser.name,
      scope: "global",
      details: {
        before: { role: oldRole, isBlocked: oldStatus },
        after: { role: targetUser.role, isBlocked: targetUser.status },
      },
      status: "success",
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      visibility: "admin_only",
      tags: ["governance", "user_management"],
    });

    ok(res, {
      user: targetUser,
    }, "User updated successfully");
  } catch (error) {
    console.error("Error updating user:", error);
    serverError(res, "Error updating user");
  }
};

/**
 * @desc Get edit history for a resource
 * @route GET /api/governance/history/:resourceType/:resourceId
 * @access Admin, HOD (department scope)
 */
export const getResourceEditHistory = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const user = req.user;

    const modelMap = {
      event: Event,
      assignment: Assignment,
      quiz: Quiz,
      post: Post,
      material: Material,
      user: User,
    };

    const Model = modelMap[resourceType];
    if (!Model) {
      return badRequest(res, "Invalid resource type");
    }

    const resource = await Model.findById(resourceId).populate(
      "editHistory.editor",
      "name role",
    );

    if (!resource) {
      return notFound(res, "Resource not found");
    }

    // Authorization check
    if (user.role === "HOD") {
      if (
        !resource.department ||
        !user.department ||
        resource.department.toString() !== user.department.toString()
      ) {
        return forbidden(res, "Cannot access resource history");
      }
    }

    ok(res, {
      resource: {
        id: resource._id,
        title: resource.title || resource.name,
        type: resourceType,
      },
      editHistory: resource.editHistory || [],
    }, "Edit history retrieved successfully");
  } catch (error) {
    console.error("Error fetching edit history:", error);
    serverError(res, "Error fetching edit history");
  }
};

/**
 * @desc List all resources for bulk management
 * @route GET /api/governance/resources/:resourceType?department=xyz&status=active
 * @access Admin, HOD
 */
export const getResourcesForManagement = async (req, res) => {
  try {
    const { resourceType } = req.params;
    const { department, status, limit = 50, skip = 0 } = req.query;
    const user = req.user;

    const modelMap = {
      event: Event,
      assignment: Assignment,
      quiz: Quiz,
      post: Post,
      material: Material,
      user: User,
    };

    const Model = modelMap[resourceType];
    if (!Model) {
      return badRequest(res, "Invalid resource type");
    }

    let query = {};

    // HOD scope filtering
    if (user.role === "HOD") {
      query.department = user.department;
    } else if (department) {
      query.department = department;
    }

    // Additional filters
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    const projections = {
      user:       'name email role department status createdAt',
      event:      '_id title department author createdAt isActive',
      assignment: '_id title department author createdAt isActive',
      quiz:       '_id title department author createdAt isActive',
      post:       '_id title author createdAt',
      material:   '_id title author createdAt isDownloadable',
    };

    const projection = projections[resourceType] || '_id title createdAt';

    const total = await Model.countDocuments(query);
    const resources = await Model.find(query)
      .select(projection)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 })
      .lean();

    ok(res, {
      resourceType,
      data: resources,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        pages: Math.ceil(total / parseInt(limit)),
      },
    }, "Resources retrieved successfully");
  } catch (error) {
    console.error("Error fetching resources:", error);
    serverError(res, "Error fetching resources");
  }
};
