/**
 * server/middleware/validateMiddleware.js
 * Centralized input validation using express-validator
 */
import { validationResult } from 'express-validator';
import fs from 'fs';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Clean up orphaned files if validation fails
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        if (file.path) {
          fs.unlink(file.path, () => {});
        }
      });
    }

    return res.status(400).json({
      message: 'Validation failed: Invalid input data',
      errors: errors.array()
    });
  }
  
  next();
};