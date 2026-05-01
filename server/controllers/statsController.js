import User from "../models/User.js";
import Quiz from "../models/Quiz.js";
import Event from "../models/Event.js";
import Certificate from "../models/Certificate.js";
import QuizSubmission from "../models/QuizSubmission.js";
import { ok, forbidden, notFound, serverError, badRequest } from "../utils/index.js";
import mongoose from "mongoose";

const buildQuizStats = async (quizzes) => {
  const quizIds = quizzes.map((q) => q._id);

  const stats = await QuizSubmission.aggregate([
    { $match: { quiz: { $in: quizIds } } },
    { $group: {
      _id: '$quiz',
      count:      { $sum: 1 },
      totalScore: { $sum: '$score' },
      maxScore:   { $max: '$score' },
    }},
  ]);

  const statsMap = Object.fromEntries(stats.map(s => [String(s._id), s]));

  return quizzes.map((quiz) => {
    const s = statsMap[String(quiz._id)] || { count: 0, totalScore: 0, maxScore: 0 };
    return {
      quizId: quiz._id,
      title: quiz.title,
      subject: quiz.subject,
      isActive: quiz.isActive,
      authorId: quiz.author,
      author: quiz.author?.name || undefined,
      count: s.count,
      avgScore: s.count === 0 ? 0 : parseFloat((s.totalScore / s.count).toFixed(2)),
      maxScore: s.maxScore || 0,
      questionsCount: quiz.questions?.length || 0,
      createdAt: quiz.createdAt,
    };
  });
};

/**
 * @desc    Get platform counts for admin dashboard
 * @route   GET /api/stats/user-counts
 * @access  Private (Admin, HOD)
 */
