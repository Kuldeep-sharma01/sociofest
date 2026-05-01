// server/routes/posts.js
import express from "express";
import {
  createContent,
  getAllContent,
  getContentById,
  toggleLike,
  addComment,
  deleteContent,
  getNotices,
  getContentByUser,
  updateContent,
  deleteComment,
  updateComment,
} from "../controllers/postController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import { ROLES } from "../utils/rbac.js";
import { body, param } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";

const router = express.Router();

/**
 * Reusable Validation Rules
 */
const postIdValidation = [param("id").isMongoId().withMessage("Invalid Post ID format")];
const userIdValidation = [param("userId").isMongoId().withMessage("Invalid User ID format")];
const commentIdValidation = [param("commentId").isMongoId().withMessage("Invalid Comment ID")];

/**
 * GET Routes - Post Retrieval
 */

/**
 * @route   GET /api/posts
 * @desc    Get all posts (general feed)
 * @access  Private
 */
router.get("/", protect, getAllContent);

/**
 * @route   GET /api/posts/notices
 * @desc    Get notice board posts (Admin/HOD announcements)
 * @access  Private
 */
router.get("/notices", protect, getNotices);
/**
 * @route   GET /api/posts/user/:userId
 * @desc    Get posts by a specific user
 * @access  Private
 */
router.get("/user/:userId", protect, userIdValidation, validateRequest, getContentByUser);

/**
 * @route   GET /api/posts/:id
 * @desc    Get a single post by ID
 * @access  Private
 */
router.get("/:id", protect, postIdValidation, validateRequest, getContentById);

/**
 * POST Routes - Create and Interact
 */

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private (All roles can post)
 */
router.post(
  "/",
  protect,
  upload.array("files", 10),
  [
    body("content").optional().isString().withMessage("Content must be a string"),
    body("isNotice").optional().isBoolean().toBoolean()
  ],
  validateRequest,
  createContent
);

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like or unlike a post
 * @access  Private
 */
router.post("/:id/like", protect, [...postIdValidation, body("type").optional().isString()], validateRequest, toggleLike);

/**
 * @route   POST /api/posts/:id/comment
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post("/:id/comment", protect, [...postIdValidation, body("text").trim().notEmpty().withMessage("Comment text is required").isLength({ max: 2000 }).withMessage("Comment cannot exceed 2000 characters")], validateRequest, addComment);

/**
 * PUT Routes - Update
 */

/**
 * @route   PUT /api/posts/:id
 * @desc    Update a post
 * @access  Private (Author only)
 */
router.put(
  "/:id",
  protect,
  upload.array("files", 10),
  [
    ...postIdValidation, 
    body("content").optional().isString(),
    body("isDeleted").not().exists().withMessage("Use DELETE endpoint to remove content")
  ],
  validateRequest,
  updateContent
);

/**
 * @route   PUT /api/posts/:id/comment/:commentId
 * @desc    Edit a comment on a post
 * @access  Private
 */
router.put("/:id/comment/:commentId", protect, [...postIdValidation, ...commentIdValidation, body("text").trim().notEmpty().withMessage("Comment text is required").isLength({ max: 2000 }).withMessage("Comment cannot exceed 2000 characters")], validateRequest, updateComment);

/**
 * DELETE Routes - Remove
 */

/**
 * @route   DELETE /api/posts/:id/comment/:commentId
 * @desc    Delete a comment from a post
 * @access  Private
 */
router.delete("/:id/comment/:commentId", protect, [...postIdValidation, ...commentIdValidation], validateRequest, deleteComment);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (Author, Admin, or HOD only)
 * @access  Private
 */

router.delete("/:id", protect, postIdValidation, validateRequest, deleteContent);


export default router;
