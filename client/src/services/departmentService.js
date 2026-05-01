import { apiClient } from "@/services/apiClient";

const API_URL = "/departments";

/**
 * Fetches all departments with populated HOD and subject details.
 * @returns {Promise<Array>} A list of department objects.
 */
export const getAllDepartments = async () => {
  const response = await apiClient.get(API_URL);
  return response.data;
};

/**
 * Updates department details (name, code).
 */
export const updateDepartment = async (id, data) => {
  const response = await apiClient.put(`${API_URL}/${id}`, data);
  return response.data;
};

/**
 * Creates a new department.
 */
export const createDepartment = async (data) => {
  const response = await apiClient.post(API_URL, data);
  return response.data;
};

/**
 * Deletes a department.
 */
export const deleteDepartment = async (id) => {
  const response = await apiClient.delete(`${API_URL}/${id}`);
  return response.data;
};
