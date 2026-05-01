import { apiClient, toFormData, appendFiles } from "@/services/apiClient";

const API_URL = "/assignments";

export const getAssignmentsBySubject = async (subjectId) => {
  const res = await apiClient.get(`${API_URL}/${subjectId}`);
  return res.data;
};

export const createAssignment = async (subjectId, assignmentData, attachments = []) => {
  console.log("Creating assignment with data:", assignmentData, "and attachments:", attachments);
  if (attachments && attachments.length > 0) {
    const formData = toFormData(assignmentData);
    appendFiles(formData, attachments, "files");
    const res = await apiClient.post(`${API_URL}/${subjectId}`, formData);
    return res.data;
  }

  const res = await apiClient.post(`${API_URL}/${subjectId}`, assignmentData);
  return res.data;
};

export const updateAssignment = async (assignmentId, assignmentData, attachments = [], retainedMediaIds = []) => {
  const payload = { ...assignmentData, retainedMediaIds };
  if (attachments && attachments.length > 0) {
    const formData = toFormData(payload);
    appendFiles(formData, attachments, "files");
    const res = await apiClient.put(`${API_URL}/${assignmentId}`, formData);
    return res.data;
  }

  const res = await apiClient.put(`${API_URL}/${assignmentId}`, payload);
  return res.data;
};

export const deleteAssignment = async (assignmentId) => {
  const res = await apiClient.delete(`${API_URL}/${assignmentId}`);
  return res.data;
};

export const submitAssignment = async (assignmentId, formData) => {
  const res = await apiClient.post(`${API_URL}/${assignmentId}/submit`, formData);
  return res.data;
};

export const gradeSubmission = async (assignmentId, studentId, gradeData) => {
  const res = await apiClient.put(
    `${API_URL}/${assignmentId}/grade/${studentId}`,
    gradeData,
  );
  return res.data;
};
