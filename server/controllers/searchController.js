// server/controllers/searchController.js
import User from "../models/User.js";
import Event from "../models/Event.js";
import Quiz from "../models/Quiz.js";
import Certificate from "../models/Certificate.js";
import QuizSubmission from "../models/QuizSubmission.js";
import Post from "../models/Post.js";
import Material from "../models/Material.js";
import Media from "../models/Media.js";
import Product from "../models/Product.js";
import Department from "../models/Department.js";
import Subject from "../models/Subject.js";
import Assignment from "../models/Assignment.js";
import { ok, badRequest, serverError } from "../utils/index.js";

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return ok(res, {
        users: [],
        events: [],
        quizzes: [],
        certificates: [],
      }, "Empty search query.");
    }

    if (q.length > 100) return badRequest(res, 'Search query too long (max 100 characters)');

    const regex = new RegExp(escapeRegExp(q), "i"); // Safe Case-insensitive search
    const currentUserId = req.user._id;
    const isQuick = req.query.quick === 'true';
    const limitSize = isQuick ? 4 : 20;

    const isAdmin = req.user.role === 'Admin';
    const isHOD = req.user.role === 'HOD';
    const isTeacher = req.user.role === 'Teacher';
    const currentDeptId = req.user.department;

    // 1. Search Users (Publicly visible users)
    const usersPromise = User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        { status: 'Approved' },
        {
          $or: [
            { name: regex },
            { role: regex },
            { bio: regex },
            { 'emails.address': regex },
            { skills: regex }
          ]
        }
      ]
    })
      .select("name role department profilePicture bio skills")
      .populate("department", "name")
      .limit(limitSize);

    // 2. Search Events (Public or Created by User)
    let eventFilters = [ { isPublic: true }, { author: currentUserId } ];
    if (isAdmin) eventFilters = [{}];
    else if (isHOD && currentDeptId) eventFilters.push({ department: currentDeptId });
    else if (isTeacher && currentDeptId) eventFilters.push({ department: currentDeptId });

    const eventsPromise = Event.find({
      $and: [
        {
          $or: [{ title: regex }, { category: regex }, { description: regex }, { location: regex }],
        },
        { $or: eventFilters },
      ],
    }).limit(limitSize);

    // 3. Search Quizzes (Personalized)
    const attemptedQuizIds = await QuizSubmission.distinct('quiz', { student: currentUserId });

    let quizFilters = [{ author: currentUserId }, { _id: { $in: attemptedQuizIds } }];
    if (isAdmin) quizFilters = [{}];
    else if (isHOD && currentDeptId) quizFilters.push({ department: currentDeptId });
    else if (isTeacher) quizFilters.push({ department: currentDeptId });
    else quizFilters.push({ isActive: true });

    const quizzesPromise = Quiz.find({
      $and: [
        { $or: [{ title: regex }, { subjectName: regex }, { description: regex }] },
        { $or: quizFilters },
      ],
    })
      .select("title subject startDate isActive author")
      .limit(limitSize);

    // 4. Search Certificates (Strictly Personal)
    const certificatesPromise = Certificate.find({
      user: currentUserId,
      title: regex,
    }).limit(limitSize);

    // 5. Search Posts & Media
    const matchingMedia = await Media.find({ title: regex }).select('_id').limit(50);
    const matchingMaterials = await Material.find({
      $or: [
        { description: regex },
        { media: { $in: matchingMedia.map(m => m._id) } }
      ]
    }).select('_id').limit(50);

    const postsPromise = Post.find({
      $and: [
        {
          $or: [
            { content: regex },
            { subjectTag: regex },
            { material: { $in: matchingMaterials.map(m => m._id) } }
          ]
        },
        { isDeleted: { $ne: true } }
      ]
    })
      .populate("author", "name role department profilePicture")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      })
      .limit(limitSize);

    // 6. Search Departments
    const departmentsPromise = Department.find({
      $and: [
        { $or: [{ name: regex }, { code: regex }, { description: regex }] },
        { isActive: true }
      ]
    }).limit(limitSize);

    // 7. Search Subjects
    let subjectFilters = [{}];
    if (!isAdmin) subjectFilters = [{ isActive: true }];

    const subjectsPromise = Subject.find({
      $and: [
        { $or: [{ name: regex }, { code: regex }, { description: regex }] },
        { $or: subjectFilters }
      ]
    }).populate("department", "name").limit(limitSize);

    // 8. Search Assignments
    const assignmentsPromise = Assignment.find({
      $or: [{ title: regex }]
    }).populate("subject", "name code").limit(limitSize);

    // 9. Search Products
    const productsPromise = Product.find({
      $and: [
        { $or: [{ title: regex }, { category: regex }, { description: regex }, { location: regex }] },
        { status: "Available" }
      ]
    }).populate("seller", "name profilePicture").populate({ path: "images", model: "Media" }).limit(limitSize);

    const [users, events, quizzes, certificates, posts, departments, subjects, assignments, products] = await Promise.all([
      usersPromise,
      eventsPromise,
      quizzesPromise,
      certificatesPromise,
      postsPromise,
      departmentsPromise,
      subjectsPromise,
      assignmentsPromise,
      productsPromise
    ]);

    ok(res, { users, events, quizzes, certificates, posts, departments, subjects, assignments, products }, "Search completed successfully.");
  } catch (error) {
    serverError(res, error.message);
  }
};
