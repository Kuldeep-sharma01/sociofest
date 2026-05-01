import User from "../models/User.js";
import Department from "../models/Department.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendOtpEmail } from "../utils/emailUtils.js";
import { generateToken } from "../utils/jwtUtils.js";
import {
  created,
  ok,
  badRequest,
  forbidden,
  unauthorized,
  notFound,
  serverError,
} from "../utils/index.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import HOD from "../models/HOD.js";
import Seller from "../models/Seller.js";
import Subject from "../models/Subject.js";

import { OAuth2Client } from "google-auth-library";

import { processUpload } from "../utils/mediaHelper.js";
import { VALID_ROLES } from "../utils/rbac.js";
import { readSystemSettings } from "../utils/systemSettings.js";

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

// Rate limiting cache (in-memory, Redis later)
const otpAttempts = new Map();
const resetAttempts = new Map();
const resendAttempts = new Map();
const MAX_ATTEMPTS = 3;
const MAX_RESEND = 3;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

// ✅ Fixed sliding window — only reset resetTime on first attempt in a new window
const trackAttempt = (map, key) => {
  const now = Date.now();
  const rec = map.get(key) || { count: 0, resetTime: 0 };
  if (now >= rec.resetTime) {
    // New window — reset count
    rec.count = 1;
    rec.resetTime = now + ATTEMPT_WINDOW;
  } else {
    rec.count++;
  }
  map.set(key, rec);
  return rec;
};

const isRateLimited = (map, key, maxAttempts = MAX_ATTEMPTS) => {
  const rec = map.get(key);
  return rec && Date.now() < rec.resetTime && rec.count >= maxAttempts;
};

// Blocked email domains (add institutional policy here)
const BLOCKED_DOMAINS = new Set([
  "example.com",
  "test.com",
  "temp-mail.org", // common disposable
  // Add institutional policy domains as needed
]);

// ✅ Define whitelisted institutional domains (set via env)
const APPROVED_DOMAINS = new Set(
  (process.env.OAUTH_AUTO_APPROVE_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
);

// Password strength validation
const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
};

