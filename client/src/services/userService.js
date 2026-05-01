// client/src/services/userService.js
import { apiClient, toFormData } from "@/services/apiClient";

const API_BASE = "/users";
const AUTH_BASE = "/auth";

/**
 * Deeply traverse nested objects to check for File or Blob attachments
 */
const hasFilesDeep = (obj, depth = 0, visited = new WeakSet()) => {
  if (!obj || depth > 5 || typeof obj !== 'object') return false;
  if (visited.has(obj)) return false;
  visited.add(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val instanceof File || val instanceof Blob) return true;
    if (val && typeof val === 'object' && hasFilesDeep(val, depth + 1, visited)) return true;
  }
  return false;
};

/**
 * Register a new user (Student/Teacher/Admin)
 * @param {Object} userData - Contains base user info + role specific fields + files
 * @returns {Promise<Object>} Created user data + token
 */
export const registerUser = async (userData, idToken) => {
  const hasFiles = hasFilesDeep(userData);
  const payload = hasFiles ? toFormData(userData) : userData;
  const config = idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {};

  const res = await apiClient.post(`${AUTH_BASE}/register`, payload, config);
  return res.data;
};

/**
 * Verify User Email via OTP
 */
export const verifyOTP = async (otpData) => {
  const res = await apiClient.post(`${AUTH_BASE}/verify-otp`, otpData);
  return res.data;
};

/**
 * Process OAuth Login
 */
export const oauthLogin = async (userData, idToken) => {
  const res = await apiClient.post(`${AUTH_BASE}/google`, userData, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  return res.data;
};

/**
 * Resend Verification OTP
 */
export const resendVerificationOTP = async (userId) => {
  const res = await apiClient.post(`${AUTH_BASE}/resend-otp`, { userId });
  return res.data;
};

/**
 * Request password reset OTP
 */
export const requestPasswordReset = async (email) => {
  const res = await apiClient.post(`${AUTH_BASE}/forgot-password`, { email });
  return res.data;
};

/**
 * Verify OTP for password reset
 */
export const verifyResetOtp = async (otpData) => {
  const normalizedEmail = String(otpData?.email || "").trim().toLowerCase();
  const normalizedOtp = String(otpData?.otp || "").trim();
  return {
    email: normalizedEmail,
    otp: normalizedOtp,
    resetToken: `${normalizedEmail}:${normalizedOtp}`,
  };
};

/**
 * Verify OTP and reset password
 */
export const resetPassword = async (resetData) => {
  const res = await apiClient.post(`${AUTH_BASE}/reset-password`, resetData);
  return res.data;
};

/**
 * Login existing user
 * @param {Object} credentials - { email, password }
 * @returns {Promise<Object>} User data + JWT token
 */
export const loginUser = async (credentials) => {
  const res = await apiClient.post(`${AUTH_BASE}/login`, credentials);
  return res.data;
};

/**
 * Logout user
 */
export const logoutUser = () => {
  // Handled entirely by Redux authSlice logout reducer
};

/**
 * Get logged-in user profile using JWT
 * @returns {Promise<Object>} User details
 */
export const getProfile = async () => {
  const res = await apiClient.get(`${AUTH_BASE}/profile`);
  return res.data;
};

// Get student profile details
export const getStudentProfile = async (userId) => {
  const res = await apiClient.get(`${API_BASE}/student-profile/${userId}`);
  return res.data;
};

export const getTeacherProfile = async (userId) => {
  const res = await apiClient.get(`${API_BASE}/teacher-profile/${userId}`);
  return res.data;
};

export const getHODProfile = async (userId) => {
  const res = await apiClient.get(`${API_BASE}/hod-profile/${userId}`);
  return res.data;
};

export const getUserById = async (userId, signal) => {
  const res = await apiClient.get(`${API_BASE}/${userId}`, { signal });
  return res.data;
};

export const getDepartments = async () => {
  const res = await apiClient.get(`${API_BASE}/departments`);
  return res.data;
};

export const getDepartmentSemesters = async (deptName) => {
  const res = await apiClient.get(
    `${API_BASE}/hods/department/${encodeURIComponent(deptName)}`,
  );
  return res.data;
};

export const getDepartmentHODKeys = async (deptName) => {
  const res = await apiClient.get(
    `${API_BASE}/hods/department/${encodeURIComponent(deptName)}/keys`,
  );
  return res.data;
};

export const getTeachersByDepartment = async (deptName, sem) => {
  const res = await apiClient.get(
    `${API_BASE}/teachers/department/${encodeURIComponent(deptName)}/semester/${sem}`,
  );
  return res.data;
};

/**
 * Get all users (Admin only)
 * @param {Object} params - Query filters { status, role, department }
 * @returns {Promise<Array>} List of users
 */
export const getAllUsers = async (params = {}, signal) => {
  const res = await apiClient.get(API_BASE, {
    params: params,
    signal,
  });
  // console.log("Fetched Users in service:", res.data);
  return res.data;
};

/**
 * Approve or change a user’s role (Admin only)
 * @param {String} userId - Target user ID
 * @param {String} newRole - 'student', 'teacher', or 'admin'
 */
export const updateUserRole = async (userId, newRole) => {
  const res = await apiClient.put(`${API_BASE}/${userId}/role`, {
    role: newRole,
  });
  return res.data;
};

/**
 * Approve, Reject, or Block a user (Admin/HOD)
 * @param {String} userId - Target user ID
 * @param {Object} statusData - { status, rejectionReason }
 */
export const updateUserStatus = async (userId, statusData) => {
  const res = await apiClient.put(`${API_BASE}/${userId}/status`, statusData);
  return res.data;
};

/**
 * Delete user (Admin only)
 * @param {String} userId - User ID
 */
export const deleteUser = async (userId) => {
  const res = await apiClient.delete(`${API_BASE}/${userId}`);
  return res.data;
};

export const changePassword = async (userId, passwordData) => {
  const res = await apiClient.put(
    `${API_BASE}/${userId}/password`,
    passwordData,
  );
  return res.data;
};

export const updateUserProfile = async (userId, data) => {
  const hasFiles = hasFilesDeep(data);
  const payload = hasFiles ? toFormData(data) : data;
  const res = await apiClient.put(`${API_BASE}/profile/${userId}`, payload);
  return res.data;
};

export const updateStudentSemester = async (userId, action) => {
  const res = await apiClient.put(`${API_BASE}/${userId}/semester`, { action });
  return res.data;
};

export const bulkUpdateUserStatus = async (
  ids,
  status,
  rejectionReason = null,
) => {
  const res = await apiClient.put(`${API_BASE}/bulk-status`, {
    ids,
    status,
    rejectionReason,
  });
  return res.data;
};

export const addEmail = async (email) => {
  const res = await apiClient.post(`${API_BASE}/profile/add-email`, { email });
  return res.data;
};

export const verifyNewEmail = async (emailData) => {
  const res = await apiClient.post(
    `${API_BASE}/profile/verify-email`,
    emailData,
  );
  return res.data;
};

export const bulkUpdateUserSemester = async (ids, action) => {
  const res = await apiClient.put(`${API_BASE}/bulk-semester`, {
    ids,
    action,
  });
  return res.data;
};

export const bulkUploadUsers = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  // ✅ Remove the manual Content-Type header — axios sets it correctly with the boundary
  const res = await apiClient.post(`${API_BASE}/bulk-upload`, formData);
  return res.data;
};
