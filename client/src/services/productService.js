import { apiClient } from "@/services/apiClient";

const API_URL = "/products";

export const getProducts = async () => {
  const response = await apiClient.get(API_URL);
  return response.data;
};

export const getProductById = async (id) => {
  const response = await apiClient.get(`${API_URL}/${id}`);
  return response.data;
};

export const createProduct = async (formData) => {
  const response = await apiClient.post(API_URL, formData);
  return response.data;
};

export const updateProduct = async (id, formData) => {
  const response = await apiClient.put(`${API_URL}/${id}`, formData);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await apiClient.delete(`${API_URL}/${id}`);
  return response.data;
};
