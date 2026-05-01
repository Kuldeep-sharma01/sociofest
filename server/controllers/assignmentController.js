import Assignment from "../models/Assignment.js";
import Notification from "../models/Notification.js";
import { processUpload, deleteMediaDocs, processExternalUrl, normalizeArr } from "../utils/mediaHelper.js";
import fs from "fs/promises";
import path from "path";
import Media from "../models/Media.js";
import Material from "../models/Material.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import Subject from "../models/Subject.js";
import Student from "../models/Student.js";
import { ok, created, badRequest, notFound, forbidden, unprocessableEntity, sendPaginated, serverError } from '../utils/index.js';

const isHttpUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const populateSubmissions = async (assignments, requestingUser) => {
  const isArray = Array.isArray(assignments);
  const arr = isArray ? assignments : [assignments];
  if (arr.length === 0) return isArray ? [] : null;

  const ids = arr.map((a) => a._id);
   // Build query — students only see their own submission
  const submissionQuery = { assignment: { $in: ids } };
  const isStudent = requestingUser?.role === "Student";
  if (isStudent) submissionQuery.student = requestingUser._id;

    const submissions = await AssignmentSubmission.find(submissionQuery)
    .populate("student", "name email profilePicture")
    .populate({ path: "media", model: "Media" })
    .lean();

  arr.forEach((a) => {
    a.submissions = submissions.filter(
      (sub) => String(sub.assignment) === String(a._id),
      
    );
    // Students get mySubmission shortcut
    if (isStudent) {
      a.mySubmission = a.submissions[0] || null;
      delete a.submissions; // don't expose the full array to students
    }
  });
  return isArray ? arr : arr[0];
};

export const submitAssignment = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { textAnswer } = req.body;
    const studentId = req.user._id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return notFound(res, "Assignment not found.");

    // ✅ Block late submissions
    if (new Date() > new Date(assignment.dueDate)) {
      return badRequest(res, "Assignment deadline has passed. Submissions are no longer accepted.");
    }

    // ✅ Verify student is enrolled in the subject
    const studentProfile = await Student.findOne({ userId: studentId }).lean();
    if (!studentProfile) return notFound(res, "Student profile not found.");

    const isEnrolled = studentProfile.subjects?.some(
      (s) => s.toString() === assignment.subject.toString()
    );
    if (!isEnrolled) {
      return forbidden(res, "You are not enrolled in the subject this assignment belongs to.");
    }

    let mediaIds = [];
    let titleDescIndex = 0;
    let mediaTitles = normalizeArr(req.body.mediaTitles);
    let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
    let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map((v) => String(v) === "true");

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const media = await processUpload(file, "study_hub/assignments");
        media.set("title", mediaTitles[titleDescIndex] || "", { strict: true });
        media.set("description", mediaDescriptions[titleDescIndex] || "", { strict: true });
        media.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, { strict: true });
        await media.save();
        mediaIds.push(media._id);
        titleDescIndex++;
      }
    }

    if (req.body.mediaUrls || req.body.newMediaUrls) {
      const rawUrls = req.body.newMediaUrls || req.body.mediaUrls;
      const rawTypes = req.body.newMediaTypes || req.body.mediaTypes;
      const urls = normalizeArr(rawUrls);
      const types = normalizeArr(rawTypes);
      for (let i = 0; i < urls.length; i++) {
        if (!isHttpUrl(urls[i])) return badRequest(res, `Invalid URL: ${urls[i]}`);
        const mId = await processExternalUrl(
          urls[i],
          types[i] || "document",
          mediaTitles[titleDescIndex] || "",
          mediaDescriptions[titleDescIndex] || "",
          mediaDownloadable[titleDescIndex] ?? true,
        );
        mediaIds.push(mId);
        titleDescIndex++;
      }
    }

    let submission = await AssignmentSubmission.findOne({
      assignment: assignmentId,
      student: studentId,
    });

    if (submission) {
      // Fix: Retain previously uploaded files on resubmission instead of blindly wiping them out
      let retainedIds = submission.media || [];
      if (req.body.retainedMediaIds !== undefined) {
        if (req.body.retainedMediaIds === "[]") {
          retainedIds = [];
        } else {
          retainedIds = Array.isArray(req.body.retainedMediaIds)
            ? req.body.retainedMediaIds
            : [req.body.retainedMediaIds];
        }
        const existingMediaDownloadable = normalizeArr(req.body.existingMediaDownloadable).map((v) => String(v) === "true");
        const orphanedDocs = [];
        if (submission.media && submission.media.length > 0) {
          const existingMedia = await Media.find({ _id: { $in: submission.media } });
          for (const mDoc of existingMedia) {
            const retainIndex = retainedIds.indexOf(mDoc._id.toString());
            if (retainIndex !== -1) {
              if (existingMediaDownloadable[retainIndex] !== undefined) {
                mDoc.set("isDownloadable", existingMediaDownloadable[retainIndex], { strict: true });
                await mDoc.save();
              }
            } else {
              orphanedDocs.push(mDoc);
            }
          }
        }
        await deleteMediaDocs(orphanedDocs.map((o) => o._id));
      }

if (textAnswer !== undefined) submission.textAnswer = textAnswer;
      submission.media = [...retainedIds, ...mediaIds];
      await submission.save();
    } else {
      if (!textAnswer && mediaIds.length === 0) {
        return badRequest(res, "Please provide text or upload a file.");
      }

      await AssignmentSubmission.create({
        assignment: assignmentId,
        student: studentId,
        textAnswer,
        media: mediaIds,
      });
    }

    // Populate deeply for unified frontend rendering
    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    // 🚀 Notify the teacher that a new submission was received
    const io = req.app.get("io");
    if (io) {
      const msg = `${req.user.name} submitted an answer for "${assignment.title}".`;
      io.to(assignment.author.toString()).emit("notification", {
        message: msg,
      });
      await Notification.create({
        recipient: assignment.author,
        actor: req.user._id,
        type: "assignment_submitted",
        message: msg,
      });
    }

    ok(res, await populateSubmissions(populatedAssignment, req.user), "Assignment submitted successfully.");
  } catch (error) {
    console.error("Error submitting assignment:", error);
    serverError(res);
  }
};

