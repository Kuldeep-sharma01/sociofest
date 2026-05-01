import mongoose from "mongoose";
import Connection from "../models/Connection.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { ok, created, badRequest, notFound, forbidden } from "../utils/index.js";

/**
 * @desc    Send a connection request
 * @route   POST /api/connections/request/:userId
 * @access  Private
 */
export const sendConnectionRequest = async (req, res, next) => {
  try {
    const recipientId = req.params.userId;
    const requesterId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return badRequest(res, "Invalid user ID");
    }

    if (recipientId === requesterId.toString()) {
      return badRequest(res, "Cannot connect with yourself");
    }

    const recipient = await User.findById(recipientId).select('_id');
    if (!recipient) return notFound(res, 'User not found');

    const existing = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      return badRequest(res, "Connection request already exists");
    }

    await Connection.create({
      requester: requesterId,
      recipient: recipientId,
    });

    const msg = `${req.user.name} sent you a connection request.`;
    const io = req.app.get("io");
    if (io) {
      io.to(recipientId.toString()).emit("notification", { message: msg });
    }

    await Notification.create({
      recipient: recipientId,
      actor: requesterId,
      type: 'connection_request',
      message: msg,
    });

    created(res, null, "Request sent");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all accepted connections
 * @route   GET /api/connections
 * @access  Private
 */
export const getConnections = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const connections = await Connection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: "accepted",
    }).populate([
      { path: "requester", select: "name role department profilePicture", populate: { path: "department", select: "name" } },
      { path: "recipient", select: "name role department profilePicture", populate: { path: "department", select: "name" } },
    ]);

    // Extract the OTHER user from the connection object
    const friends = connections.map((c) => {
      if (c.requester._id.toString() === userId.toString()) {
        return c.recipient;
      }
      return c.requester;
    });
    ok(res, friends, "Connections retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pending requests sent TO me
 * @route   GET /api/connections/requests
 * @access  Private
 */
export const getRequests = async (req, res, next) => {
  try {
    const requests = await Connection.find({
      recipient: req.user._id,
      status: "pending",
    }).populate("requester", "name role department profilePicture");
    ok(res, requests, "Requests retrieved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept or Reject a request
 * @route   PUT /api/connections/respond/:requestId
 * @access  Private
 */
export const respondToRequest = async (req, res, next) => {
  try {
    const { status } = req.body; // 'accepted' or 'rejected'

    // ✅ Validate before use
    const VALID_STATUSES = ['accepted', 'rejected'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return badRequest(res, "Status must be 'accepted' or 'rejected'");
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return badRequest(res, "Invalid request ID");
    }

    const connection = await Connection.findById(req.params.requestId);

    if (!connection)
      return notFound(res, "Request not found");
    if (connection.recipient.toString() !== req.user._id.toString()) {
      return forbidden(res, "Not authorized");
    }

    if (status === "rejected") {
      await connection.deleteOne();
      return ok(res, null, "Request rejected");
    }

    connection.status = status;
    await connection.save();

    if (status === "accepted") {
      const msg = `${req.user.name} accepted your connection request.`;
      const io = req.app.get("io");
      if (io) {
        io.to(connection.requester.toString()).emit("notification", {
          message: msg,
        });
      }

      await Notification.create({
        recipient: connection.requester,
        actor: req.user._id,
        type: 'connection_accepted',
        message: msg,
      });
    }

    ok(res, null, `Request ${status}`);
  } catch (error) {
    next(error);
  }
};

export const getConnectionStatus = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return badRequest(res, "Invalid user ID");
    }

    const connection = await Connection.findOne({
      $or: [
        { requester: currentUserId, recipient: targetUserId },
        { requester: targetUserId, recipient: currentUserId },
      ],
    });

    if (!connection) return ok(res, { status: "none" }, "Status retrieved");

    ok(res, { status: connection.status }, "Status retrieved");
  } catch (error) {
    next(error);
  }
};
