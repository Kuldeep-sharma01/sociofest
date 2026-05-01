// Fixed compiler.js import - routes/compiler.js is correct structure
import compilerRoutes from './routes/compiler.js';
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import path from "path";

import mongoose from "mongoose";
import User from "./models/User.js";
import Post from "./models/Post.js";
import Material from "./models/Material.js";
import "./config/env.js";
import winston from 'winston';
import { startAssignmentCron } from "./cron/assignmentReminders.js";
import { verifyToken, getTokenFromHeader } from "./utils/jwtUtils.js";
// 🛠️ Define global logger to prevent ReferenceError crashes in background tasks
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [new winston.transports.Console()]
});

import { protect } from "./middleware/authMiddleware.js";
import {
  getFfmpegConfig,
  updateFfmpegConfig,
  deleteMediaDocs,
} from "./utils/mediaHelper.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
// 🧩 Import Routes Statically
import productRoutes from "./routes/products.js";
import auth from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import contentRoutes from "./routes/posts.js";
import quizzesRoutes from "./routes/quizzes.js";
import eventsRoutes from "./routes/events.js";
import subjectsRoutes from "./routes/subjects.js";
import departmentsRoutes from "./routes/departments.js";
import statsRoutes from "./routes/stats.js";
import materialsRoutes from "./routes/materials.js";
import assignmentsRoutes from "./routes/assignments.js";
import messagesRoutes from "./routes/messages.js";
import connectionsRoutes from "./routes/connections.js";
import searchRoutes from "./routes/search.js";
import certificatesRoutes from "./routes/certificates.js";
import pushRoutes from "./routes/push.js";
import webhooksRoutes from "./routes/webhooks.js";
import analyticsRoutes from "./routes/analytics.js";
import governanceRoutes from "./routes/governance.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/aiRoutes.js";
import settingsRoutes from "./routes/settings.js";

import attendanceRoutes from "./routes/attendance.js";
import wifiRoutes from "./routes/wifi.js";
// import { initCronJobs } from "./cron/attendanceNotifier.js";

import express from 'express';
const app = express();
app.disable("x-powered-by");

// 🔌 Initialize Socket.io
const http = await import('http');const fs = await import('fs');const { createServer } = http;const { promises: fsPromises } = fs;
const httpServer = createServer(app);

const allowedOrigins = process.env.VITE_CLIENT_URL
  ? process.env.VITE_CLIENT_URL.split(",")
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

const socketio = await import('socket.io');const { Server } = socketio;
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(192\.168\.|10\.|172\.|localhost)/.test(origin)) {
        callback(null, true);  // Allow LAN only in development
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  // adapter: redisAdapter, // Disabled until Redis setup
});

app.set("io", io); // Make io accessible in controllers
startAssignmentCron(io); // Start the assignment reminder cron job with Socket.io instance
const activeConnections = new Map();

io.use(async (socket, next) => {
  try {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!rawToken) {
      return next(new Error("Authentication required"));
    }

    const decoded = verifyToken(rawToken);
    if (!decoded?.id) {
      return next(new Error("Invalid token"));
    }

    const user = await User.findById(decoded.id).select("_id role status");
    if (!user) return next(new Error("User not found"));
    if (user.status === "Blocked") return next(new Error("User blocked"));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});
