import { apiClient } from "@/services/apiClient";

const API_URL = "/push";

export const subscribeToPush = async (subscriptionData) => {
  const res = await apiClient.post(`${API_URL}/subscribe`, subscriptionData);
  return res.data;
};
