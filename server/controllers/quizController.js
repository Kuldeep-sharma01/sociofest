// server/controllers/quizController.js
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Certificate from "../models/Certificate.js"; // Import the Certificate model
import Material from "../models/Material.js";
import Department from "../models/Department.js";
import Subject from "../models/Subject.js";
import QuizSubmission from "../models/QuizSubmission.js";
import Notification from "../models/Notification.js";
import { ok, created, badRequest, notFound, forbidden, unprocessableEntity, serverError } from '../utils/index.js';

// Helper function to populate quiz attempts
const populateAttempts = async (quizzes) => {
  const isArray = Array.isArray(quizzes);
  const arr = isArray ? quizzes : [quizzes];
  if (arr.length === 0) return isArray ? [] : null;

  const ids = arr.map((q) => q._id);
  const attempts = await QuizSubmission.find({ quiz: { $in: ids } })
    .populate("student", "name")
    .lean();

  arr.forEach((q) => {
    q.attempts = attempts.filter((a) => String(a.quiz) === String(q._id));
  });
  return isArray ? arr : arr[0];
};

// Helper function to resolve subject entry from department's subjects array
const resolveSubjectEntry = async (departmentId, subjectIdentifier) => {
  if (!departmentId || !subjectIdentifier) return null;

  if (mongoose.Types.ObjectId.isValid(subjectIdentifier)) {
    const subjectObj = await Subject.findOne({ _id: subjectIdentifier, department: departmentId });
    if (subjectObj) return subjectObj;
  }

  // ✅ Escape before building regex (same fix as Phase 14 searchController)
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizedSubject = escapeRegExp(String(subjectIdentifier || '').trim());
  const regex = new RegExp(`^${normalizedSubject}$`, "i");
  return await Subject.findOne({
    department: departmentId,
    $or: [{ name: regex }, { code: regex }]
  });
};

const VALID_VIOLATION_TYPES = ['no_face', 'multiple_faces', 'camera_denied', 'tab_switch', 'fullscreen_exit', 'window_blur'];

/**
 * @desc      Log an anti-cheat violation during an active quiz attempt
 * @route     POST /api/quizzes/:id/flag
 * @access    Private (Student)
 */
export const flagQuizAttempt = async (req, res) => {
  try {
    const { id } = req.params;
    const { violationType } = req.body;
    const studentId = req.user._id;
    const userRole = req.user.role;

    // Ensure only students can flag attempts for themselves
    if (userRole !== "Student" || String(studentId) !== String(req.user._id)) {
      return forbidden(res, "Only students can flag their own quiz attempts.");
    }

    // Validate quiz ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid quiz ID format.");
    }

    // Validate violation type against an allowed list
    if (!VALID_VIOLATION_TYPES.includes(violationType)) {
      return badRequest(res, `Invalid violation type. Must be one of: ${VALID_VIOLATION_TYPES.join(', ')}.`);
    }

    const quiz = await Quiz.findById(id).select('isActive author title');
    if (!quiz) {
      return notFound(res, "Quiz not found.");
    }
    if (!quiz.isActive) {
      return badRequest(res, "Quiz is not currently active.");
    }

    // Rate-limit flags per student per quiz BEFORE writing to prevent log flooding
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recentFlagResult = await Quiz.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $unwind: "$cheatLogs" },
      { $match: { "cheatLogs.student": studentId, "cheatLogs.timestamp": { $gte: oneMinuteAgo } } },
      { $count: "total" },
    ]);
    const recentFlags = recentFlagResult[0]?.total || 0;
    if (recentFlags >= 5) {
      return badRequest(res, "Too many violation reports for this quiz within a short period.");
    }

    // Push the violation directly to the quiz's cheatLogs array
    await Quiz.updateOne(
      { _id: id },
      {
        $push: {
          cheatLogs: {
            student: studentId,
            violationType: violationType,
            timestamp: new Date(),
          },
        },
      },
    );

    // Notify the teacher about the potential cheating attempt
    const io = req.app.get('io');
    if (io) {
      io.to(quiz.author.toString()).emit('cheat_alert', {
        studentId, studentName: req.user.name,
        quizTitle: quiz.title, violationType,
      });
    }

    ok(res, null, "Violation logged successfully");
  } catch (error) {
    console.error("Error logging violation:", error);
    serverError(res);
  }
};

/**
 * @desc Create a new quiz (Teacher only)
 * @route POST /api/quizzes
 * @access Private (Teacher)
 */