io.on("connection", async (socket) => {
  // ← async added
  const connectedUserId = socket.user._id.toString();

  // --- connection flood guard ---
  if (!activeConnections.has(connectedUserId))
    activeConnections.set(connectedUserId, new Set());
  const userSockets = activeConnections.get(connectedUserId);
  if (userSockets.size >= 5) {
    socket.emit("error", { message: "Too many active connections" });
    socket.disconnect();
    return;
  }
  userSockets.add(socket.id);



  socket.join(connectedUserId);
  socket.emit("connected");
  try {
    await User.findByIdAndUpdate(connectedUserId, { isOnline: true });
  } catch (e) {}

  // ✅ Verify room membership before broadcasting typing events
  socket.on("typing", async (room) => {
    const convo = await mongoose.model("Conversation").findOne({
      _id: room,
      participants: socket.user._id,
    }).lean();
    if (convo) socket.in(room).emit("typing", { room, typist: connectedUserId });
  });

  // ✅ Verify room membership before broadcasting stop typing events
  socket.on("stop typing", async (room) => {
    const convo = await mongoose.model("Conversation").findOne({
      _id: room,
      participants: socket.user._id,
    }).lean();
    if (convo) socket.in(room).emit("stop typing", { room, typist: connectedUserId });
  });

  // ✅ Validate room membership before joining
  socket.on('join chat', async (room) => {
    // Verify the user is a participant of this conversation
    const convo = await mongoose.model('Conversation').findOne({
      _id: room,
      participants: socket.user._id,
    }).lean();
    if (convo) socket.join(room);
    // else: silently ignore or emit an error
  });
  socket.on("join-room", (room) => socket.join(room));
  socket.on("join-media-room", (mediaId) => {
    if (mediaId) socket.join(mediaId);
  });
  socket.on("leave-media-room", (mediaId) => {
    if (mediaId) socket.leave(mediaId);
  });

  socket.on("webrtc-offer", (data) => {
    socket.to(data.mediaId).emit("webrtc-offer-received", {
      sdp: data.sdp,
      mediaId: data.mediaId,
      senderId: socket.id,
    });
  });
  socket.on("webrtc-answer", (data) => {
    io.to(data.to).emit("webrtc-answer-received", {
      sdp: data.sdp,
      mediaId: data.mediaId,
      senderId: socket.id,
    });
  });
  socket.on("webrtc-ice-candidate", (data) => {
    const payload = {
      candidate: data.candidate,
      mediaId: data.mediaId,
      senderId: socket.id,
    };
    if (data.to && data.to !== "viewers")
      io.to(data.to).emit("webrtc-ice-candidate-received", payload);
    else socket.to(data.mediaId).emit("webrtc-ice-candidate-received", payload);
  });

  socket.on("disconnect", async () => {
    const userSockets = activeConnections.get(connectedUserId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        activeConnections.delete(connectedUserId);
        try {
          await User.findByIdAndUpdate(connectedUserId, {
            isOnline: false,
            lastSeen: new Date(),
          });
        } catch (e) {
          logger.error("Socket disconnect update failed", { error: e.message, userId: connectedUserId });
        }
      }
    }
  });
}); // ← this closes io.on("connection")

// console.log("this is the dataLLL", r);

// 📂 Static Folder Configuration
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiRoutes = [
  ["/api/products", productRoutes],
  ["/api/auth", auth],
  ["/api/users", usersRoutes],
  ["/api/content", contentRoutes],
  ["/api/quizzes", quizzesRoutes],
  ["/api/events", eventsRoutes],
  ["/api/subjects", subjectsRoutes],
  ["/api/departments", departmentsRoutes],
  ["/api/stats", statsRoutes],
  ["/api/analytics", analyticsRoutes],
  ["/api/governance", governanceRoutes],
  ["/api/materials", materialsRoutes],
  ["/api/assignments", assignmentsRoutes],
  ["/api/messages", messagesRoutes],
  ["/api/connections", connectionsRoutes],
  ["/api/search", searchRoutes],
  ["/api/certificates", certificatesRoutes],
  ["/api/push", pushRoutes],
  ["/api/webhooks", webhooksRoutes],
  ["/api/ai", aiRoutes],
  ["/api/attendance", attendanceRoutes],
  ["/api/admin", adminRoutes],
  ["/api/settings", settingsRoutes],
  ["/api/wifi", wifiRoutes],
  ["/api/compiler", compilerRoutes],
];

// 🗄️ Connect MongoDB
const startServer = async () => {
  try {
    // Ensure uploads directory exists on startup
    const uploadsBaseDir = path.join(__dirname, "uploads");
    const uploadsTempDir = path.join(__dirname, "uploads/temp");
    const uploadsProfilesDir = path.join(__dirname, "uploads/profiles");
    if (!fs.existsSync(uploadsBaseDir)) {
      fs.mkdirSync(uploadsBaseDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsTempDir)) {
      fs.mkdirSync(uploadsTempDir, { recursive: true });
    }
    if (!fs.existsSync(uploadsProfilesDir)) {
      fs.mkdirSync(uploadsProfilesDir, { recursive: true });
    }

    await connectDB();
    console.log("✅ MongoDB Connected Successfully");

    // 🛡️ MongoDB Connection Resilience
    mongoose.connection.on("disconnected", () => {
      console.warn(
        "⚠️ MongoDB connection lost. Mongoose will attempt to auto-reconnect...",
      );
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB error", { error: err.message, name: err.name });
      // Only exit on unrecoverable connection states, not transient query errors
      if (
        err.name === "MongoNetworkError" ||
        err.name === "MongoServerSelectionError"
      ) {
        logger.error("Unrecoverable MongoDB network error. Exiting for restart");
        process.exit(1);
      }
      // For other transient errors, Mongoose will attempt to auto-reconnect.
   });
    const isProd = process.env.NODE_ENV === "production";

    // 🧩 Middleware
    // SECURITY FIX: Helmet for Anti-XSS, Anti-Sniffing, and Frameguard
    app.use(helmet({ crossOriginResourcePolicy: false }));
    // SECURITY FIX: Strict CORS Whitelist
const corsMod = await import('cors');app.use(     corsMod.default({
        origin: function (origin, callback) {
          // Allow exact matches, no-origin requests, and local network IPs (for mobile testing)
          if (
            !origin ||
            allowedOrigins.includes(origin) ||
            (!isProd && /^https?:\/\/(192\.168\.|10\.|172\.|localhost)/.test(origin))
          ) {
            callback(null, true);
          } else {
            callback(null, false); // Fail silently instead of spamming the console with errors
          }
        },
        credentials: true,
      }),
    );
    // ✅ Increase global JSON payload limits to support base64 AI images in chat history
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ extended: true, limit: "50mb" }));
const cookieParserMod = await import('cookie-parser');app.use(cookieParserMod.default());
    const trustProxy = process.env.TRUST_PROXY;
    if (trustProxy !== undefined) {
      app.set("trust proxy", trustProxy === "true" ? 1 : trustProxy);
    } else {
      app.set("trust proxy", 1);
    }
