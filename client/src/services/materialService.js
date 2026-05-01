import { apiClient } from "@/services/apiClient";

/**
 * @deprecated for StudyHub use — StudyHub uses contentService with [LECTURE] prefix encoding.
 * This service manages structured per-subject materials via /materials/:subjectId.
 */

const API_URL = "/materials";

export const getMaterialsBySubject = async (subjectId) => {
  const res = await apiClient.get(`${API_URL}/${subjectId}`);
  return res.data;
};

export const uploadMaterial = async (subjectId, formData, onProgress) => {
  const res = await apiClient.post(`${API_URL}/${subjectId}`, formData, {
    onUploadProgress: onProgress,
  });
  return res.data;
};

export const deleteMaterial = async (materialId) => {
  const res = await apiClient.delete(`${API_URL}/${materialId}`);
  return res.data;
};
