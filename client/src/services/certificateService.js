// client/src/services/certificateService.js
import { apiClient } from "@/services/apiClient";

const API_BASE = "/certificates";

/**
 * Fetch all certificates belonging to a specific student
 * @param {String} studentId - The ID of the logged-in student
 * @returns {Promise<Array>} List of certificate metadata
 */
export const getCertificatesByStudent = async (studentId) => {
  const res = await apiClient.get(`${API_BASE}/user/${studentId}`);
  return res.data;
};

/**
 * Generate a new certificate for a student (teacher/admin)
 * @param {Object} data - Certificate data (studentId, eventId, quizId, template, etc.)
 */
export const generateCertificate = async (data) => {
  const res = await apiClient.post(`${API_BASE}`, data);
  return res.data;
};

/**
 * Download a specific certificate as PDF
 * @param {String} certificateId - Unique certificate ID
 * @returns {Promise<Blob>} PDF file blob
 */
export const downloadCertificate = async (certificateId) => {
  const res = await apiClient.get(`${API_BASE}/download/${certificateId}`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `certificate-${certificateId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Fetch all certificates
 * @returns {Promise<Array>} List of all certificates
 */
export const getAllCertificates = async () => {
  const res = await apiClient.get(`${API_BASE}`);
  return res.data;
};

/**
 * Delete a certificate (admin only)
 * @param {String} certificateId - Certificate ID
 */
export const deleteCertificate = async (certificateId) => {
  const res = await apiClient.delete(`${API_BASE}/${certificateId}`);
  return res.data;
};