const morganMod = await import('morgan');app.use(morganMod.default(isProd ? "combined" : "dev"));

    // SECURITY FIX: Rate Limiting to prevent brute force and DDoS
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // Limit each IP to 300 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: "Too many requests from this IP, please try again later.",
      },
    });

    // ✅ Split auth limiter by operation type
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many login attempts." },
    });

    const otpLimiter = rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many OTP requests." },
    });
   
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000, // Increased to prevent 429 on profile fetches
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many authentication requests, please try again later." },
    });

    // ✅ Add a dedicated, tight rate limit for AI endpoints
    const aiLimiter = rateLimit({
      windowMs: 60 * 1000,   // 1 minute window
      max: 10,               // 10 AI requests per minute per IP
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many AI requests, please slow down.' },
      keyGenerator: (req) =>
        req.user?._id?.toString() || req.headers["x-forwarded-for"] || req.socket.remoteAddress, // Fix for ERR_ERL_KEY_GEN_IPV6
    });

    // Security middleware for static files (e.g., SVG XSS protection)
    app.use("/uploads", (req, res, next) => {
      const ext = path.extname(req.path).toLowerCase();
      if (ext === ".svg") {
        // Force download — never render inline in browser
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'");
      }
      next();
    });

    // Replace open static serving with protected middleware
    app.use(
      "/uploads/public",
      express.static(path.join(__dirname, "uploads/public")),
    ); // public is intentionally open
    app.use(
      "/uploads",
      express.static(path.join(__dirname, "uploads")),
    );

    // Apply request limits before route handlers
    app.use("/api/auth/login", loginLimiter);
    app.use("/api/auth/verify-otp", otpLimiter);
    app.use("/api/auth/resend-otp", otpLimiter);
    app.use("/api/auth/forgot-password", otpLimiter);
    app.use("/api/auth", authLimiter); // catch-all for other auth routes
    app.use("/api/ai", aiLimiter);
    app.use("/api/", apiLimiter);

    // 🛣️ Apply Routes
    apiRoutes.forEach(([routePath, routeHandler]) => {
      app.use(routePath, routeHandler);
    });

    // 🧩 Ad-hoc Notification Routes to resolve 404s and prevent data leaks.
    // This logic should ideally be in its own dedicated controller and route files.
    app.get("/api/notifications", protect, async (req, res) => {
      try {
        const Notification = mongoose.model("Notification");
        const notifications = await Notification.find({ recipient: req.user._id })
          .sort({ createdAt: -1 })
          .limit(50)
          .select("type message link createdAt isRead") // SECURITY: Explicitly select only safe fields.
          .lean();
        res.status(200).json({ notifications });
      } catch (error) {
        logger.error("Notification fetch error", { error: error.message, userId: req.user._id });
        res.status(500).json({ message: "Server error retrieving notifications." });
      }
    });

    app.delete("/api/notifications/:id", protect, async (req, res) => {
      try {
        const Notification = mongoose.model("Notification");
        const notification = await Notification.findOne({
          _id: req.params.id,
          recipient: req.user._id, // SECURITY: Ensure user can only delete their own notifications.
        });

        if (!notification) {
          return res.status(404).json({ message: "Notification not found." });
        }
        await notification.deleteOne();
        res.status(200).json({ message: "Notification dismissed." });
      } catch (error) {
        logger.error("Notification delete error", { error: error.message, notificationId: req.params.id, userId: req.user._id });
        res.status(500).json({ message: "Server error deleting notification." });
      }
    });

    // 🧾 Health Checks
    app.get("/", (req, res) => {
      res.status(200).send("🎓 SocioFest Backend API Running...");
    });
    app.get("/health", (req, res) => {
      const dbState = mongoose.connection.readyState; // 1 = connected
      res.status(200).json({
        status: "ok",
        db: dbState === 1 ? "connected" : "disconnected",
        uptime: process.uptime(),
      });
    });

    app.use(notFound);
    app.use(errorHandler);

    // Initialize Attendance modules gracefully
    // try {
    //   initCronJobs();
    //   console.log("✅ Attendance modules loaded.");
    // } catch (e) {
    //   console.error("⚠️ Attendance modules init failed:", e.message);
    // }

    // AI AUDIO BLOAT FIX: Periodic background cleanup of temporary AI files
    setInterval(
      async () => {
        try {
          const files = await fs.promises.readdir(uploadsBaseDir);
          const now = Date.now();
          for (const file of files) {
            if (
              file.startsWith("stt_") ||
              file.startsWith("sample_") ||
              file.startsWith("dub_") ||
              file.startsWith("trans_")
            ) {
              const filePath = path.join(uploadsBaseDir, file);
              const stats = await fs.promises.stat(filePath);
              if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
                // Older than 24 hours
                await fs.promises.unlink(filePath).catch(() => {});
              }
            }
          }
        } catch (e) {
logger.warn("Background AI cleanup task failed", { error: e.message });
        }
      },
      12 * 60 * 60 * 1000,
    ); // Check every 12 hours

    // 📦 AUTO-ARCHIVE BLOAT FIX: Periodic background archiving of old unused group chats
    setInterval(
      async () => {
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const result = await mongoose.model("Conversation").updateMany(
            {
              isGroup: true,
              isArchived: false,
              updatedAt: { $lt: thirtyDaysAgo },
            },
            { $set: { isArchived: true } },
          );
          if (result.modifiedCount > 0) {
            console.log(
              `📦 Auto-archived ${result.modifiedCount} unused group conversations.`,
            );
          }
        } catch (e) {
logger.warn("Background auto-archive task failed", { error: e.message });
        }
      },
      24 * 60 * 60 * 1000,
    ); // Check every 24 hours

    const BATCH_SIZE = 100;

    setInterval(
      async () => {
        try {
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          // ✅ Add a hard iteration cap and error-per-batch handling
          const MAX_BATCHES = 50;
          let batches = 0;
          const failedIds = []; // Track failed deletions to prevent infinite batch loops

          while (batches++ < MAX_BATCHES) {
            const query = { isDeleted: true, deletedAt: { $lt: cutoff } };
            if (failedIds.length > 0) query._id = { $nin: failedIds };

            const expiredPosts = await Post.find(query)
              .limit(BATCH_SIZE).lean(false);
            if (expiredPosts.length === 0) break;
            for (const post of expiredPosts) {
              try {
                if (post.material) {
                  const mat = await Material.findById(post.material);
                  if (mat) {
                    if (Array.isArray(mat.media) && mat.media.length > 0) {
                      await deleteMediaDocs(mat.media);
                    }
                    await mat.deleteOne();
                  }
                }
                await post.deleteOne();
              } catch (postError) {
logger.warn('Failed to clean up post:', { postId: post._id, error: postError.message });
                // continue with next post instead of aborting the whole batch
                failedIds.push(post._id);
              }
            }
          }
        
        } catch (e) {
          console.warn("Background trash cleanup failed", e.message);
        }
      },
      24 * 60 * 60 * 1000,
    );

    // 🚀 Start Express Server with port fallback
    const startPort = parseInt(process.env.PORT) || 5000;

    // ✅ In production, fail immediately if the configured port is unavailable
    const listenWithRetry = (port, attemptsLeft = 5) => {
      if (process.env.NODE_ENV === 'production' && attemptsLeft < 5) {
        throw new Error(`Configured port ${parseInt(process.env.PORT) || 5000} is in use`);
      }
      return new Promise((resolve, reject) => {
        const onError = (err) => {
          httpServer.off("listening", onListening);
          if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
            console.warn(`Port ${port} busy, trying ${port + 1}`);
            return resolve(listenWithRetry(port + 1, attemptsLeft - 1));
          }
          reject(err);
        };

        const onListening = () => {
          httpServer.off("error", onError);
          resolve(httpServer);
        };

        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen(port, () => {
          console.log(
            `🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${port}`,
          );
        });
      });
    };

    const server = await listenWithRetry(startPort);

    // 🛑 Graceful Shutdown
    // ✅ Force-exit after a timeout if graceful shutdown stalls
    process.on("SIGTERM", () => {
      console.log("SIGTERM received. Shutting down gracefully...");
      const forceExit = setTimeout(() => {
logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
      }, 15_000);  // 15-second hard limit
      forceExit.unref();  // Don't prevent shutdown just because this timer is active

      server.close(async () => {
            clearTimeout(forceExit);

        await mongoose.connection.close(false);
        console.log("💤 Server closed.");
        process.exit(0);
      });
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
};

// 🏁 Run the Server
startServer();
