import User from "../models/User.js";
import Department from "../models/Department.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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

// --- PRIVATE UTILS ---
const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const otpAttempts = new Map();
const resetAttempts = new Map();
const resendAttempts = new Map();
const MAX_ATTEMPTS = 3;
const MAX_RESEND = 3;
const ATTEMPT_WINDOW = 15 * 60 * 1000;

const trackAttempt = (map, key) => {
  const now = Date.now();
  const rec = map.get(key) || { count: 0, resetTime: 0 };
  if (now >= rec.resetTime) {
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

const BLOCKED_DOMAINS = new Set(["example.com", "test.com", "temp-mail.org"]);
const APPROVED_DOMAINS = new Set(
  (process.env.OAUTH_AUTO_APPROVE_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
);

const isStrongPassword = (password) => {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
};

// --- ROLE-SPECIFIC PROFILE HANDLERS ---

const setupStudentProfile = async (user, data, deptId) => {
  const rollNum = Number(data.rollNumber);
  if (rollNum) {
    user.enrollmentNumber = String(rollNum);
    await user.save({ validateBeforeSave: false });
  }
  
  let subjects = data.subjects || [];
  if (subjects.length > 0 && deptId) {
    subjects = await Subject.find({ 
      _id: { $in: subjects }, 
      department: deptId 
    }).distinct("_id");
  }

  await Student.create([{
    userId: user._id,
    rollNumber: rollNum || null,
    semester: Number(data.semester) || 1,
    subjects,
  }]);
};

const setupTeacherProfile = async (user, data, deptId, deptDoc) => {
  const subjects = [];
  if (data.subjects) {
    for (const sub of data.subjects) {
      if (sub._id && mongoose.Types.ObjectId.isValid(sub._id)) {
        subjects.push(sub._id);
      } else if (deptId && sub.subject) {
        const subjectCode = sub.code || `${sub.subject.replace(/\s/g, "").toUpperCase().slice(0, 4)}${deptId.toString().slice(-4)}${sub.semester || 1}`;
        const newSub = await Subject.create([{
          name: sub.subject,
          semester: sub.semester || 1,
          code: subjectCode,
          department: deptId
        }]);
        if (deptDoc) {
          deptDoc.subjects.push(newSub[0]._id);
          await deptDoc.save({ validateBeforeSave: false });
        }
        subjects.push(newSub[0]._id);
      }
    }
  }
  await Teacher.create([{
    userId: user._id,
    qualifications: data.qualifications,
    experience: data.experience,
    subjects,
  }]);
  if (subjects.length > 0) {
    await Subject.updateMany(
      { _id: { $in: subjects } },
      { $addToSet: { assignedTeacher: user._id } }
    );
  }
};

const setupHODProfile = async (user, data, teacherData, deptId, deptDoc) => {
  await HOD.create([{
    userId: user._id,
    semesters: data?.semesters || 8,
    tenure: data?.tenure || 0,
    achievements: data?.achievements || "",
  }]);
  
  if (teacherData) {
    await setupTeacherProfile(user, teacherData, deptId, deptDoc);
  }
};

// --- MAIN HANDLERS ---

export const registerUser = async (req, res) => {
  try {
    const systemSettings = await readSystemSettings();
    if (!systemSettings.registrationEnabled) {
      return forbidden(res, "Registration is currently disabled by admin");
    }

    const { name, email, password, department, role, isOAuth, phone, enrollmentNumber } = req.body;
    
    // JSON parsing for role-specific data (handles FormData payloads)
    const parseJSON = (val) => {
      try { return typeof val === "string" ? JSON.parse(val) : val; } catch(e) { return val; }
    };
    const studentData = parseJSON(req.body.studentData);
    const teacherData = parseJSON(req.body.teacherData);
    const hodData = parseJSON(req.body.hodData);
    const sellerData = parseJSON(req.body.sellerData);

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (BLOCKED_DOMAINS.has(emailDomain)) return badRequest(res, "Email domain not permitted");

    const assignedRole = VALID_ROLES.includes(role) ? role : "Student";
    const normalizedEmail = email.toLowerCase().trim();

    if (await User.findOne({ $or: [{ email: normalizedEmail }, { "emails.address": normalizedEmail }] })) {
      return badRequest(res, "Account already exists");
    }

    if (!isOAuth && !isStrongPassword(password)) {
      return badRequest(res, "Password must be 8+ chars with uppercase, number, and special character");
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = password ? await bcrypt.hash(password, salt) : undefined;

    let isEmailVerified = false;
    if (isOAuth) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
          const ticket = await client.verifyIdToken({ idToken: authHeader.split(" ")[1], audience: process.env.GOOGLE_CLIENT_ID });
          if (ticket.getPayload()?.email === email) isEmailVerified = true;
        } catch (err) { console.warn("OAuth verification failed:", err.message); }
      }
    }

    // Resolve Department
    let deptId = null;
    let deptDoc = null;
    if (department && !['Admin', 'Seller'].includes(assignedRole)) {
      deptDoc = mongoose.Types.ObjectId.isValid(department) 
        ? await Department.findById(department)
        : await Department.findOne({ name: department });
      
      if (!deptDoc && ['HOD', 'Teacher', 'Student'].includes(assignedRole)) {
        deptDoc = await Department.create({ 
          name: department, 
          code: department.toUpperCase().substring(0, 5), 
          totalSemesters: hodData?.semesters || 8 
        });
      } else if (deptDoc && assignedRole === "HOD" && deptDoc.hod) {
        return badRequest(res, "Department already has an HOD.");
      }
      deptId = deptDoc?._id || null;
    }

    const status = (isEmailVerified && assignedRole === "Student" && APPROVED_DOMAINS.has(emailDomain)) ? "Approved" : "Pending";

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
      department: deptId,
      status,
      emails: [{ address: normalizedEmail, isVerified: isEmailVerified }],
      phone,
      enrollmentNumber,
    });

    // Finalize Department Link
    if (deptDoc) {
      if (!deptDoc.author) deptDoc.author = user._id;
      if (assignedRole === "HOD") deptDoc.hod = user._id;
      await deptDoc.save({ validateBeforeSave: false });
    }

    // Profile Picture
    if (req.file) {
      try {
        const media = await processUpload(req.file, "profiles/avatars");
        user.profilePicture = `/${media.path}`;
        await user.save({ validateBeforeSave: false });
      } catch (e) { console.error("Avatar upload failed:", e); }
    }

    // Role-Specific Setup
    try {
      if (assignedRole === "Student") await setupStudentProfile(user, studentData, deptId);
      else if (assignedRole === "Teacher") await setupTeacherProfile(user, teacherData, deptId, deptDoc);
      else if (assignedRole === "HOD") await setupHODProfile(user, hodData, teacherData, deptId, deptDoc);
      else if (assignedRole === "Seller") await Seller.create([{ userId: user._id, companyName: sellerData.companyName, businessType: sellerData.businessType }]);
    } catch (e) { console.error("Role profile setup failed:", e); }

    // HOD Notification
    if (status === "Pending" && deptId) {
      const hod = await User.findOne({ department: deptId, role: "HOD", status: "Approved" });
      if (hod) {
        import("../utils/emailUtils.js").then(({ sendApprovalEmail }) => {
          sendApprovalEmail({ approverEmail: hod.email, newUser: user }).catch(() => {});
        });
      }
    }

    // OTP Verification Flow
    const requiresEmailVerification = Boolean(systemSettings.serviceControls?.emailVerificationRequired);
    if (!isEmailVerified && requiresEmailVerification) {
      try {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.emails[0].otp = hashOtp(otpCode);
        user.emails[0].otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save({ validateBeforeSave: false });
        await sendOtpEmail(email, otpCode);
        return created(res, { userId: user._id, requiresOTP: true }, "OTP sent to email");
      } catch (e) {
        return created(res, { userId: user._id, requiresManualVerification: true }, "User created, email failed");
      }
    }

    // Auto-verify if no OTP required
    if (!isEmailVerified && !requiresEmailVerification) {
      user.emails[0].isVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    return created(res, { 
      user: status === "Approved" ? user : undefined,
      token: status === "Approved" ? generateToken(user._id, user.role) : undefined,
      message: status === "Approved" ? "Welcome!" : "Pending approval"
    }, "Registration successful");

  } catch (error) {
    console.error("Registration Error:", error);
    serverError(res);
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, "Email and password required");

    const user = await User.findOne({ email }).select("+password +emails.otp +emails.otpExpires").populate("department");

    if (!user || !(await user.matchPassword(password))) {
      await bcrypt.compare(password, "$2b$12$dummyhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
      return unauthorized(res, "Invalid credentials");
    }

    if (user.mustChangePassword) return ok(res, { mustChangePassword: true, userId: user._id });

    const status = String(user.status || "").toLowerCase();
    if (status === "pending") return forbidden(res, "Account pending approval");
    if (["blocked", "rejected"].includes(status)) return forbidden(res, "Account restricted");

    if (!user.emails.find(e => e.address === email)?.isVerified) {
      return ok(res, { requiresOTP: true, email: user.email, userId: user._id }, "Verification required");
    }

    const userObj = user.toObject();
    if (user.role === "Student") userObj.studentData = await Student.findOne({ userId: user._id }).lean();
    if (user.role === "Teacher") userObj.teacherData = await Teacher.findOne({ userId: user._id }).lean();
    if (user.role === "HOD") userObj.hodData = await HOD.findOne({ userId: user._id }).lean();
    if (user.role === "Seller") userObj.sellerData = await Seller.findOne({ userId: user._id }).lean();

    ok(res, { user: userObj, token: generateToken(user._id, user.role) }, "Login successful");
  } catch (error) {
    serverError(res);
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return badRequest(res, "idToken required");

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const { email, name, picture } = ticket.getPayload();

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (BLOCKED_DOMAINS.has(emailDomain)) return badRequest(res, "Email domain restricted");

    let user = await User.findOne({ email }).populate("department");
    const isInstitutional = APPROVED_DOMAINS.has(emailDomain);

    if (!user) {
      user = await User.create({
        name,
        email,
        profilePicture: picture,
        role: "Student",
        status: isInstitutional ? "Approved" : "Pending",
        emails: [{ address: email, isVerified: true }],
      });
      if (!isInstitutional) return ok(res, { needsApproval: true, userId: user._id });
    }

    const userObj = user.toObject();
    if (user.role === "Student") userObj.studentData = await Student.findOne({ userId: user._id }).lean();
    ok(res, { user: userObj, token: generateToken(user._id, user.role) });
  } catch (error) {
    serverError(res);
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").populate("department");
    if (!user) return notFound(res);
    const userObj = user.toObject();
    if (user.role === "Student") userObj.studentData = await Student.findOne({ userId: user._id }).lean();
    if (user.role === "Teacher") userObj.teacherData = await Teacher.findOne({ userId: user._id }).lean();
    if (user.role === "HOD") userObj.hodData = await HOD.findOne({ userId: user._id }).lean();
    if (user.role === "Seller") userObj.sellerData = await Seller.findOne({ userId: user._id }).lean();
    ok(res, userObj);
  } catch (error) {
    serverError(res);
  }
};

