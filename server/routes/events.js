import express from "express";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controllers/eventController.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

/**
 * GET Routes - Retrieve Events
 */

/**
 * @route   GET /api/events
 * @desc    Get all events
 * @access  Private
 */
router.get("/", protect, getAllEvents);

/**
 * @route   GET /api/events/:id
 * @desc    Get a specific event by ID
 * @access  Private
 */
router.get("/:id", protect, getEventById);

/**
 * POST Routes - Create Events
 */

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private
 */
router.post("/", protect, upload.array("files", 10), createEvent);

/**
 * PUT Routes - Update Events
 */

/**
 * @route   PUT /api/events/:id
 * @desc    Update an event
 * @access  Private
 */
router.put("/:id", protect, upload.array("files", 10), updateEvent);

/**
 * DELETE Routes - Remove Events
 */

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete an event
 * @access  Private
 */
router.delete("/:id", protect, deleteEvent);

export default router;