export const createAssignment = async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    // Support both /:id and /:subjectId depending on how your router is configured
    console.log("Received create assignment request with body:", req.body);
const subjectId = req.params.subjectId;

    let mediaIds = [];
    let titleDescIndex = 0;
    let mediaTitles = normalizeArr(req.body.mediaTitles);
    let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
    let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map((v) => String(v) === "true");

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const media = await processUpload(file, "study_hub/assignments");
        media.set("title", mediaTitles[titleDescIndex] || "", { strict: true });
        media.set("description", mediaDescriptions[titleDescIndex] || "", { strict: true });
        media.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, { strict: true });
        await media.save();
        mediaIds.push(media._id);
        titleDescIndex++;
      }
    }

    if (req.body.mediaUrls) {
      const urls = normalizeArr(req.body.mediaUrls);
      const types = normalizeArr(req.body.mediaTypes);
      for (let i = 0; i < urls.length; i++) {
        if (!isHttpUrl(urls[i])) return badRequest(res, `Invalid URL: ${urls[i]}`);
        const mId = await processExternalUrl(
          urls[i],
          types[i] || "document",
          mediaTitles[titleDescIndex] || "",
          mediaDescriptions[titleDescIndex] || "",
          mediaDownloadable[titleDescIndex] ?? true,
        );
        mediaIds.push(mId);
        titleDescIndex++;
      }
    } else if (req.body.mediaUrl && req.body.mediaUrl !== "null" && req.body.mediaUrl !== "undefined") {
      if (!isHttpUrl(req.body.mediaUrl)) return badRequest(res, "Invalid media URL.");
      const mId = await processExternalUrl(req.body.mediaUrl, req.body.mediaType || "document", mediaTitles[titleDescIndex] || "", mediaDescriptions[titleDescIndex] || "", mediaDownloadable[titleDescIndex] ?? true);
      mediaIds.push(mId);
      titleDescIndex++;
    }

    let materialId = null;
    if (description || mediaIds.length > 0) {
      const materialDoc = await Material.create({
        author: req.user._id,
        description: description || "",
        subject: subjectId,
        media: mediaIds,
      });
      materialId = materialDoc._id;
    }

    const assignment = await Assignment.create({
      title,
      dueDate,
      subject: subjectId,
      author: req.user._id,
      material: materialId,
    });

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    // Broadcast real-time notification
    const io = req.app.get("io");
    if (io) {
      const subjectDoc = await Subject.findById(subjectId).select('department').lean();
      const msg = `New assignment posted: ${assignment.title}`;
      const room = subjectDoc?.department ? `dept:${subjectDoc.department.toString()}` : `subject:${subjectId}`;
      io.to(room).emit("notification", { message: msg });

      await Notification.create({
        recipient: null, // Broadcast to department
        actor: req.user._id,
        type: "assignment_created",
        message: msg,
        departmentId: subjectDoc?.department || null,
        details: { assignmentId: assignment._id, subjectId },
      });
      io.to(room).emit("new activity", { type: "assignment", id: assignment._id });
    }

    created(res, await populateSubmissions(populatedAssignment, req.user), "Assignment created successfully.");
  } catch (error) {
    console.error("Error creating assignment:", error);
    serverError(res);
  }
};