export const registerUser = async (req, res) => {
  try {
    const systemSettings = await readSystemSettings();
    if (!systemSettings.registrationEnabled) {
      return forbidden(res, "Registration is currently disabled by admin");
    }
    const { name, email, password, department, role, studentData, teacherData, hodData, sellerData, isOAuth } = req.body;

    // Parse JSON fields if sent via FormData
    let parsedStudentData = studentData;
    let parsedTeacherData = teacherData;
    let parsedHodData = hodData;
    let parsedSellerData = sellerData;
    try { if (typeof studentData === "string") parsedStudentData = JSON.parse(studentData); } catch(e){}
    try { if (typeof teacherData === "string") parsedTeacherData = JSON.parse(teacherData); } catch(e){}
    try { if (typeof hodData === "string") parsedHodData = JSON.parse(hodData); } catch(e){}
    try { if (typeof sellerData === "string") parsedSellerData = JSON.parse(sellerData); } catch(e){}

    // SECURITY: Block disposable/temp mail domains
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (BLOCKED_DOMAINS.has(emailDomain)) {
      return badRequest(res, "Email domain not permitted");
    }
    const assignedRole = VALID_ROLES.includes(role) ? role : "Student";
    // Check existing user
    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({
      $or: [{ email: normalizedEmail }, { "emails.address": normalizedEmail }],
    });

if (userExists) {
      
        return badRequest(
          res,
          "Account already exists",
        );
      }

    // Password strength enforcement
    if (!isOAuth && (!password || !isStrongPassword(password))) {
      return badRequest(
        res,
        "Password must be 8+ characters with uppercase, lowercase, number, and special character",
      );
    }

    // Hash password
    let hashedPassword;
    if (password) {
      const salt = await bcrypt.genSalt(12); // Increased from 10
      hashedPassword = await bcrypt.hash(password, salt);
    }

    let isEmailVerified = false;
    if (isOAuth) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split(" ")[1];
        try {
          const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
          const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
          });
          const payload = ticket.getPayload();
          if (payload?.email === email) {
             isEmailVerified = true;
          }
        } catch (err) {
          console.warn("OAuth token verification failed during signup:", err.message);
        }
      }
    }

    // Resolve department
    let deptId = null;
    let deptDoc = null;
    if (department && String(department).trim() !== "" && !['Admin', 'Seller'].includes(assignedRole)) {
      if (mongoose.Types.ObjectId.isValid(department)) {
        deptDoc = await Department.findById(department);
      } else {
        deptDoc = await Department.findOne({ name: department });
      }
      if (!deptDoc && assignedRole === "HOD") {
        deptDoc = await Department.create({ name: department, code: department.toUpperCase().substring(0, 5), totalSemesters: parsedHodData?.semesters || 8 });
      }
      deptId = deptDoc?._id || null;
    }

    let status = "Pending";
    if (isEmailVerified && assignedRole === "Student") {
       if (APPROVED_DOMAINS.has(emailDomain)) {
           status = "Approved";
       }
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      department: deptId,
      status,
      emails: [{ address: normalizedEmail, isVerified: isEmailVerified }],
      profilePicture: req.body.profilePicture ||"", // Placeholder, updated after upload                   
    });

    // Link the newly created HOD to the auto-created department
    if (assignedRole === "HOD" && deptDoc && !deptDoc.hod) {
      deptDoc.hod = user._id;
      deptDoc.author = user._id;
      deptDoc.updatedBy = user._id;
      await deptDoc.save({ validateBeforeSave: false });
    }

    // Now safe to upload — user exists
    let profilePicture = req.body.profilePicture || "";
    if (req.file) {
      try {
        const media = await processUpload(req.file, "profiles/avatars");
        profilePicture = `/${media.path}`;
        user.profilePicture = profilePicture;
        await user.save({ validateBeforeSave: false });
      } catch (uploadErr) {
        console.error("Profile picture processing failed:", uploadErr);
      }
    }

    try {
      if (assignedRole === "Student" && parsedStudentData) {
        await Student.create({
          userId: user._id,
          rollNumber: parsedStudentData.rollNumber,
          semester: parsedStudentData.semester,
          subjects: parsedStudentData.subjects || [],
        });
      } else if (assignedRole === "Teacher" && parsedTeacherData) {
        const subjects = [];
        if (parsedTeacherData.subjects) {
          for (const sub of parsedTeacherData.subjects) {
            if (sub._id && mongoose.Types.ObjectId.isValid(sub._id)) {
              subjects.push(sub._id);
            } else if (deptId && sub.subject) {
              const subjectCode = sub.code || `${sub.subject.replace(/\s/g, "").toUpperCase().slice(0, 4)}${deptId.toString().slice(-4)}${sub.semester || 1}`;
              const newSub = await Subject.create({
                name: sub.subject,
                semester: sub.semester || 1,
                code: subjectCode,
                department: deptId
              });
              if (deptDoc) {
                deptDoc.subjects.push(newSub._id);
                await deptDoc.save({ validateBeforeSave: false });
              }
              subjects.push(newSub._id);
            }
          }
        }
        await Teacher.create({
          userId: user._id,
          qualifications: parsedTeacherData.qualifications,
          experience: parsedTeacherData.experience,
          subjects: subjects,
        });
      } else if (assignedRole === "HOD") {
        await HOD.create({
          userId: user._id,
          semesters: parsedHodData?.semesters || 8,
          tenure: parsedHodData?.tenure || 0,
          achievements: parsedHodData?.achievements || "",
        });
        
        const subjects = [];
        if (parsedTeacherData && parsedTeacherData.subjects) {
          for (const sub of parsedTeacherData.subjects) {
            if (sub._id && mongoose.Types.ObjectId.isValid(sub._id)) {
              subjects.push(sub._id);
            } else if (deptId && sub.subject) {
              const subjectCode = sub.code || `${sub.subject.replace(/\s/g, "").toUpperCase().slice(0, 4)}${deptId.toString().slice(-4)}${sub.semester || 1}`;
              const newSub = await Subject.create({
                name: sub.subject,
                semester: sub.semester || 1,
                code: subjectCode,
                department: deptId
              });
              if (deptDoc) {
                deptDoc.subjects.push(newSub._id);
                await deptDoc.save({ validateBeforeSave: false });
              }
              subjects.push(newSub._id);
            }
          }
        }
        await Teacher.create({
          userId: user._id,
          qualifications: parsedTeacherData?.qualifications || "",
          experience: parsedTeacherData?.experience || 0,
          subjects: subjects,
        });
      } else if (assignedRole === "Seller" && parsedSellerData) {
        await Seller.create({
          userId: user._id,
          companyName: parsedSellerData.companyName,
          businessType: parsedSellerData.businessType,
        });
      }
    } catch (profileErr) {
      console.error("Failed to create role profile:", profileErr);
    }

    const requiresEmailVerification = Boolean(systemSettings.serviceControls?.emailVerificationRequired);
    if (!isEmailVerified && requiresEmailVerification) {
      try {
        const emailRecord = user.emails[0];
        emailRecord.otp = Math.floor(100000 + Math.random() * 900000).toString();
        emailRecord.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });
        await sendOtpEmail(email, emailRecord.otp);
      } catch (otpErr) {
        console.error("OTP dispatch failed. Falling back to manual verification:", otpErr);
        return created(
          res,
          {
            userId: user._id,
            requiresOTP: false,
            requiresManualVerification: true,
            message:
              "Account created, but email service is unavailable. Contact admin for manual verification.",
          },
          "User registered with email fallback",
        );
      }

      return created(
        res,
        {
          userId: user._id,
          message: "Registration successful. Please verify your email with OTP.",
          requiresOTP: true,
          verificationToken: user._id,
        },
        "User registered successfully"
      );
    } else {
       if (!isEmailVerified && !requiresEmailVerification) {
          const emailRecord = user.emails?.[0];
          if (emailRecord) {
            emailRecord.isVerified = true;
            emailRecord.otp = undefined;
            emailRecord.otpExpires = undefined;
            await user.save({ validateBeforeSave: false });
          }
       }
       if (status === "Pending") {
          return created(res, {
              userId: user._id,
              message: "Account created. Please wait for HOD approval before logging in.",
          }, "User registered successfully");
       } else {
          return created(res, {
              user,
              token: generateToken(user._id, user.role),
          }, "User registered successfully");
       }
    }
  } catch (error) {
    console.error("Registration Error:", error);
    serverError(res);
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return badRequest(res, "Email and password are required");
    }

    const user = await User.findOne({ email })
      .select("+password +emails.otp +emails.otpExpires")
      .populate("department");

    if (!user) {
      // ✅ Dummy compare to normalize response time — prevents email enumeration
      await bcrypt.compare(
        password,
        "$2b$12$dummyhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      );
      return unauthorized(res, "Invalid credentials");
    }

    if (user.mustChangePassword) {
      return ok(
        res,
        { mustChangePassword: true, userId: user._id },
        "Password reset required before first login.",
      );
    }

    // Status blocking
    const status = String(user.status || "").toLowerCase();
    if (status === "pending")
      return forbidden(res, "Account pending approval from HOD");
    if (status === "blocked" || status === "rejected") {
      return forbidden(res, "Account is blocked or rejected");
    }

    // Email verification required for password logins
    const emailRecord = user.emails.find((e) => e.address === email);
    if (!emailRecord?.isVerified) {
      return forbidden(res, "Please verify your email address first");
    }

    // Password validation
    if (!user.password || !(await user.matchPassword(password))) {
      return unauthorized(res, "Invalid credentials");
    }

    const userObj = user.toObject();
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;
    // Strip OTP fields from emails subdoc
    if (userObj.emails) {
      userObj.emails = userObj.emails.map(({ address, isVerified }) => ({
        address,
        isVerified,
      }));
    }
    ok(
      res,
      { user: userObj, token: generateToken(user._id, user.role) },
      "Login successful",
    );
  } catch (error) {
    console.error("Login Error:", error);
    serverError(res);
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) return badRequest(res, "idToken is required");

    // HARD FAIL: If Google verification fails, reject entirely — never fall back to client data
    let verifiedEmail, verifiedName, verifiedPic;
    try {
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email)
        return unauthorized(res, "Google token missing email claim");
      verifiedEmail = payload.email;
      verifiedName = payload.name;
      verifiedPic = payload.picture;
    } catch (verifyError) {
      console.warn("Google token verification failed:", verifyError.message);
      return unauthorized(res, "Invalid or expired Google token"); // ← HARD REJECT
    }

    const emailDomain = verifiedEmail.split("@")[1]?.toLowerCase();
    if (BLOCKED_DOMAINS.has(emailDomain))
      return badRequest(res, "Email domain not permitted");

    const isInstitutionalEmail = APPROVED_DOMAINS.has(emailDomain);

    let user = await User.findOne({ email: verifiedEmail }).populate(
      "department",
    );

    if (!user) {
      user = await User.create({
        name: verifiedName,
        email: verifiedEmail,
        profilePicture: verifiedPic,
        role: "Student",
        status: isInstitutionalEmail ? "Approved" : "Pending",
        emails: [{ address: verifiedEmail, isVerified: true }],
      });

      if (!isInstitutionalEmail) {
        // ✅ Don't issue JWT — user needs HOD approval first
        return ok(
          res,
          { needsApproval: true, userId: user._id },
          "Account created. Please wait for HOD approval before logging in.",
        );
      }
    } else {
      // Silently fix unverified OAuth email record
      const rec = user.emails?.find((e) => e.address === verifiedEmail);
      if (rec && !rec.isVerified) {
        rec.isVerified = true;
        await user.save({ validateBeforeSave: false });
      }

      // 🛡️ Prevent login if existing user is not approved
      const status = String(user.status || "").toLowerCase();
      if (status === "pending")
        return forbidden(res, "Account pending approval from HOD");
      if (status === "blocked" || status === "rejected")
        return forbidden(res, "Account is blocked or rejected");
    }

    ok(
      res,
      { user, token: generateToken(user._id, user.role) },
      "OAuth login successful",
    );
  } catch (error) {
    console.error("OAuth Error:", error);
    serverError(res);
  }
};
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("department");
    if (!user) {
      return notFound(res);
    }
    ok(res, user, "Profile retrieved successfully");
  } catch (error) {
    console.error("Profile Error:", error);
    serverError(res);
  }
};

