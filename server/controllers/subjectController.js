// server/controllers/subjectController.js
import mongoose from "mongoose";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Notification from "../models/Notification.js";
import { deleteMediaDocs } from "../utils/mediaHelper.js";
import { ok, created, badRequest, notFound, forbidden, logActivity } from "../utils/index.js";

/**
 * @desc    Create a new subject
 * @route   POST /api/subjects
 * @access  Private (Admin, HOD)
 */
export const createSubject = async (req, res, next) => {
  try {
    const { name, code, department, semester, description, assignedTeacher } =
      req.body;

    if (!name || !String(name).trim()) return badRequest(res, 'Subject name is required');
    if (!code || !String(code).trim()) return badRequest(res, 'Subject code is required');
    const parsedSemester = parseInt(semester);
    if (isNaN(parsedSemester) || parsedSemester < 1) {
      return badRequest(res, 'Semester must be a positive integer');
    }
    if (!department) return badRequest(res, 'Department is required');

    // ✅ Validate each teacher ID before querying
    if (assignedTeacher && assignedTeacher.length > 0) {
      const invalidIds = assignedTeacher.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) return badRequest(res, 'One or more teacher IDs are invalid');
      // Also verify all users exist and have Teacher/HOD/Admin role:
      const teacherCount = await User.countDocuments({
        _id: { $in: assignedTeacher },
        role: { $in: ['Teacher', 'HOD', 'Admin'] },
      });
      if (teacherCount !== assignedTeacher.length) {
        return badRequest(res, 'One or more assigned users are not valid faculty members');
      }
    }

    let dept;
    if (mongoose.Types.ObjectId.isValid(department)) {
      dept = await Department.findById(department);
    } else {
      dept = await Department.findOne({ name: department });
    }
    if (!dept) return notFound(res, "Department not found");

    // Strict check: HODs cannot add subjects to other departments
    if (
      req.user.role === "HOD" &&
      String(dept._id) !== String(req.user.department)
    ) {
      return forbidden(res, "Not authorized to add subjects to this department.");
    }

    const normalizedCode = String(code || '').trim().toUpperCase();

    // ✅ After — query the standalone Subject model
    const existingSubject = await Subject.findOne({
      department: dept._id,
      code: normalizedCode,
    });
    if (existingSubject) return badRequest(res, 'Subject with this code already exists in department');

    const subject = await Subject.create({
      name: String(name || '').trim(),
      code: normalizedCode,
      semester: Number(semester),
      description: String(description || '').trim(),
      department: dept._id,
    });
    // Add to dept.subjects ref array:
    dept.subjects.push(subject._id);
    await dept.save();

    const newSubjectId = subject._id;

    if (assignedTeacher && assignedTeacher.length > 0) {
      for (const tId of assignedTeacher) {
        const result = await Teacher.updateOne(
          { userId: tId },
          { $addToSet: { subjects: newSubjectId } },
          { upsert: true }
        );
        if (result.matchedCount === 0) {
          console.warn(`Teacher profile not found for userId ${tId} — skipping subject assignment`);
        }

        const io = req.app.get("io");
        if (io && String(req.user._id) !== String(tId)) {
          const msg = `You have been assigned to teach ${name} by ${req.user.name}.`;
          io.to(tId.toString()).emit("notification", { message: msg });
          await Notification.create({
            recipient: tId,
            actor: req.user._id,
            type: 'subject_assigned',
            message: msg,
          });
        }
      }
    }

    const newSubject = subject.toObject();
    if (assignedTeacher && assignedTeacher.length > 0) {
      const teachers = await User.find({
        _id: { $in: assignedTeacher },
      }).select("name email profilePicture role");
      newSubject.assignedTeacher = teachers;
    }
    created(res, newSubject, "Subject created successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all subjects
 * @route   GET /api/subjects
 * @access  Private
 */
export const getAllSubjects = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit) || 1000);
    const skip  = (page - 1) * limit;

    const [subjects, total] = await Promise.all([
      Subject.find()
        .populate('department', 'name code')
        .sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Subject.countDocuments(),
    ]);

    const subjectIds = subjects.map((s) => s._id);
    const teacherDocs = await Teacher.find({ subjects: { $in: subjectIds } })
      .populate('userId', 'name email role profilePicture')
      .lean();

    // Build a map for O(1) lookup
    const teachersBySubject = {};
    teacherDocs.forEach((t) => {
      t.subjects.forEach((sId) => {
        const key = String(sId);
        if (!teachersBySubject[key]) teachersBySubject[key] = [];
        teachersBySubject[key].push(t.userId);
      });
    });
    subjects.forEach((s) => { s.assignedTeacher = teachersBySubject[String(s._id)] || []; });
    ok(res, { subjects, total, page, pages: Math.ceil(total / limit) }, 'Subjects retrieved.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get subject by ID
 * @route   GET /api/subjects/:id
 * @access  Private
 */
export const getSubjectById = async (req, res, next) => {
  const id = req.params.id;

  // SECURITY FIX: Prevent CastError DoS
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return badRequest(res, "Invalid Subject ID");
  }

  try {
    const subject = await Subject.findById(id).populate('department', 'name code').lean();
    if (!subject) return notFound(res, "Subject not found");

    const teachers = await Teacher.find({ subjects: subject._id }).populate(
      "userId",
      "name email role profilePicture",
    );
    subject.assignedTeacher = teachers.map((t) => t.userId);
    ok(res, subject, "Subject retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get subjects by department
 * @route   GET /api/subjects/department/:departmentId
 * @access  Private
 */
export const getSubjectsByDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findById(req.params.departmentId);
    if (!dept) return notFound(res, "Department not found");
    const subjects = await Subject.find({ department: dept._id }).lean();
    const subjectIds = subjects.map((s) => s._id);
    const teacherDocs = await Teacher.find({ subjects: { $in: subjectIds } })
      .populate('userId', 'name email role profilePicture')
      .lean();

    // Build a map for O(1) lookup
    const teachersBySubject = {};
    teacherDocs.forEach((t) => {
      t.subjects.forEach((sId) => {
        const key = String(sId);
        if (!teachersBySubject[key]) teachersBySubject[key] = [];
        teachersBySubject[key].push(t.userId);
      });
    });
    subjects.forEach((s) => { s.assignedTeacher = teachersBySubject[String(s._id)] || []; });
    ok(res, subjects, "Subjects retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update subject details
 * @route   PUT /api/subjects/:id
 * @access  Private (Admin, HOD)
 */
export const updateSubject = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return badRequest(res, 'Invalid Subject ID');
  }

  try {
    const { name, semester, code, description, assignedTeacher } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return notFound(res, "Subject not found");

    if (req.user.role === 'HOD' &&
        String(subject.department) !== String(req.user.department)) {
      return forbidden(res, 'HOD can only update subjects in their own department');
    }

    const oldTeachersDocs = await Teacher.find({ subjects: subject._id });
    const oldTeachers = oldTeachersDocs.map((t) => t.userId.toString());

    if (name !== undefined) subject.name = name;
    if (semester !== undefined) subject.semester = semester;
    if (code !== undefined) subject.code = code;
    if (description !== undefined) subject.description = description;

    let newTeachers = oldTeachers;
    if (assignedTeacher !== undefined) {
      newTeachers = Array.isArray(assignedTeacher)
        ? assignedTeacher.map((id) => String(id))
        : assignedTeacher
          ? [String(assignedTeacher)]
          : [];
    }

    await subject.save();

    const Quiz = mongoose.model("Quiz");
    if (Quiz) {
      await Quiz.updateMany(
        { subject: subject._id },
        { $set: { subject: subject._id, subjectName: subject.name } },
      );
    }

    const removed = oldTeachers.filter((id) => !newTeachers.includes(id));
    const added = newTeachers.filter((id) => !oldTeachers.includes(id));

    if (removed.length > 0) {
      await Teacher.updateMany(
        {
          userId: { $in: removed.map((id) => new mongoose.Types.ObjectId(id)) },
        },
        { $pull: { subjects: subject._id } },
      );
    }
    if (added.length > 0) {
      for (const teacherId of added) {
        const result = await Teacher.updateOne(
          { userId: new mongoose.Types.ObjectId(teacherId) },
          { $addToSet: { subjects: subject._id } },
          { upsert: true }
        );
        if (result.matchedCount === 0) {
          console.warn(`Teacher profile not found for userId ${teacherId} — skipping subject assignment`);
        }

        const io = req.app.get("io");
        if (io && String(req.user._id) !== String(teacherId)) {
          const msg = `You have been assigned to teach ${subject.name} by ${req.user.name}.`;
          io.to(teacherId.toString()).emit("notification", { message: msg });
          await Notification.create({
            recipient: teacherId,
            actor: req.user._id,
            type: 'subject_assigned',
            message: msg,
          });
        }
      }
    }

    // ORPHAN BUG FIX: Transfer ownership of Materials, Assignments, and Quizzes to the new teacher
    if (removed.length > 0) {
      const newOwnerId = req.user._id;
      const removedIds = removed.map((id) => new mongoose.Types.ObjectId(id));

      const Assignment = mongoose.model("Assignment");
      const Material = mongoose.model("Material");
      const Quiz = mongoose.model("Quiz");

      if (Assignment)
        await Assignment.updateMany(
          { subject: subject._id, author: { $in: removedIds } },
          { $set: { author: newOwnerId } },
        );
      if (Material)
        await Material.updateMany(
          { subject: subject._id, author: { $in: removedIds } },
          { $set: { author: newOwnerId } },
        );
      if (Quiz)
        await Quiz.updateMany(
          { subject: subject._id, author: { $in: removedIds } },
          { $set: { author: newOwnerId } },
        );

      await logActivity({
        actor: { userId: req.user._id, name: req.user.name, role: req.user.role },
        action: 'content_ownership_transferred',
        resource: 'subject',
        resourceId: subject._id,
        details: { removedTeachers: removed, newOwner: newOwnerId },
        status: 'success',
        visibility: 'admin_only',
        tags: ['governance', 'ownership_transfer'],
      });
    }

    const updatedSubject = subject.toObject();
    const finalTeachers = await Teacher.find({
      subjects: updatedSubject._id,
    }).populate("userId", "name email role profilePicture");
    updatedSubject.assignedTeacher = finalTeachers.map((t) => t.userId);
    ok(res, updatedSubject, "Subject updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a subject
 * @route   DELETE /api/subjects/:id
 * @access  Private (Admin)
 */
export const deleteSubject = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return badRequest(res, 'Invalid Subject ID');
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const subjectToDelete = await Subject.findById(req.params.id).session(session);
    if (!subjectToDelete) {
      await session.abortTransaction();
      session.endSession();
      return notFound(res, "Subject not found");
    }

    const dept = await Department.findById(subjectToDelete.department).session(session);

    if (dept) {
      dept.subjects.pull(req.params.id);
      await dept.save({ session });
    }

    // Deep clean orphaned references from all Teacher and Student profiles
    await Teacher.updateMany({ subjects: req.params.id }, { $pull: { subjects: req.params.id } }, { session });
    await Student.updateMany({ subjects: req.params.id }, { $pull: { subjects: req.params.id } }, { session });

    // GHOST RECORD FIX: Delete all associated Quizzes, Assignments, and Materials + physical files
    const Assignment = mongoose.model("Assignment");
    const Material = mongoose.model("Material");
    const Quiz = mongoose.model("Quiz");
    const AssignmentSubmission = mongoose.model("AssignmentSubmission");
    const QuizSubmission = mongoose.model("QuizSubmission");

    let mediaToDelete = [];

    if (Assignment) {
      const assignments = await Assignment.find({ subject: req.params.id }).session(session);
      const assignmentIds = assignments.map((a) => a._id);
      const materialIds = assignments.map((a) => a.material).filter(Boolean);
      
      if (materialIds.length > 0) {
          const assignmentMaterials = await Material.find({ _id: { $in: materialIds } }).session(session);
          for (const m of assignmentMaterials) {
              if (m.media && m.media.length > 0) mediaToDelete.push(...m.media);
          }
          await Material.deleteMany({ _id: { $in: materialIds } }, { session });
      }
      if (AssignmentSubmission) {
        const submissions = await AssignmentSubmission.find({
          assignment: { $in: assignmentIds },
        }).session(session);
        for (const sub of submissions) {
          if (sub.media && sub.media.length > 0)
            mediaToDelete.push(...sub.media);
        }
        await AssignmentSubmission.deleteMany({
          assignment: { $in: assignmentIds },
        }, { session });
      }
      await Assignment.deleteMany({ subject: req.params.id }, { session });
    }

    if (Material) {
      const materials = await Material.find({ subject: req.params.id }).session(session);
      for (const m of materials) {
        if (m.media && m.media.length > 0) mediaToDelete.push(...m.media);
      }
      await Material.deleteMany({ subject: req.params.id }, { session });
    }

    await deleteMediaDocs(mediaToDelete);

    if (Quiz) {
      const quizzes = await Quiz.find({
        subject: req.params.id,
      }).session(session);
      const quizIds = quizzes.map((q) => q._id);
      if (QuizSubmission) {
        await QuizSubmission.deleteMany({ quiz: { $in: quizIds } }, { session });
      }
      await Quiz.deleteMany({ _id: { $in: quizIds } }, { session });
    }

    await Subject.deleteOne({ _id: req.params.id }, { session });

    await session.commitTransaction();
    ok(res, null, "Subject deleted successfully.");
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Assign teacher to a subject
 * @route   POST /api/subjects/:id/assign
 * @access  Private (HOD, Admin)
 */
export const assignTeacherToSubject = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return badRequest(res, 'Invalid Subject ID');
  }

  try {
    const { teacherId } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return notFound(res, "Subject not found");

    if (req.user.role === 'HOD' &&
        String(subject.department) !== String(req.user.department)) {
      return forbidden(res, 'HOD can only assign teachers within their own department');
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || !["Teacher", "HOD", "Admin"].includes(teacher.role)) {
      return badRequest(res, "Invalid user ID. Must be faculty.");
    }

    const result = await Teacher.updateOne(
      { userId: teacherId },
      { $addToSet: { subjects: subject._id } },
      { upsert: true }
    );
    if (result.matchedCount === 0) {
      console.warn(`Teacher profile not found for userId ${teacherId} — skipping subject assignment`);
    }

    const io = req.app.get("io");
    if (io && String(req.user._id) !== String(teacherId)) {
      const msg = `You have been assigned to teach ${subject.name} by ${req.user.name}.`;
      io.to(teacherId.toString()).emit("notification", { message: msg });
      await Notification.create({
        recipient: teacherId,
        actor: req.user._id,
        type: 'subject_assigned',
        message: msg,
      });
    }

    const updatedSubject = subject.toObject();
    const finalTeachers = await Teacher.find({
      subjects: updatedSubject._id,
    }).populate("userId", "name email role profilePicture");
    updatedSubject.assignedTeacher = finalTeachers.map((t) => t.userId);

    ok(res, updatedSubject, "Teacher assigned successfully.");
  } catch (error) {
    next(error);
  }
};