export const getAssignmentsBySubject = async (req, res) => {
  try {
    const subjectId = req.params.id || req.params.subjectId;
    const assignments = await Assignment.find({ subject: subjectId })
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .sort({ createdAt: -1 })
      .lean();
console.log("Fetched assignments for subject", subjectId, ":", assignments);
    ok(res, await populateSubmissions(assignments, req.user), "Assignments retrieved successfully.");
  } catch (error) {
    console.error("Error fetching assignments:", error);
    serverError(res);
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const { grade, feedback } = req.body;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return notFound(res, "Assignment not found.");
    }

    // Security: Only Admin, HOD, or the Assignment Creator can grade this
    if (
      assignment.author.toString() !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to grade this assignment.");
    }

    const submission = await AssignmentSubmission.findOne({
      assignment: assignmentId,
      student: studentId,
    });

    if (!submission) {
      return notFound(res, "Submission not found.");
    }

    // ✅ In gradeSubmission, replace the loose grade check:
if (grade !== undefined && grade !== "") {
  const parsedGrade = Number(grade);
  if (!Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > 100) {
    return badRequest(res, "Grade must be a number between 0 and 100.");
  }
  submission.grade = parsedGrade;
}
    if (feedback !== undefined) submission.feedback = feedback;

    await submission.save();

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    const io = req.app.get("io");
    if (io) {
      const msg = `Your assignment "${assignment.title}" was graded: ${grade}/100. ${feedback ? `Feedback: ${feedback}` : ""}`;
      io.to(studentId).emit("notification", { message: msg });
      await Notification.create({
        recipient: studentId,
        actor: req.user._id,
        type: "assignment_graded",
        message: msg,
      });
    }

    ok(res, await populateSubmissions(populatedAssignment, req.user), "Submission graded successfully.");
  } catch (error) {
    console.error("Error grading submission:", error);
    serverError(res);
  }
};