export const logoutUser = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
      });
    }
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    ok(res, {}, "Logged out successfully");
  } catch (error) {
    console.error("Logout Error:", error);
    serverError(res);
  }
};

// Rate-limited forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;

    // Rate limiting per email + IP
    const key = `${email}:${ip}`;
    if (isRateLimited(otpAttempts, key)) {
      const rec = otpAttempts.get(key);
      return badRequest(
        res,
        `Too many attempts. Try again in ${Math.ceil((rec.resetTime - Date.now()) / 60000)} minutes`,
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return ok(res, {}, "If email exists, check your inbox");
    }

    // Generate and send OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = hashOtp(otp);
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    await sendOtpEmail(email, otp);

    // Update rate limit
    trackAttempt(otpAttempts, key);

    ok(res, {}, "Password reset OTP sent to your email");
  } catch (error) {
    console.error("Forgot Password Error:", error);
    serverError(res);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const ip = req.ip;

    // ✅ Apply rate limiting using existing resetAttempts Map
    const key = `reset:${email}:${ip}`;
    if (isRateLimited(resetAttempts, key)) {
      const rec = resetAttempts.get(key);
      return badRequest(
        res,
        `Too many attempts. Try again in ${Math.ceil((rec.resetTime - Date.now()) / 60000)} minutes`,
      );
    }

    if (!isStrongPassword(newPassword)) {
      return badRequest(
        res,
        "Password must be 8+ chars with uppercase, number, and special character",
      );
    }

    const user = await User.findOne({
      email,
      resetPasswordToken: hashOtp(otp), // ← hashed comparison
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpire");

    if (!user) {
      trackAttempt(resetAttempts, key); // ← count failed attempts
      return badRequest(res, "Invalid or expired OTP");
    }

    resetAttempts.delete(key); // ← clear on success
    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    ok(res, {}, "Password reset successful");
  } catch (error) {
    console.error("Reset Password Error:", error);
    serverError(res);
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const ip = req.ip;

    // ✅ Rate limit — same pattern as forgotPassword
    const key = `verify:${email}:${ip}`;
    if (isRateLimited(otpAttempts, key)) {
      const rec = otpAttempts.get(key);
      return badRequest(
        res,
        `Too many attempts. Try again in ${Math.ceil((rec.resetTime - Date.now()) / 60000)} minutes`,
      );
    }

    const user = await User.findOne({ "emails.address": email }).select(
      "+emails.otp +emails.otpExpires",
    );
    if (!user) return badRequest(res, "User not found");

    const emailRecord = user.emails.find((e) => e.address === email);
    const isValid =
      emailRecord?.otp &&
      emailRecord.otp === otp &&
      new Date() <= emailRecord.otpExpires;

    if (!isValid) {
      // ✅ Increment attempt counter on failure
      trackAttempt(otpAttempts, key);
      return badRequest(res, "Invalid or expired OTP");
    }

    // ✅ Clear rate limit on success
    otpAttempts.delete(key);
    emailRecord.isVerified = true;
    emailRecord.otp = undefined;
    emailRecord.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    ok(
      res,
      { userId: user._id },
      "Email verified. Your account is pending HOD approval.",
    );
  } catch (error) {
    console.error("Verify OTP Error:", error);
    serverError(res);
  }
};

export const resendOTP = async (req, res) => {
  try {
    const { userId } = req.body;
    const ip = req.ip;
    const key = `resend:${ip}`;

    // Rate limit per IP
    if (isRateLimited(resendAttempts, key, MAX_RESEND)) {
      const rec = resendAttempts.get(key);
      return badRequest(
        res,
        `Too many resend requests. Try again in ${Math.ceil((rec.resetTime - Date.now()) / 60000)} minutes`,
      );
    }

    const user = await User.findById(userId);
    if (!user) return notFound(res);

    const emailRecord = user.emails[0];
    if (emailRecord?.isVerified)
      return badRequest(res, "Email already verified");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    emailRecord.otp = otp;
    emailRecord.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    await sendOtpEmail(emailRecord.address, otp);

    trackAttempt(resendAttempts, key);

    ok(res, {}, "Verification OTP resent");
  } catch (error) {
    console.error("Resend OTP Error:", error);
    serverError(res);
  }
};
