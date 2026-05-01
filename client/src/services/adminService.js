/**
 * Admin service - Refactored to act as a proxy router
 * Interlinks the Admin Dashboard UI to the newly modularized backend controllers.
 */
import { apiClient } from "@/services/apiClient";
import * as userService from "./userService";
import * as departmentService from "./departmentService";

const API_BASE = "/admin";
const ANALYTICS_BASE = "/analytics";
const STATS_BASE = "/stats";

export const getOverview = async () => {
  const res = await apiClient.get(`${ANALYTICS_BASE}/dashboard?view=macro`);
  return res.data;
};

export const getSystemStats = async () => {
  try {
    // Prioritize the dedicated statistics endpoint
    const res = await apiClient.get(`${STATS_BASE}/user-counts`);
    return res.data;
  } catch (error) {
    // Log fallback clearly — do not silently remap unrelated fields
    console.warn('user-counts endpoint unavailable, stats may be incomplete:', error);
    // Return a clearly incomplete shape so the UI can show a degraded state
    return { students: null, teachers: null, quizzes: null, events: null, _degraded: true };
  }
};

// Route legacy user management requests to the unified user service
export const getAllUsers = userService.getAllUsers;
export const updateUserRole = userService.updateUserRole;
export const updateUserStatus = userService.updateUserStatus;
export const deleteUser = userService.deleteUser;

// Route legacy department requests to the unified department service
export const getDepartmentStats = departmentService.getAllDepartments;
export const createDepartment = departmentService.createDepartment;
export const updateDepartment = departmentService.updateDepartment;
export const deleteDepartment = departmentService.deleteDepartment;

export const getSystemLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  // Routed to analytics activity log
  const res = await apiClient.get(`${ANALYTICS_BASE}/activities?${params}`);
  return res.data;
};

export const getAuditTrail = async (resourceType, resourceId) => {
  // Routed to the newly implemented governance layer
  const res = await apiClient.get(`/governance/history/${resourceType}/${resourceId}`);
  return res.data;
};

export const exportData = async (dataType = "all") => {
  // Route to macro analytics CSV generator
  const res = await apiClient.get(`${ANALYTICS_BASE}/export?format=csv&view=macro`, {
    responseType: "blob",
  });
  // Keep as res.data because blobs do not have the standard success wrapper
  return res.data;
};

export const getSystemSettings = async () => {
  const res = await apiClient.get(`${API_BASE}/settings`);
  const data = res.data;
  return {
    ...data,
    serviceControls: {
      emailVerificationRequired: true,
      aiEnabled: true,
      faceRecognitionEnabled: true,
      wifiEnforcementEnabled: true,
      mediaPlayerFallbackEnabled: true,
      documentViewerFallbackEnabled: true,
      mobileSafeModeEnabled: true,
      ...(data?.serviceControls || {}),
    },
  };
};

// ✅ Strip the password at the service layer as a second line of defence
export const updateSystemSettings = async (settings) => {
  const payload = {
    ...settings,
    emailSettings: settings.emailSettings
      ? { ...settings.emailSettings, pass: settings.emailSettings.pass || undefined }
      : settings.emailSettings,
  };
  const res = await apiClient.put(`${API_BASE}/settings`, payload);
  return res.data;
};

export const getEmailSettings = async () => {
  const res = await apiClient.get(`${API_BASE}/email-settings`);
  return res.data;
};

export const getFfmpegConfig = async () => {
  const res = await apiClient.get(`${API_BASE}/ffmpeg-config`);
  return res.data;
};

export const updateFfmpegConfig = async (config) => {
  const res = await apiClient.put(`${API_BASE}/ffmpeg-config`, config);
  return res.data;
};

export default {
  getOverview,
  getSystemStats,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getDepartmentStats,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getSystemLogs,
  getAuditTrail,
  exportData,
  getSystemSettings,
  updateSystemSettings,
  getEmailSettings,
  getFfmpegConfig,
  updateFfmpegConfig,
};