export const updateAssignment = async (req, res) => {
  try {

    const { title, description, dueDate } = req.body;
    console.log("Received update assignment request with body:", req.body);
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment)
      return notFound(res, "Assignment not found.");

    if (
      assignment.author.toString() !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to edit this assignment.");
    }

    if (title) assignment.title = title;
    if (dueDate) assignment.dueDate = dueDate;

    if (description !== undefined || req.body.retainedMediaIds !== undefined || req.body.newMediaUrls !== undefined || (req.files && req.files.length > 0)) {
      let mat = assignment.material
        ? await Material.findById(assignment.material)
        : new Material({ author: req.user._id, subject: assignment.subject });
      
      if (!mat) {
          mat = new Material({ author: req.user._id, subject: assignment.subject });
      }

      if (description !== undefined) mat.description = description;

      if (
        req.body.retainedMediaIds !== undefined ||
        req.body.newMediaUrls !== undefined ||
        (req.files && req.files.length > 0)
      ) {
        let retainedIds = [];
        if (req.body.retainedMediaIds === "[]") {
          retainedIds = [];
        } else if (req.body.retainedMediaIds) {
          retainedIds = Array.isArray(req.body.retainedMediaIds)
            ? req.body.retainedMediaIds
            : [req.body.retainedMediaIds];
        }
        const existingMediaDownloadable = normalizeArr(req.body.existingMediaDownloadable).map((v) => String(v) === "true");
        const orphanedDocs = [];

        if (mat.media && mat.media.length > 0) {
          const existingMedia = await Media.find({ _id: { $in: mat.media } });
          for (const mDoc of existingMedia) {
            const retainIndex = retainedIds.indexOf(mDoc._id.toString());
            if (retainIndex !== -1) {
              if (existingMediaDownloadable[retainIndex] !== undefined) {
                mDoc.set("isDownloadable", existingMediaDownloadable[retainIndex], { strict: true });
                await mDoc.save();
              }
            } else {
              orphanedDocs.push(mDoc);
            }
          }
        }
        await deleteMediaDocs(orphanedDocs.map((o) => o._id));

        const newMediaIds = [...retainedIds];
        let mediaTitles = normalizeArr(req.body.mediaTitles);
        let mediaDescriptions = normalizeArr(req.body.mediaDescriptions);
        let mediaDownloadable = normalizeArr(req.body.mediaDownloadable).map((v) => String(v) === "true");
        let titleDescIndex = 0;

        if (req.files && req.files.length > 0) {
          for (let i = 0; i < req.files.length; i++) {
            const f = req.files[i];
            const m = await processUpload(f, "study_hub/assignments");
            m.set("title", mediaTitles[titleDescIndex] || "", { strict: true });
            m.set("description", mediaDescriptions[titleDescIndex] || "", { strict: true });
            m.set("isDownloadable", mediaDownloadable[titleDescIndex] ?? true, { strict: true });
            await m.save();
            newMediaIds.push(m._id);
            titleDescIndex++;
          }
        }

        if (req.body.newMediaUrls) {
          const urls = normalizeArr(req.body.newMediaUrls);
          const types = normalizeArr(req.body.newMediaTypes);
          for (let i = 0; i < urls.length; i++) {
            if (!isHttpUrl(urls[i])) return badRequest(res, `Invalid URL: ${urls[i]}`);
            const mId = await processExternalUrl(urls[i], types[i] || "document", mediaTitles[titleDescIndex] || "", mediaDescriptions[titleDescIndex] || "", mediaDownloadable[titleDescIndex] ?? true);
            newMediaIds.push(mId);
            titleDescIndex++;
          }
        }
        mat.media = newMediaIds;
      }

      await mat.save();
      assignment.material = mat._id;
    }
    
    await assignment.save();

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .lean();

    const io = req.app.get("io");
    if (io) {
      io.to(`subject:${assignment.subject.toString()}`).emit("new activity", {
        type: "assignment",
        id: assignment._id,
      });
    }

    ok(res, await populateSubmissions(populatedAssignment, req.user), "Assignment updated successfully.");
  } catch (error) {
    console.error("Error updating assignment:", error);
    serverError(res);
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment)
      return notFound(res, "Assignment not found.");

    if (
      assignment.author.toString() !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to delete this assignment.");
    }

    if (assignment.material) {
      const mat = await Material.findById(assignment.material);
      if (mat) {
        if (mat.media && mat.media.length > 0) await deleteMediaDocs(mat.media);
        await mat.deleteOne();
      }
    }

    const submissions = await AssignmentSubmission.find({
      assignment: assignment._id,
    });
    if (submissions.length > 0) {
      await Promise.all(submissions.map((sub) => deleteMediaDocs(sub.media)));
      await AssignmentSubmission.deleteMany({ assignment: assignment._id });
    }

    await assignment.deleteOne();
    await Notification.deleteMany({
      type: "assignment_created",
      "details.assignmentId": assignment._id,
    });


    const io = req.app.get("io");
    if (io) {
      io.to(`subject:${assignment.subject.toString()}`).emit("remove activity", { type: "assignment", id: assignment._id });
    }

    ok(res, null, "Assignment deleted successfully.");
  } catch (error) {
    console.error("Error deleting assignment:", error);
    serverError(res);
  }
};