export const createQuiz = async (req, res) => {
  try {
    const { title, subject, questions, startDate, department, shuffle } =
      req.body;
    if (!title || !subject || !questions || questions.length === 0) {
      return badRequest(res, "Title, Subject and questions are required.");
    }
    if (!department) {
      return badRequest(res, "You are Suspicious.");
    }

    // SECURITY FIX: Prevent teachers from creating quizzes for other departments
    if (
      req.user.role !== "Admin" &&
      String(department) !== String(req.user.department)
    ) {
      return forbidden(res, "Not authorized to create a quiz for another department.");
    }

    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      return notFound(res);
    }

    const subjectEntry = await resolveSubjectEntry(departmentDoc._id, subject);
    if (!subjectEntry) {
      return notFound(res, "Subject not found.");
    }

    const quiz = await Quiz.create({
      title,
      subject: subjectEntry._id,
      subjectName: subjectEntry.name,
      department,
      shuffle,
      questions,
      startDate,
      author: req.user._id,
    });

    // Broadcast real-time notification
    const io = req.app.get("io");
    if (io) {
      const room = department ? `dept:${department.toString()}` : 'faculty';
      io.to(room).emit("new activity", { type: "quiz", id: quiz._id });
    }

    created(res, await populateAttempts(quiz), "Quiz created successfully");
  } catch (error) {
    console.error("Error creating quiz:", error);
    serverError(res);
  }
};

/**
 * @desc Get all quizzes
 * @route GET /api/quizzes
 * @access Public (for now)
 */
export const getAllQuizzes = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    let filter = {};
    // Restrict list to the user's department unless they are an Admin
    if (req.user && req.user.role !== "Admin") {
      filter.department = req.user.department;
    }

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .select("-questions -cheatLogs")
        .populate("author", "name role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quiz.countDocuments(filter),
    ]);

    ok(res, { quizzes, total, page, pages: Math.ceil(total / limit) }, "Quizzes retrieved successfully");
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    serverError(res);
  }
};

/**
 * @desc Get quiz by ID
 * @route GET /api/quizzes/:id
 * @access Private
 */
export const getQuizById = async (req, res) => {
  try {
    // Add validation to prevent CastError
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return badRequest(res, "Invalid quiz ID format.");
    }

    const quiz = await Quiz.findById(req.params.id)
      .populate("author", "name role")
      .lean();
    if (!quiz) return notFound(res);

    // Privacy Check: Block access if the user is not an Admin and belongs to a different department
    if (
      req.user &&
      req.user.role !== "Admin" &&
      String(quiz.department) !== String(req.user.department)
    ) {
      return forbidden(res, "Access denied. Quiz belongs to another department.");
    }

    // SECURITY FIX: Prevent DevTools Cheating by stripping correct answers before sending to students
    if (req.user && req.user.role === "Student") {
      if (quiz.questions && Array.isArray(quiz.questions)) {
        quiz.questions.forEach((q) => {
          delete q.correctAnswer;
        });
      }
    }

    const isAuthor = String(quiz.author?._id || quiz.author) === String(req.user._id);
    const isAdmin  = req.user.role === 'Admin';

    if (!isAuthor && !isAdmin) {
      delete quiz.cheatLogs;  // HODs and other teachers cannot see cheat logs they don't own
    }

    ok(res, await populateAttempts(quiz), "Quiz retrieved successfully");
  } catch (error) {
    console.error("Error fetching quiz:", error);
    serverError(res);
  }
};

/**
 * @desc Get quizzes created by a teacher
 * @route GET /api/quizzes/teacher/:teacherId
 * @access Private (Teacher/Admin)
 */
export const getQuizzesByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return badRequest(res, 'Invalid teacher ID');
    }

    const isAdmin = req.user.role === 'Admin';
    const isSelf  = String(req.user._id) === String(teacherId);
    const teacher = await User.findById(teacherId).select('role department');
    const isSameDeptHOD = req.user.role === 'HOD' &&
      teacher && String(teacher.department) === String(req.user.department);

    if (!isAdmin && !isSelf && !isSameDeptHOD) {
      return forbidden(res, 'Not authorized to view this teacher\'s quizzes');
    }

    const quizzes = await Quiz.find({ author: teacherId })
      .sort({
        createdAt: -1,
      })
      .lean();
    ok(res, await populateAttempts(quizzes), "Quizzes retrieved successfully");
  } catch (error) {
    console.error("Error fetching teacher quizzes:", error);
    serverError(res);
  }
};

/**
 * @desc Submit a quiz
 * @route POST /api/quizzes/:id/submit
 * @access Private (Student)
 */
