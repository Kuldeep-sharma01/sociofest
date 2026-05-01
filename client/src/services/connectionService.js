import { apiClient } from "@/services/apiClient";

const API_URL = "/connections";

export const sendConnectionRequest = async (userId) => {
  const res = await apiClient.post(`${API_URL}/request/${userId}`, {});
  return res.data;
};

export const getConnectionStatus = async (userId) => {
  const res = await apiClient.get(`${API_URL}/status/${userId}`);
  return res.data;
};

export const getConnections = async () => {
  const res = await apiClient.get(API_URL);
  return res.data;
};

export const getConnectionRequests = async () => {
  const res = await apiClient.get(`${API_URL}/requests`);
  return res.data;
};

export const respondToConnectionRequest = async (connectionId, status) => {
  const res = await apiClient.put(`${API_URL}/respond/${connectionId}`, { status });
  return res.data;
};
