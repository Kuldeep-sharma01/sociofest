// server/middleware/errorHandler.js

/**
 * Centralized Error Handling Middleware
 * This catches any thrown errors from controllers or routes
 * and sends a formatted response to the client.
 */
import multer from "multer";


export const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.stack || err);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Internal Server Error";
  
if (err instanceof multer.MulterError) {
  statusCode = 400;
  if (err.code === "LIMIT_FILE_SIZE") message = "Uploaded file is too large";
  else if (err.code === "LIMIT_FILE_COUNT") message = "Too many files uploaded";
  else if (err.code === "LIMIT_UNEXPECTED_FILE") message = `Unexpected upload field: ${err.field}`;
  else message = err.message;
}
  // Handle specific error types
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate field value entered";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired. Please log in again.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

/**
 * Not Found Middleware
 * Handles undefined routes gracefully
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};
