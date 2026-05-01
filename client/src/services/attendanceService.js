import { apiClient } from "@/services/apiClient";

const API_URL = "/attendance";

export const markAttendance = async (attendanceData) => {
  const res = await apiClient.post(`${API_URL}/mark`, attendanceData);
  return res.data;
};

export const getStudentAttendance = async (studentId, params = {}) => {
  const res = await apiClient.get(`${API_URL}/student/${studentId}`, {
    params,
  });
  return res.data;
};

export const getCurriculumAttendance = async (curriculumId, params = {}) => {
  const res = await apiClient.get(`${API_URL}/curriculum/${curriculumId}`, {
    params,
  });
  return res.data;
};

export const getDepartmentAttendance = async (department, params = {}) => {
  const res = await apiClient.get(`${API_URL}/department/${department}`, {
    params,
  });
  return res.data;
};

export const getAttendanceStats = async (studentId) => {
  const res = await apiClient.get(`${API_URL}/stats/student/${studentId}`);
  return res.data;
};