export const submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) return notFound(res);
    if (!quiz.isActive)
      return badRequest(res, "This quiz is closed and no longer accepting submissions.");

    const expectedCount =
      quiz.shuffle > 0 && quiz.shuffle < quiz.questions.length
        ? quiz.shuffle
        : quiz.questions.length;
    if (!answers || answers.length !== expectedCount)
      return badRequest(res, "Invalid answer set.");

    // Version Control: Allow retakes only if the quiz has been updated since their last attempt
    const quizVersionDate = quiz.questionsUpdatedAt || quiz.createdAt;
    const existingAttempt = await QuizSubmission.findOne({
      quiz: quiz._id,
      student: req.user._id,
      submittedAt: { $gte: quizVersionDate },
    });
    if (existingAttempt) {
      return badRequest(res, "You have already completed the latest version of this quiz.");
    }

    let score = 0;
    let submittedCount = 0;
    let normalizedAnswers = [];

    // FIX: Grade by mapping answers to question IDs to support shuffled quizzes
    if (Array.isArray(answers) && answers.length > 0 && typeof answers[0] === 'object' && answers[0].questionId) {
      for (const ans of answers) {
        if (ans.answer !== null && ans.answer !== undefined) {
          submittedCount++;
          const q = quiz.questions.find((q) => q._id.toString() === ans.questionId.toString());
           if (q) {
            const answerIndex = Number(ans.answer);
            if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= q.options.length) {
              return badRequest(res, `Answer index out of range for question ${ans.questionId}`);
            }
            if (q.correctAnswer === answerIndex) score++;
            normalizedAnswers.push({ questionId: q._id, answer: answerIndex });
          }
        }
      }
    } else {
      // Legacy index-based fallback
      for (let i = 0; i < quiz.questions.length; i++) {
        const q = quiz.questions[i];
        if (answers[i] !== null && answers[i] !== undefined) {
          submittedCount++;
          const legacyIndex = Number(answers[i]);
          if (!Number.isInteger(legacyIndex) || legacyIndex < 0 || legacyIndex >= q.options.length) {
            return badRequest(res, `Answer index out of range at position ${i}`);
          }
          if (q.correctAnswer === legacyIndex) score++;
          normalizedAnswers.push({ questionId: q._id, answer: legacyIndex });
        }
      }
    }

    if (submittedCount !== expectedCount)
      return badRequest(res, "Submitted answers count does not match the required questions count.");

    const percentage = (score / expectedCount) * 100;

    // Create the attempt object
    await QuizSubmission.create({
      quiz: quiz._id,
      student: req.user._id,
      answers: normalizedAnswers,
      score: percentage,
    });

    // Re-fetch to get accurate state for response
    const updatedQuiz = await Quiz.findById(quiz._id);

    // **Certificate Generation Logic**
    // If the student scores above a certain threshold (e.g., 80%), generate a certificate.
    let certificateId = null;
    if (percentage >= (quiz.passingScore ?? 80)) {
      try {
        const cert = await Certificate.create({
          user: req.user._id,
          title: `${quiz.title} - Certificate of Achievement`,
          issuedBy: quiz.author,
          quiz: quiz._id,
          score: percentage,
          issuedAt: new Date(),
        });
        certificateId = cert._id;
      } catch (certError) {
        console.error("Non-fatal error creating certificate:", certError);
      }
    }

    const msg = `${req.user.name} completed the quiz "${quiz.title}" with a score of ${percentage.toFixed(0)}%.`;
    const io = req.app.get("io");
    if (io) {
      io.to(quiz.author.toString()).emit("notification", { message: msg });
    }
    await Notification.create({
      recipient: quiz.author,
      actor: req.user._id,
      type: "quiz_submitted",
      message: msg,
    });

    ok(res, { score: percentage, certificateId }, "Quiz submitted successfully.");
  } catch (error) {
    console.error("Error submitting quiz:", error);
    serverError(res);
  }
};

/**
 * @desc Update a quiz (Teacher)
 * @route PUT /api/quizzes/:id
 * @access Private (Teacher)
 */
