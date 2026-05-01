import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  sendConnectionRequest,
  getConnections,
  getRequests,
  respondToRequest,
  getConnectionStatus,
} from "../controllers/connectionController.js";

const router = express.Router();

router.use(protect);

/**
 * GET Routes - Retrieve Connections and Requests
 */

/**
 * @route   GET /api/connections
 * @desc    Get user's connections
 * @access  Private
 */
router.get("/", getConnections);

/**
 * @route   GET /api/connections/requests
 * @desc    Get pending connection requests
 * @access  Private
 */
router.get("/requests", getRequests);

/**
 * @route   GET /api/connections/status/:userId
 * @desc    Get connection status with a specific user
 * @access  Private
 */
router.get("/status/:userId", getConnectionStatus);

/**
 * POST Routes - Send Requests
 */

/**
 * @route   POST /api/connections/request/:userId
 * @desc    Send a connection request to a user
 * @access  Private
 */
router.post("/request/:userId", sendConnectionRequest);

/**
 * PUT Routes - Manage Requests
 */

/**
 * @route   PUT /api/connections/respond/:requestId
 * @desc    Accept or reject a connection request
 * @access  Private
 */
router.put("/respond/:requestId", respondToRequest);

export default router;
