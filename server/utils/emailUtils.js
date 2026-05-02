// server/utils/emailUtils.js
/**
 * Email Utilities - Consolidated from emailService.js and emailUtils.js
 * Single source for all email operations
 */

import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";

let cachedEmailSettings = null;
let lastEmailSettingsFetch = 0;
const EMAIL_SETTINGS_CACHE_TTL = 60000; // 1 minute cache

/**
 * Dynamically build the email transporter prioritizing Admin UI Settings over .env
 */
const getTransporter = async () => {
  let host = process.env.SMTP_HOST || "smtp.gmail.com";
  let port = process.env.MAIL_PORT || 587;
  let secure = process.env.SMTP_SECURE === "true";
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  try {
    const now = Date.now();
    if (
      !cachedEmailSettings ||
      now - lastEmailSettingsFetch > EMAIL_SETTINGS_CACHE_TTL
    ) {
      const settingsData = await fs.readFile(
        path.join(process.cwd(), "config", "systemSettings.json"),
        "utf-8",
      );
      cachedEmailSettings = JSON.parse(settingsData);
      lastEmailSettingsFetch = now;
    }

    if (cachedEmailSettings.emailSettings) {
      if (cachedEmailSettings.emailSettings.active === false) {
        return null; // Outbound emails are disabled by admin
      }
      host = cachedEmailSettings.emailSettings.host || host;
      port = cachedEmailSettings.emailSettings.port || port;
      secure = cachedEmailSettings.emailSettings.secure || secure;
      user = cachedEmailSettings.emailSettings.user || user;
      pass = cachedEmailSettings.emailSettings.pass || pass;
    }
  } catch (e) {
    // Ignore file read errors (fallback to .env)
  }

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

/**
 * Send a generic email
 * @param {string} to - recipient email address
 * @param {string} subject - email subject line
 * @param {string} html - email body (HTML)
 */
export const sendEmail = async (to, subject, html) => {
  try {
    const transporter = await getTransporter();

    if (!transporter) {
      console.log(
        `\n[MAIL DISABLED/UNCONFIGURED] Suppressed outbound email to: ${to}`,
      );
      throw new Error("Email service is disabled or unconfigured. Cannot send email.");
    }

    const fromAddress =
      cachedEmailSettings?.emailSettings?.user || process.env.SMTP_USER;
    const mailOptions = {
      from: `"SocioFest College Portal" <${fromAddress}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
};

/**
 * Send approval email (consolidated from emailService.js)
 * @param {string} approverEmail - HOD email
 * @param {Object} newUser - User object with name, email, role
 */
export const sendApprovalEmail = async ({ approverEmail, newUser }) => {
  const html = generateApprovalEmailTemplate(newUser);
  return sendEmail(
    approverEmail,
    `New ${newUser.role} registration awaiting approval`,
    html,
  );
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} resetToken - Reset token (not hashed)
 */
export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;
  const html = generatePasswordResetEmailTemplate(resetUrl);
  return sendEmail(email, "Password Reset Request", html);
};

/**
 * Send email verification email
 * @param {string} email - User email
 * @param {string} verificationToken - Verification token
 */
export const sendVerificationEmail = async (email, verificationToken) => {
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email/${verificationToken}`;
  const html = generateVerificationEmailTemplate(verifyUrl);
  return sendEmail(email, "Verify Your Email", html);
};

/**
 * Send OTP email
 * @param {string} email - User email
 * @param {string} otp - One-time password
 */
export const sendOtpEmail = async (email, otp) => {
  const html = generateOtpEmailTemplate(otp);
  return sendEmail(email, "Your One-Time Password (OTP)", html);
};

/**
 * Send assignment due reminder
 * @param {string} email - User email
 * @param {string} assignmentTitle - Assignment title
 * @param {Date} dueDate - Due date
 */
export const sendAssignmentReminderEmail = async (
  email,
  assignmentTitle,
  dueDate,
) => {
  const html = generateAssignmentReminderTemplate(assignmentTitle, dueDate);
  return sendEmail(email, "Assignment Due Reminder", html);
};

/**
 * Send attendance reminder
 * @param {string} email - User email
 * @param {string} courseName - Course name
 * @param {string} attendancePercentage - Percentage (e.g., "45%")
 */
export const sendAttendanceReminderEmail = async (
  email,
  courseName,
  attendancePercentage,
) => {
  const html = generateAttendanceReminderTemplate(
    courseName,
    attendancePercentage,
  );
  return sendEmail(email, "Attendance Reminder", html);
};

// ============= Email Template Generators =============

// ✅ Add escape helper to prevent HTML injection
const escHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/**
 * Generate a simple HTML email template
 * @param {string} title - heading text
 * @param {string} message - main content message
 * @returns {string} HTML email body
 */
export const generateEmailTemplate = (title, message) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #0044cc;">${escHtml(title)}</h2>
      <p>${escHtml(message)}</p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate approval email template
 */
export const generateApprovalEmailTemplate = (newUser) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #0044cc; text-align: center;">New Registration Awaiting Approval</h2>
      <p>Hello,</p>
      <p>A new <strong>${escHtml(newUser.role)}</strong> (<strong>${escHtml(newUser.name)}</strong>) has registered and is awaiting your approval.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Email:</strong> ${escHtml(newUser.email)}</p>
        <p><strong>Role:</strong> ${escHtml(newUser.role)}</p>
      </div>
      <p>Please login to SocioFest to approve or reject this registration.</p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate password reset email template
 */
export const generatePasswordResetEmailTemplate = (resetUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0044cc;">Password Reset Request</h2>
      <p>Hello,</p>
      <p>You requested to reset your password. Click the button below to proceed:</p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #0044cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        Reset Password
      </a>
      <p>Or copy this link: <a href="${resetUrl}">${resetUrl}</a></p>
      <p style="color: #888; font-size: 12px;">This link expires in 15 minutes.</p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate email verification template
 */
export const generateVerificationEmailTemplate = (verifyUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0044cc;">Verify Your Email</h2>
      <p>Hello,</p>
      <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
      <a href="${verifyUrl}" style="display: inline-block; background-color: #0044cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        Verify Email
      </a>
      <p>Or copy this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate OTP email template
 */
export const generateOtpEmailTemplate = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0044cc;">One-Time Password</h2>
      <p>Your verification code is:</p>
      <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
        <h1 style="letter-spacing: 5px; color: #0044cc; font-size: 32px; margin: 0;">${otp}</h1>
      </div>
      <p style="color: #888; font-size: 12px;">This code expires in 10 minutes.</p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate assignment reminder template
 */
export const generateAssignmentReminderTemplate = (
  assignmentTitle,
  dueDate,
) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ff6b00;">Assignment Due Reminder</h2>
      <p>Hello,</p>
      <p>This is a reminder that the following assignment is due soon:</p>
      <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ff6b00; border-radius: 5px; margin: 20px 0;">
        <p><strong>Assignment:</strong> ${escHtml(assignmentTitle)}</p>
        <p><strong>Due Date:</strong> ${escHtml(new Date(dueDate).toLocaleString())}</p>
      </div>
      <p>Please submit your assignment before the deadline.</p>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};

/**
 * Generate attendance reminder template
 */
export const generateAttendanceReminderTemplate = (
  courseName,
  attendancePercentage,
) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">Attendance Reminder</h2>
      <p>Hello,</p>
      <p>Your attendance in <strong>${escHtml(courseName)}</strong> is at <strong>${escHtml(attendancePercentage)}</strong>.</p>
      <div style="background-color: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; border-radius: 5px; margin: 20px 0;">
        <p>Please ensure you maintain the required attendance to avoid academic penalties.</p>
      </div>
      <p style="font-size: 12px; color: #777;">SocioFest College Portal</p>
    </div>
  `;
};
