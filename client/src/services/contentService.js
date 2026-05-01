import { apiClient, toFormData, appendFiles } from "@/services/apiClient";

const API_URL = "/content";

export const getAllContent = async ({ cursor, limit = 10, type }) => {
  const res = await apiClient.get(API_URL, {
    params: { cursor, limit, type },
  });
  return res.data;
};

export const getContentByUser = async (userId) => {
  const res = await apiClient.get(`${API_URL}/user/${userId}`);
  return res.data;
};

export const getNotices = async () => {
  const res = await apiClient.get(`${API_URL}/notices`);
  return res.data;
};

export const createContent = async (
  contentStr,
  attachments = [],
  onProgress,
  extraPayload = {},
) => {
  const actualFiles = attachments.filter((a) => a.file);
  const externalLinks = attachments.filter((a) => !a.file && a.previewUrl);

  const formData = toFormData({ content: contentStr, ...extraPayload });
  appendFiles(formData, actualFiles, "files");

  externalLinks.forEach((att) => {
    formData.append("mediaUrls", att.previewUrl);
    formData.append("mediaTypes", att.type || "image");
  });

  const res = await apiClient.post(API_URL, formData, {
    onUploadProgress: onProgress,
  });
  return res.data;
};

export const updateContent = async (id, contentData, config = {}) => {
  const res = await apiClient.put(`${API_URL}/${id}`, contentData, config);
  return res.data;
};

export const updateContentWithMedia = async (
  id,
  contentStr,
  attachments = [],
  onProgress = null,
  extraPayload = {},
) => {
  const actualFiles = attachments.filter((a) => a.file);
  const externalLinks = attachments.filter(
    (a) => !a.file && a.previewUrl && !a._id,
  );

  if (
    actualFiles.length > 0 ||
    externalLinks.length > 0 ||
    Object.keys(extraPayload).length > 0
  ) {
    const formData = toFormData({ content: contentStr, ...extraPayload });
    appendFiles(formData, actualFiles, "files");
    externalLinks.forEach((att) => {
      formData.append("newMediaUrls", att.previewUrl);
      formData.append("newMediaTypes", att.type || "image");
    });
    const res = await apiClient.put(`${API_URL}/${id}`, formData, {
      onUploadProgress: onProgress,
    });
    return res.data;
  }

  const res = await apiClient.put(`${API_URL}/${id}`, { content: contentStr });
  return res.data;
};

export const deleteContent = async (id) => {
  const res = await apiClient.delete(`${API_URL}/${id}`);
  return res.data;
};

export const toggleLike = async (id, type) => {
  const res = await apiClient.post(`${API_URL}/${id}/like`, { type });
  return res.data;
};

export const addComment = async (id, text) => {
  const res = await apiClient.post(`${API_URL}/${id}/comment`, { text });
  return res.data;
};

export const deleteComment = async (postId, commentIndex) => {
  const res = await apiClient.delete(
    `${API_URL}/${postId}/comment/${commentIndex}`,
  );
  return res.data;
};

export const editComment = async (postId, commentIndex, text) => {
  const res = await apiClient.put(
    `${API_URL}/${postId}/comment/${commentIndex}`,
    { text },
  );
  return res.data;
};
