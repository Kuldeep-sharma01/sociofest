/**
 * server/models/ActivityLog.js
 * Tracks all significant actions in the system for auditing and analytics
 * Supports both MICRO (personal) and MACRO (global/department) views
 */

import mongoose from "mongoose";

// Unified ActivityLog schema
const activityLogSchema = new mongoose.Schema(
  {
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      name: String,
      role: String,
      department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    },
    action: {
      type: String,
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    resourceName: String,
    scope: {
      type: String,
      enum: ["global", "department", "subject", "personal", "public"],
      default: "personal",
    },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    details: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      changes: [
        {
          field: String,
          oldValue: mongoose.Schema.Types.Mixed,
          newValue: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "success",
    },
    errorMessage: String,
    ipAddress: String,
    userAgent: String,
    visibility: {
      type: String,
      enum: ["global", "admin_only", "hod_only", "department", "personal"],
      default: "personal",
    },
    tags: [String],
  },
  {
    timestamps: true,
    collection: "activityLogs",
  },
);

// Indexes for efficient querying
activityLogSchema.index({ "actor.userId": 1, createdAt: -1 }); // User's personal activities
activityLogSchema.index({ departmentId: 1, createdAt: -1 }); // Department activities (MACRO view)
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, resourceId: 1 });
activityLogSchema.index({ resourceId: 1, action: 1 });
activityLogSchema.index({ createdAt: -1 }); // Timeline queries
activityLogSchema.index({ scope: 1, departmentId: 1 }); // Scope-based queries
activityLogSchema.index({ visibility: 1, "actor.userId": 1 }); // Authorization-aware queries

// ✅ Add TTL — expire logs after 1 year (adjust to institutional policy)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("ActivityLog", activityLogSchema);
