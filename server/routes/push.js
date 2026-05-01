import express from "express";
import { subscribeToPush } from "../controllers/pushController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @route   POST /api/push/subscribe
 * @desc    Subscribe a device to push notifications
 * @access  Private
 */
router.post("/subscribe", protect, subscribeToPush);

export default router;
