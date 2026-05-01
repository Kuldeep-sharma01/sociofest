import express from "express";
import { body } from "express-validator";
import { VALID_ROLES } from "../utils/rbac.js";
import {
  registerUser,
  loginUser,
  getProfile,
  googleAuth,
  resendOTP,
  forgotPassword,
  resetPassword,
  logoutUser,
  verifyOTP,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateMiddleware.js";
import { activityLoggerMiddleware } from "../utils/index.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please include a valid email address"),
  body("password").custom((value, { req }) => {
    if (req.body.isOAuth) return true;
    if (!value || value.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (!/[A-Z]/.test(value)) {
      throw new Error("Password must contain an uppercase letter");
    }
    if (!/[0-9]/.test(value)) {
      throw new Error("Password must contain a number");
    }
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(value)) {
      throw new Error("Password must contain a special character");
    }
    return true;
  }),
  body("role").optional().isIn(VALID_ROLES).withMessage("Invalid role specified"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please include a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
];

const otpValidation = [
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be exactly 6 digits"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please include a valid email address"),
];

const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please include a valid email address"),
];

const resetPasswordValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please include a valid email address"),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be exactly 6 digits"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters"),
];

const googleAuthValidation = [
  body("idToken").notEmpty().withMessage("Google ID Token is required"),
];

router.post(
  "/register",
  upload.single("profilePicture"),
  registerValidation,
  validateRequest,
  registerUser,
);

router.post("/login", loginValidation, validateRequest, loginUser);

router.post(
  "/google",
  googleAuthValidation,
  validateRequest,
  activityLoggerMiddleware("google_auth"),
  googleAuth,
);

router.post("/verify-otp", otpValidation, validateRequest, verifyOTP);

router.post(
  "/resend-otp",
  [body("userId").isMongoId().withMessage("Invalid userId"), validateRequest],
  resendOTP,
);

router.post(
  "/forgot-password",
  forgotPasswordValidation,
  validateRequest,
  forgotPassword,
);

router.post(
  "/reset-password",
  resetPasswordValidation,
  validateRequest,
  resetPassword,
);

router.get("/profile", protect, getProfile);
router.post("/logout", protect, logoutUser);

export default router;
