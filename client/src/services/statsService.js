import { apiClient } from "@/services/apiClient";

const API_BASE = "/stats";

/**
 * Get user counts (Admin/HOD)
 */
export const getUserCounts = async () => {
  const res = await apiClient.get(`${API_BASE}/user-counts`);
  return res.data;
};

/**
 * Get HOD overview stats
 */
export const getHODOverview = async (hodId = "") => {
  const query = hodId ? `?hodId=${encodeURIComponent(hodId)}` : "";
  const res = await apiClient.get(`${API_BASE}/hod-overview${query}`);
  return res.data;
};

/**
 * Get Teacher overview stats
 */
export const getTeacherOverview = async (teacherId = "") => {
  const query = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : "";
  const res = await apiClient.get(`${API_BASE}/teacher-overview${query}`);
  return res.data;
};

/**
 * Get quiz stats
 */
export const getQuizStats = async (quizId) => {
  const res = await apiClient.get(`${API_BASE}/quiz-stats/${quizId}`);
  return res.data;
};

/**
 * Get stats for all quizzes (Admin/HOD)
 */
export const getAllQuizStats = async () => {
  const res = await apiClient.get(`${API_BASE}/all-quiz-stats`);
  return res.data;
};

export const getStudentOverview = async (studentId = "") => {
  const query = studentId ? `?studentId=${studentId}` : "";
  const res = await apiClient.get(`${API_BASE}/student-overview${query}`);
  return res.data;
};
