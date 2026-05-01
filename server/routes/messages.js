import express from "express";
import {
  sendMessage,
  getMessages,
  searchUsersForChat,
  getConversations,
  deleteMessage,
  markMessagesAsRead,
  updateMessage,
  getGlobalUnreadCount,
  createGroup,
  addGroupMembers,
  toggleFavorite,
  updateGroup,
  removeGroupMember,
  getArchivedConversations,
  unarchiveGroup,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { body, param, query } from "express-validator";
import { validateRequest } from "../middleware/validateMiddleware.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const router = express.Router();

// Apply authentication to all chat routes
router.use(protect);

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute per user
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { message: "Too many messages sent. Please slow down." },
});

/**
 * Reusable Validation Parameter Rules
 */
const groupIdValidation = [
  param("groupId").isMongoId().withMessage("Invalid Group ID format"),
];
const messageIdValidation = [
  param("id").isMongoId().withMessage("Invalid Message ID format"),
];
const userIdValidation = [
  param("userId").isMongoId().withMessage("Invalid User ID format"),
];

/**
 * GET Routes - Retrieve Conversations and Messages
 */

router.get("/conversations", getConversations);
router.get("/archived", getArchivedConversations);
router.get("/unread-count", getGlobalUnreadCount);
router.get(
  "/search/users",
  [query("q").optional().isString().trim().escape()],
  validateRequest,
  searchUsersForChat,
);

// ← parameterized LAST
router.get("/:userId", userIdValidation, validateRequest, getMessages);

/**
 * POST Routes - Send Messages and Create Groups
 */

router.post(
  "/send/:receiverId",
  messageLimiter,
  upload.array("files", 10),
  [param("receiverId").isMongoId().withMessage("Invalid Receiver ID")],
  validateRequest,
  sendMessage,
);

router.post(
  "/group",
  [
    body("name").trim().notEmpty().withMessage("Group name is required"),
    body("participants")
      .isArray({ min: 1 })
      .withMessage("At least one participant required"),
    body("participants.*")
      .isMongoId()
      .withMessage("Each participant must be a valid ID"),
  ],
  validateRequest,
  createGroup,
);

/**
 * PUT Routes - Update Messages and Manage Groups
 */

router.put(
  "/read",
  [body("senderId").isMongoId().withMessage("Invalid Sender ID format")],
  validateRequest,
  markMessagesAsRead,
);

router.put(
  "/favorite/:targetId",
  [param("targetId").isMongoId().withMessage("Invalid Target ID")],
  validateRequest,
  toggleFavorite,
);

router.put(
  "/group/:groupId/add",
  [
    ...groupIdValidation,
    body("participants")
      .isArray({ min: 1 })
      .withMessage("Must include at least one participant"),
    body("participants.*")
      .isMongoId()
      .withMessage("Each participant ID must be valid"),
  ],
  validateRequest,
  addGroupMembers,
);

router.put(
  "/group/:groupId/update",
  upload.single("image"),
  groupIdValidation,
  validateRequest,
  updateGroup,
);

router.put(
  "/group/:groupId/remove",
  [
    ...groupIdValidation,
    body("memberId").isMongoId().withMessage("Invalid Member ID"),
  ],
  validateRequest,
  removeGroupMember,
);

router.put(
  "/group/:groupId/unarchive",
  groupIdValidation,
  validateRequest,
  unarchiveGroup,
);

// ← parameterized LAST
router.put(
  "/:id",
  upload.array("files", 10),
  messageIdValidation,
  validateRequest,
  updateMessage,
);

/**
 * DELETE Routes - Remove Messages
 */

router.delete("/:id", messageIdValidation, validateRequest, deleteMessage);

export default router;