export const updateQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) return notFound(res);

    const isCreator = quiz.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isSameDeptHOD =
      req.user.role === "HOD" &&
      String(quiz.department) === String(req.user.department);

    if (!isCreator && !isAdmin && !isSameDeptHOD) {
      return forbidden(res, "Not authorized to update this quiz.");
    }

    const { title, questions, startDate, shuffle, subject, department, isActive } = req.body;
    const updateData = { questionsUpdatedAt: new Date() };

    if (title !== undefined) updateData.title = String(title).trim();
    if (questions !== undefined) updateData.questions = questions;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (shuffle !== undefined) updateData.shuffle = Number(shuffle);
    if (department !== undefined) updateData.department = department;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (subject) {
      const targetDepartment = department
        ? department
        : quiz.department;
      const departmentDoc = await Department.findById(targetDepartment);
      if (!departmentDoc) {
        return notFound(res);
      }
      const subjectEntry = await resolveSubjectEntry(departmentDoc._id, subject);
      if (!subjectEntry) {
        return notFound(res);
      }
      updateData.subject = subjectEntry._id;
      updateData.subjectName = subjectEntry.name;
    } else if (department) {
      const departmentDoc = await Department.findById(department);
      if (!departmentDoc) {
        return notFound(res);
      }
      const subjectEntry = await resolveSubjectEntry(departmentDoc._id, quiz.subject);
      if (!subjectEntry) {
        return badRequest(res, "Current subject does not belong to the new department. Provide a valid subject for the new department.");
      }
      updateData.subjectName = subjectEntry.name;
    }

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
      },
    ).lean();
    ok(res, await populateAttempts(updatedQuiz), "Quiz updated successfully");
  } catch (error) {
    console.error("Error updating quiz:", error);
    serverError(res);
  }
};

/**
 * @desc      Close a quiz to new submissions
 * @route     POST /api/quizzes/:id/close
 * @access    Private (Teacher/Admin)
 */
export const closeQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return notFound(res);
    }

    const isCreator = quiz.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isSameDeptHOD =
      req.user.role === "HOD" &&
      String(quiz.department) === String(req.user.department);

    if (!isCreator && !isAdmin && !isSameDeptHOD) {
      return forbidden(res, "Not authorized to close this quiz.");
    }

    quiz.isActive = false;
    await quiz.save();

    ok(res, null, "Quiz has been closed successfully.");
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc      Get leaderboard for a quiz
 * @route     GET /api/quizzes/:id/leaderboard
 * @access    Private (Teacher/Admin)
 */
export const getQuizLeaderboard = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const quiz = await Quiz.findById(req.params.id).select('cheatLogs author department').lean();

    if (!quiz) {
      return notFound(res);
    }

    // ✅ Restrict to quiz author, Admin, or same-dept HOD
    const isAuthor     = String(quiz.author) === String(req.user._id);
    const isAdmin      = req.user.role === 'Admin';
    const isSameDeptHOD = req.user.role === 'HOD' &&
      String(quiz.department) === String(req.user.department);

    if (!isAuthor && !isAdmin && !isSameDeptHOD) {
      return forbidden(res, 'Not authorized to view this leaderboard');
    }

    const [attempts, total] = await Promise.all([
      QuizSubmission.find({ quiz: quiz._id })
        .sort({ score: -1 })
        .skip(skip).limit(limit)
        .populate("student", "name")
        .lean(),
      QuizSubmission.countDocuments({ quiz: quiz._id }),
    ]);

    const leaderboard = attempts.map((attempt) => {
        const studentViolations = (quiz.cheatLogs || [])
          .filter(
            (log) =>
              attempt.student &&
              log.student.toString() === attempt.student._id.toString(),
          )
          .map((log) => log.violationType);

        return {
          studentId: attempt.student?._id || null,
          name: attempt.student?.name || "Deleted User",
          score: attempt.score,
          flags: studentViolations.length, // Total flags
          violations: [...new Set(studentViolations)], // Unique violation types
        };
      });

    ok(res, {
      leaderboard,
      total,
      page,
      pages: Math.ceil(total / limit)
    }, "Leaderboard retrieved successfully");
  } catch (error) {
    serverError(res);
  }
};
/**
 * @desc Delete quiz
 * @route DELETE /api/quizzes/:id
 * @access Private (Teacher/Admin)
 */
export const deleteQuiz = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const quiz = await Quiz.findById(req.params.id).session(session);
    if (!quiz) {
      await session.abortTransaction();
      session.endSession();
      return notFound(res);
    }

    const isCreator = quiz.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isSameDeptHOD =
      req.user.role === "HOD" &&
      String(quiz.department) === String(req.user.department);

    if (!isCreator && !isAdmin && !isSameDeptHOD) {
      await session.abortTransaction();
      session.endSession();
      return forbidden(res, "Not authorized to delete this quiz.");
    }

    await QuizSubmission.deleteMany({ quiz: quiz._id }, { session });
    await Certificate.deleteMany({ quiz: quiz._id }, { session });
    await quiz.deleteOne({ session });

    await session.commitTransaction();

    const io = req.app.get("io");
    if (io) {
      const room = quiz.department ? `dept:${quiz.department.toString()}` : 'faculty';
      io.to(room).emit("remove activity", { type: "quiz", id: quiz._id });
    }

    ok(res, null, "Quiz deleted successfully.");
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting quiz:", error);
    next(error);
  } finally {
    session.endSession();
  }
};