export const logoutUser = async (req, res) => {
  if (req.user) await User.findByIdAndUpdate(req.user._id, { isOnline: false, lastSeen: new Date() });
  res.clearCookie("token");
  ok(res, {});
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const key = `${email}:${req.ip}`;
  if (isRateLimited(otpAttempts, key)) return badRequest(res, "Too many attempts");

  const user = await User.findOne({ email });
  if (user) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = hashOtp(otp);
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    await sendOtpEmail(email, otp);
    trackAttempt(otpAttempts, key);
  }
  ok(res, {}, "Check your inbox");
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!isStrongPassword(newPassword)) return badRequest(res, "Weak password");

  const user = await User.findOne({ email, resetPasswordToken: hashOtp(otp), resetPasswordExpire: { $gt: Date.now() } });
  if (!user) return badRequest(res, "Invalid OTP");

  user.password = await bcrypt.hash(newPassword, 12);
  user.resetPasswordToken = undefined;
  await user.save();
  ok(res, {}, "Success");
};

export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ "emails.address": email }).select("+emails.otp +emails.otpExpires");
  if (!user) return badRequest(res, "Not found");

  const rec = user.emails.find(e => e.address === email);
  if (rec?.otp !== hashOtp(otp) || new Date() > rec.otpExpires) return badRequest(res, "Invalid OTP");

  rec.isVerified = true;
  rec.otp = undefined;
  await user.save({ validateBeforeSave: false });
  ok(res, { token: user.status === "Approved" ? generateToken(user._id, user.role) : undefined });
};

export const resendOTP = async (req, res) => {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user || user.emails[0].isVerified) return badRequest(res, "Invalid request");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  user.emails[0].otp = hashOtp(otp);
  user.emails[0].otpExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });
  await sendOtpEmail(user.emails[0].address, otp);
  ok(res, {});
};
