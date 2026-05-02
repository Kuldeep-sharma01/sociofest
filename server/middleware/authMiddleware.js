import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { readSystemSettings } from "../utils/systemSettings.js";

let cachedSettings = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 60000; // 1 minute cache

const getSettings = async () => {
  const now = Date.now();
  if (!cachedSettings || now - lastSettingsFetch > SETTINGS_CACHE_TTL) {
    cachedSettings = await readSystemSettings();
    lastSettingsFetch = now;
  }
  return cachedSettings;
};

/**
 * @desc Middleware to protect routes (checks JWT)
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      if (typeof token !== "string" || !token.trim()) {
        return res
          .status(401)
          .json({ message: "Not authorized, token is malformed." });
      }

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id).select(
        "-password +passwordChangedAt",
      );
      if (!req.user) {
        return res
          .status(401)
          .json({ message: "User not found, authorization denied." });
      }

      if (req.user.passwordChangedAt) {
        const changedAt = Math.floor(
          req.user.passwordChangedAt.getTime() / 1000,
        );
        if (decoded.iat < changedAt) {
          return res
            .status(401)
            .json({
              message: "Password was recently changed. Please log in again.",
            });
        }
      }

      // SECURITY FIX: Reject blocked users from accessing protected endpoints
      // ✅ FIX: Block pending AND rejected users from all protected routes
      const userStatus = String(req.user.status || "").toLowerCase();
      if (userStatus === "blocked")
        return res.status(403).json({ message: "Account has been blocked." });
      if (userStatus === "pending")
        return res
          .status(403)
          .json({ message: "Account pending HOD approval." });
      if (userStatus === "rejected")
        return res
          .status(403)
          .json({ message: "Account registration was rejected." });

      // SYSTEM ADMIN CHECK: Enforce Maintenance Mode
      try {
        const settings = await getSettings();
        if (settings.maintenanceMode && req.user.role !== "Admin") {
          return res.status(503).json({
            message:
              "Platform is currently under maintenance. Only Administrators can access the system at this time.",
          });
        }
      } catch (e) {
        console.warn("Failed to load system settings:", e.message);
      }
      return next();
    } catch (error) {
      console.error("Token validation error:", error);
      return res.status(401).json({ message: "Not authorized, token failed." });
    }
  }

  // If we get here, it means the header was missing or didn't start with "Bearer"
  return res
    .status(401)
    .json({ message: "Not authorized, no token provided." });
};
/**
 * @desc Role-based access control
 * @param {...string} roles - Allowed roles (e.g., "admin", "teacher")
 */

export const authenticate = protect;

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Not authorized, no user found." });
    }
    // Case-insensitive role comparison
    const userRole = req.user.role;
    const allowedRoles = roles.map((r) => r.toLowerCase());
    if (!allowedRoles.includes(userRole.toLowerCase())) {
      return res
        .status(403)
        .json({ message: "You do not have permission to access this route." });
    }
    next();
  };
};
