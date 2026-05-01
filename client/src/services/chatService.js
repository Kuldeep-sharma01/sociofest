import { apiClient, appendFiles } from "@/services/apiClient";

const API_URL = "/messages";

// Send a message
export const sendMessage = async (receiverId, payload) => {
  const response = await apiClient.post(`${API_URL}/send/${receiverId}`, payload);
  return response.data;
};


export const markAsRead = async (senderId) => {
  const res = await apiClient.put(`${API_URL}/read`, { senderId });
  return res.data;
};

export const deleteMessage = async (messageId) => {
  const res = await apiClient.delete(`${API_URL}/${messageId}`);
  return res.data;
};

// Get conversation with a specific user
export const getMessages = async (userId, cursor = null, limit = 30) => {
  const params = { limit };
  if (cursor) {
    params.cursor = cursor;
  }
  const res = await apiClient.get(`${API_URL}/${userId}`, {
    params,
  });
  return res.data;
};


export const updateMessage = async (messageId, payload) => {
  const res = await apiClient.put(`${API_URL}/${messageId}`, payload);
  return res.data;
};

export const getUnreadCount = async () => {
  const response = await apiClient.get(`${API_URL}/unread-count`);
  return response.data;
};

export const toggleFavorite = async (userId) => {
    const res = await apiClient.put(`${API_URL}/favorite/${userId}`, {});
    return res.data;
};

export const createGroup = async (groupData) => {
    const res = await apiClient.post(`${API_URL}/group`, groupData);
    return res.data;
};

export const updateGroup = async (groupId, formData) => {
    const res = await apiClient.put(`${API_URL}/group/${groupId}/update`, formData);
    return res.data;
};

export const removeGroupMember = async (groupId, memberId) => {
    const res = await apiClient.put(`${API_URL}/group/${groupId}/remove`, { memberId });
    return res.data;
};

export const addGroupMembers = async (groupId, participants) => {
    const res = await apiClient.put(`${API_URL}/group/${groupId}/add`, { participants });
    return res.data;
};

export const searchUsers = async (query) => {
  const res = await apiClient.get(`${API_URL}/search/users`, {
    params: { q: query },
  });
  return res.data;
};


// Get recent conversations
export const getConversations = async () => {
  const response = await apiClient.get(`${API_URL}/conversations`);
  return response.data;
};

export const getArchivedConversations = async () => {
  const response = await apiClient.get(`${API_URL}/archived`);
  return response.data;
};

export const unarchiveGroup = async (groupId) => {
  const res = await apiClient.put(`${API_URL}/group/${groupId}/unarchive`);
  return res.data;
};
