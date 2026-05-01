// server/controllers/departmentController.js
import mongoose from "mongoose";
import Department from "../models/Department.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import Material from "../models/Material.js";
import Quiz from "../models/Quiz.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";
import QuizSubmission from "../models/QuizSubmission.js";
import { deleteMediaDocs } from "../utils/mediaHelper.js";
import { ok, created, badRequest, notFound, forbidden } from "../utils/index.js";

const sanitizeSubjects = (subjects) => {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .map((subject) => ({
      name: String(subject.name || subject.subject || "").trim(),
      code: String(subject.code || "").trim(),
      semester: Number(subject.semester) || 1,
      description: String(subject.description || "").trim(),
    }))
    .filter((subject) => subject.name);
};

/**
 * @desc    Create a new department
 * @route   POST /api/departments
 * @access  Private (Admin only)
 */
export const createDepartment = async (req, res, next) => {
  try {
    const {
      name,
      code,
      description = "",
      totalSemesters = 8,
      isActive = true,
      subjects = [],
    } = req.body;

    if (!name || !code) {
      return badRequest(res, "Department name and code are required.");
    }

    const normalizedName = String(name).trim();
    const normalizedCode = String(code).trim().toUpperCase();

    const existing = await Department.findOne({
      $or: [{ name: normalizedName }, { code: normalizedCode }],
    });
    if (existing) {
      return badRequest(res, "A department with that name or code already exists.");
    }

    // ✅ Cap the number of subjects allowed in a single create call
    if (subjects.length > 50) {
      return badRequest(res, 'Cannot create more than 50 subjects at once');
    }

    const sanitizedSubjects = sanitizeSubjects(subjects);

    const department = await Department.create({
      name: normalizedName,
      code: normalizedCode,
      description: String(description).trim(),
      totalSemesters: Number(totalSemesters) > 0 ? Number(totalSemesters) : 8,
      isActive: Boolean(isActive),
      author: req.user?._id || null,
      updatedBy: req.user?._id || null,
      subjects: [],
    });

    if (sanitizedSubjects.length > 0) {
      const subjectDocs = sanitizedSubjects.map((sub) => ({
        ...sub,
        department: department._id,
      }));
      const createdSubjects = await Subject.insertMany(subjectDocs);
      department.subjects = createdSubjects.map((s) => s._id);
      await department.save();
    }

    created(res, department, "Department created successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all departments
 * @route   GET /api/departments
 * @access  Private
 */
export const getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .sort({ name: 1 })
      .populate("hod", "name email role");
    ok(res, departments, "Departments retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get department by ID
 * @route   GET /api/departments/:id
 * @access  Private
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      "hod",
      "name email role",
    );

    if (!department)
      return notFound(res, "Department not found");
    ok(res, department, "Department retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update department details
 * @route   PUT /api/departments/:id
 * @access  Private (Admin only)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const allowedUpdates = [
      "name",
      "code",
      "description",
      "totalSemesters",
      "isActive",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.name) updates.name = String(updates.name).trim();
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase();

    if (updates.totalSemesters !== undefined) {
      const parsed = Number(updates.totalSemesters);
      if (Number.isNaN(parsed) || parsed < 1) {
        return badRequest(res, "totalSemesters must be a positive number.");
      }
      updates.totalSemesters = parsed;
    }

    if (updates.name || updates.code) {
      const conflict = await Department.findOne({
        $or: [
          ...(updates.name ? [{ name: updates.name }] : []),
          ...(updates.code ? [{ code: updates.code }] : []),
        ],
        _id: { $ne: req.params.id },
      });
      if (conflict) {
        return badRequest(res, "Another department already uses that name or code.");
      }
    }

    const department = await Department.findByIdAndUpdate(
      req.params.id,
      {
        ...updates,
        updatedBy: req.user?._id || null,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!department)
      return notFound(res, "Department not found");

    ok(res, department, "Department updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign HOD to a department
 * @route   POST /api/departments/:id/assignHod
 * @access  Private (Admin only)
 */
export const assignHod = async (req, res, next) => {
  try {
    const { hodId } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department)
      return notFound(res, "Department not found");

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== "HOD") {
      return badRequest(res, "User not found or does not have HOD role");
    }
    
    if (hod.department?.toString() !== department._id.toString()) {
      return badRequest(res, "HOD must belong to the same department");
    }

    department.hod = hodId;
    department.updatedBy = req.user?._id || null;
    await department.save();

    ok(res, department, "HOD assigned successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a subject to a department
 * @route   POST /api/departments/:id/addSubject
 * @access  Private (HOD, Admin)
 */
export const addSubjectToDepartment = async (req, res, next) => {
  try {
    const { name, code, semester, description } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department)
      return notFound(res, "Department not found");

    const normalizedName = String(name || "").trim();
    const normalizedCode = String(code || "").trim();
    const normalizedSemester = Number(semester) || 1;
    const normalizedDescription = String(description || "").trim();

    if (!normalizedName) {
      return badRequest(res, "Subject name is required.");
    }
    if (normalizedSemester < 1) {
      return badRequest(res, "Subject semester must be at least 1.");
    }

    const existingSubject = await Subject.findOne({
      department: department._id,
      name: normalizedName
    }).collation({ locale: 'en', strength: 2 });

    if (existingSubject) {
      return badRequest(res, "Subject already exists in this department");
    }

    const subject = await Subject.create({
      name: normalizedName,
      code: normalizedCode,
      semester: normalizedSemester,
      description: normalizedDescription,
      department: department._id
    });
    department.subjects.push(subject._id);
    department.updatedBy = req.user?._id || null;
    await department.save();

    ok(res, department, "Subject added to department.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a department
 * @route   DELETE /api/departments/:id
 * @access  Private (Admin only)
 */
export const deleteDepartment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const department = await Department.findById(req.params.id).session(session);
    if (!department) {
      await session.abortTransaction();
      session.endSession();
      return notFound(res, "Department not found");
    }

    const subjects = await Subject.find({ department: department._id }).session(session);
    const subjectIds = subjects.map((s) => s._id);

    // Clean up orphaned department references in the User collection
    await User.updateMany(
      { department: req.params.id },
      { $set: { department: null } },
      { session }
    );

    // DEEP CLEAN GHOST RECORDS: Destroy all resources tied to the subjects within this department
    if (subjectIds.length > 0) {
      await Teacher.updateMany({ subjects: { $in: subjectIds } }, { $pull: { subjects: { $in: subjectIds } } }, { session });
      await Student.updateMany({ subjects: { $in: subjectIds } }, { $pull: { subjects: { $in: subjectIds } } }, { session });

      let mediaToDelete = [];
      const assignments = await Assignment.find({
        subject: { $in: subjectIds },
      }).session(session);
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
      await Assignment.deleteMany({ subject: { $in: subjectIds } }, { session });

      const materials = await Material.find({ subject: { $in: subjectIds } }).session(session);
      for (const m of materials) {
        if (m.media && m.media.length > 0) mediaToDelete.push(...m.media);
      }
      await Material.deleteMany({ subject: { $in: subjectIds } }, { session });
      if (mediaToDelete.length > 0) await deleteMediaDocs(mediaToDelete);

      const quizzes = await Quiz.find({ subject: { $in: subjectIds } }).session(session);
      const quizIds = quizzes.map((q) => q._id);
      if (QuizSubmission) {
        await QuizSubmission.deleteMany({ quiz: { $in: quizIds } }, { session });
      }
      await Quiz.deleteMany({ _id: { $in: quizIds } }, { session });
      await Subject.deleteMany({ _id: { $in: subjectIds } }, { session });
    }

    await department.deleteOne({ session });
    await session.commitTransaction();
    ok(res, null, "Department deleted successfully.");
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