export const getUserCounts = async (req, res, next) => {
  try {
    let matchQuery = {};
    if (req.user.role === 'HOD' && req.user.department) {
      matchQuery = { department: req.user.department };
    }

    const [students, teachers, admins, quizzes, events, totalUsers, departmentStats] = await Promise.all([
      User.countDocuments({ role: "Student", ...matchQuery }),
      User.countDocuments({ role: "Teacher", ...matchQuery }),
      User.countDocuments({ role: "Admin", ...matchQuery }),
      Quiz.countDocuments(matchQuery),
      Event.countDocuments({ start: { $gte: new Date() } }),
      User.countDocuments(matchQuery),
      User.aggregate([
        { $match: { department: { $exists: true, $ne: null }, ...matchQuery } },
        { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$dept.name', count: { $sum: 1 } } },
        { $project: { name: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ])
    ]);

    ok(res, { totalUsers, students, teachers, admins, quizzes, events, departments: departmentStats.filter(d => d.name) }, "User counts retrieved successfully.");
  } catch (error) {
    console.error("Error in getUserCounts:", error);
    serverError(res);
  }
};

/**
 * @desc    Get aggregate stats for a quiz
 * @route   GET /api/stats/quiz-stats/:quizId
 * @access  Private
 */
export const getQuizStats = async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return notFound(res, "Quiz not found");
    }

    const isAuthor = String(quiz.author) === String(req.user._id);
    const isAdmin  = req.user.role === 'Admin';
    const isHOD    = req.user.role === 'HOD' && String(quiz.department) === String(req.user.department);

    if (!isAuthor && !isAdmin && !isHOD) {
      return forbidden(res, 'Not authorized to view quiz statistics');
    }

    const submissions = await QuizSubmission.find({ quiz: quizId }).lean();
    const total = submissions.length;
    if (total === 0) {
      return ok(res, { average: 0, submissions: 0 }, "Quiz stats retrieved successfully.");
    }

    const sum = submissions.reduce(
      (acc, submission) => acc + (submission.score || 0),
      0,
    );
    const average = sum / total;

    ok(res, { submissions: total, average }, "Quiz stats retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc    Get department overview for HOD dashboard
 * @route   GET /api/stats/hod-overview
 * @access  Private (HOD)
 */
export const getHodOverview = async (req, res, next) => {
  try {
    if (!['Admin', 'HOD'].includes(req.user.role)) {
      return forbidden(res, 'Access denied');
    }

    let targetUserId = req.user._id;

    if (req.query.hodId) {
      if (req.user.role !== 'Admin') {
        return forbidden(res, 'Only Admins can view other HOD overviews');
      }
      if (!mongoose.Types.ObjectId.isValid(req.query.hodId)) {
        return badRequest(res, "Invalid user ID");
      }
      const targetHod = await User.findById(req.query.hodId);
      if (targetHod && req.user.role === "Admin") {
        targetUserId = targetHod._id;
      }
    }

    const hod = await User.findById(targetUserId);

    if (!hod || hod.role !== "HOD") {
      return forbidden(res, "Only HODs or Admins viewing an HOD can access this");
    }

    const department = hod.department;

    const [teachers, students, teachersInDept] = await Promise.all([
      User.countDocuments({ role: "Teacher", department, status: "Approved" }),
      User.countDocuments({ role: "Student", department, status: "Approved" }),
      User.find({
        role: { $in: ["Teacher", "HOD"] },
        department,
      }).select("_id"),
    ]);

    const teacherIds = teachersInDept.map((teacher) => teacher._id);
    const quizzesInDept = await Quiz.find({ author: { $in: teacherIds } }).select("_id").lean();
    const quizIds = quizzesInDept.map((q) => q._id);
    
    const submissionStats = await QuizSubmission.aggregate([
      { $match: { quiz: { $in: quizIds } } },
      { $group: { _id: null, total: { $sum: 1 }, totalScore: { $sum: "$score" } } },
    ]);
    const totalSubmissions = submissionStats[0]?.total || 0;
    const totalScores = submissionStats[0]?.totalScore || 0;
    const avgScore =
      totalSubmissions === 0 ? 0 : totalScores / totalSubmissions;

    ok(res, {
      teachers,
      students,
      quizCount: quizzesInDept.length,
      totalSubmissions,
      avgScore: parseFloat(avgScore.toFixed(2)),
    }, "HOD overview retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc    Get stats/listing for a Teacher's own quizzes or an authorized target teacher
 * @route   GET /api/stats/teacher-overview
 * @access  Private
 */
export const getTeacherStats = async (req, res, next) => {
  try {
    let targetUserId = req.user._id;

    if (req.query.teacherId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.teacherId)) {
        return badRequest(res, "Invalid user ID");
      }
      const targetTeacher = await User.findById(req.query.teacherId);

      if (targetTeacher) {
        const isAdmin = req.user.role === "Admin";
        const isSameDeptHOD =
          req.user.role === "HOD" &&
          String(targetTeacher.department) === String(req.user.department);

        if (isAdmin || isSameDeptHOD) {
          targetUserId = targetTeacher._id;
        }
      }
    }

    const teacher = await User.findById(targetUserId);
    if (!teacher || teacher.role === "Student") {
      return forbidden(res, "Access denied");
    }

    const quizzes = await Quiz.find({ author: teacher._id }).sort({
      createdAt: -1,
    });
    ok(res, { quizStats: await buildQuizStats(quizzes) }, "Teacher stats retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc    Get stats/listing for all quizzes (HOD filtered by department, Admin sees all)
 * @route   GET /api/stats/all-quiz-stats
 * @access  Private (Admin/HOD)
 */
export const getAllQuizStats = async (req, res, next) => {
  try {
    if (!req.user || !["Admin", "HOD"].includes(req.user.role)) {
      return forbidden(res, "Only Admins and HODs can access department stats");
    }

    let query = {};
    if (req.user.role === "HOD" && req.user.department) {
      const deptTeachers = await User.find({
        role: { $in: ['Teacher', 'HOD'] },
        department: req.user.department,
      }).select('_id');
      const teacherIds = deptTeachers.map((t) => t._id);
      query.author = { $in: teacherIds };
    }

    const quizzes = await Quiz.find(query)
      .populate("author", "name")
      .sort({ createdAt: -1 });
    ok(res, { quizStats: await buildQuizStats(quizzes) }, "All quiz stats retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc    Get student overview for dashboards
 * @route   GET /api/stats/student-overview
 * @access  Private
 */
export const getStudentOverview = async (req, res, next) => {
  try {
    let studentId = req.user._id;

    if (req.query.studentId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.studentId)) {
        return badRequest(res, "Invalid user ID");
      }
      const targetStudent = await User.findById(req.query.studentId);

      if (targetStudent) {
        const isAdmin = req.user.role === "Admin";
        const isSameDeptHOD =
          req.user.role === "HOD" &&
          String(targetStudent.department) === String(req.user.department);

        if (!isAdmin && !isSameDeptHOD && String(req.user._id) !== String(targetStudent._id)) {
          return forbidden(res, 'Not authorized to view this student overview');
        }
        studentId = targetStudent._id;
      }
    }

    const submissions = await QuizSubmission.find({ student: studentId })
      .populate("quiz", "title")
      .lean();

    const quizHistory = submissions
      .map((sub) => ({
        title: sub.quiz?.title || "Deleted Quiz",
        score: sub.score,
        date: sub.submittedAt,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const student = await User.findById(studentId).select('department');
    const eventQuery = {
      start: { $gte: new Date() },
      $or: [{ isPublic: true }, { department: student?.department }],
    };

    const isSelf = String(req.user._id) === String(studentId);
    let certQuery = Certificate.find({ user: studentId });
    if (isSelf) {
      certQuery = certQuery.populate("material");
    } else {
      certQuery = certQuery.select("title issuedAt expiresAt").lean();
    }

    const [certificates, upcomingEvents] = await Promise.all([
      certQuery,
      Event.find(eventQuery)
        .sort({ start: 1 })
        .limit(5),
    ]);

    ok(res, { quizHistory, certificates, upcomingEvents }, "Student overview retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};
