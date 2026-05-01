import { apiClient } from "@/services/apiClient";

const API_URL = "/search";

export const globalSearch = async (query, quick = false) => {
  const res = await apiClient.get(`${API_URL}?q=${encodeURIComponent(query)}&quick=${quick}`);
  return res.data;
};
