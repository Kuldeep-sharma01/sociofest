import { apiClient } from "@/services/apiClient";

const API_URL = "/wifi";

export const verifyWifi = async () => {
  const res = await apiClient.get(`${API_URL}/verify`);
  return res.data;
};

export const getWhitelist = async () => {
  const res = await apiClient.get(`${API_URL}/whitelist`);
  return res.data;
};

export const addWhitelist = async (data) => {
  const res = await apiClient.post(`${API_URL}/whitelist`, data);
  return res.data;
};

export const deleteWhitelist = async (id) => {
  const res = await apiClient.delete(`${API_URL}/whitelist/${id}`);
  return res.data;
};
