import express from "express";
import multer from "multer";
import path from "path";
import { ok, badRequest, forbidden, serverError } from "../utils/index.js";
import mongoose from "mongoose";
import fs from "fs/promises";
import crypto from "crypto";
import rateLimit from 'express-rate-limit';

const router = express.Router();

// ✅ Replace bare multer config with guarded version
const webhookUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/temp/'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).replace(/[^a-z0-9.]/gi, '');
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error('Only video files are accepted from webhook'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 500 * 1024 * 1024, files: 1 }, // 500MB max, 1 file
});

// ✅ Add rate limiting to prevent webhook flooding
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,  // 30 webhook calls per minute per IP
  message: { success: false, message: 'Too many webhook requests' }
});

// SECURITY FIX: Verify webhook signature to prevent unauthenticated DoS and spoofing
const verifyWebhook = (req, res, next) => {
  const expectedSecret = process.env.STABILITY_WEBHOOK_SECRET;
  
  if (!expectedSecret) {
    console.error('FATAL: STABILITY_WEBHOOK_SECRET is not configured. Rejecting all webhook calls.');
    return serverError(res, "Webhook endpoint not configured");
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return forbidden(res, "Invalid webhook signature");
  }
  next();
};

/**
 * @route   POST /api/webhooks/stability/:userId/:sessionId
 * @desc    Receive generated video from Stability API webhook
 * @access  Public
 */
router.post("/stability/:userId/:sessionId", webhookLimiter, verifyWebhook, webhookUpload.any(), async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    // Validate format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return badRequest(res, "Invalid userId");
    }
    // sessionId: allow only alphanumeric + hyphens to prevent socket room injection
    if (!/^[a-zA-Z0-9_\-]{1,64}$/.test(sessionId)) {
      return badRequest(res, "Invalid sessionId format");
    }

    const io = req.app.get("io");
    let mediaUrl = "";

    if (req.files && req.files.length > 0) {
      const file =
        req.files.find((f) => f.fieldname === "video") || req.files[0];
      const serverUrl = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
      mediaUrl = `${serverUrl}/${file.path.replace(/\\/g, '/')}`;
    } else if (req.body && req.body.output) {
      mediaUrl = req.body.output;
    }

    if (mediaUrl && io) {
      io.to(userId).emit("video generated", { sessionId, mediaUrl });
    }

    ok(res, { received: true }, "Webhook received successfully");

    // ✅ Clean up temp files after response is sent
    if (req.files?.length > 0) {
      for (const f of req.files) {
        await fs.unlink(f.path).catch(e => console.warn('Temp file cleanup failed:', e.message));
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    serverError(res, "Webhook Error");
  }
});

export default router;
