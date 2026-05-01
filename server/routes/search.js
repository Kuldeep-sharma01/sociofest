import express from "express";
import { globalSearch } from "../controllers/searchController.js";
import { protect } from "../middleware/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,             // Increased to 120 for live debounced typeahead
  message: { message: 'Too many search requests, please slow down.' },
});

/**
 * @route   GET /api/search
 * @desc    Global search across all resources
 * @access  Private
 */
router.get("/", protect, searchLimiter, globalSearch);

export default router;
