import { apiClient } from "@/services/apiClient";

const API_URL = "/subjects";

export const getAllSubjects = async () => {
  const res = await apiClient.get(API_URL);
  return res.data;
};

export const getSubjectsByDepartment = async (deptId) => {
  const res = await apiClient.get(`${API_URL}/department/${deptId}`);
  return res.data;
};

export const getSubjectById = async (subjectId) => {
  const res = await apiClient.get(`${API_URL}/${subjectId}`);
  return res.data;
};

export const createSubject = async (subjectData) => {
  const res = await apiClient.post(API_URL, subjectData);
  return res.data;
};

export const updateSubject = async (subjectId, subjectData) => {
  const res = await apiClient.put(`${API_URL}/${subjectId}`, subjectData);
  return res.data;
};

export const deleteSubject = async (subjectId) => {
  const res = await apiClient.delete(`${API_URL}/${subjectId}`);
  return res.data;
};

export const assignTeacherToSubject = async (subjectId, teacherId) => {
  const res = await apiClient.post(`${API_URL}/${subjectId}/assign`, { teacherId });
  return res.data;
};
