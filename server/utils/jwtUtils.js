// server/utils/jwtUtils.js
import jwt from "jsonwebtoken";

// ✅ Fail fast at startup — don't silently use undefined secret
if (!process.env.JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not configured. Server cannot start.",
  );
}

/**
 * Generate a JWT token for a given user ID and role
 * @param {string} userId - MongoDB user ID
 * @param {string} role - user role (Admin, HOD, Teacher, Student, Seller)
 * @returns {string} Signed JWT token
 */
export const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT string from headers/cookies
 * @returns {object|null} Decoded payload or null if invalid
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    return null;
  }
};

/**
 * Extract token from Authorization header
 * @param {object} req - Express request object
 * @returns {string|null} Token string or null
 */
export const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};
