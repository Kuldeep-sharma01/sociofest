import { apiClient } from "@/services/apiClient";

const API_URL = "/quizzes";

export const getAllQuizzes = async () => {
  const res = await apiClient.get(API_URL);
  return res.data;
};

export const getQuizLeaderboard = async (quizId, page = 1, limit = 10) => {
  const res = await apiClient.get(`${API_URL}/${quizId}/leaderboard`, {
    params: { page, limit },
  });
  return {
    leaderboard: Array.isArray(res.data) ? res.data : [],
    totalPages: res.meta?.pagination?.pages || 1,
  };
};

export const createQuiz = async (quizData) => {
  const res = await apiClient.post(API_URL, quizData);
  return res.data;
};

export const getQuizzesByTeacher = async (teacherId) => {
  const res = await apiClient.get(`${API_URL}/teacher/${teacherId}`);
  return res.data;
};

export const closeQuiz = async (quizId) => {
  const res = await apiClient.post(`${API_URL}/${quizId}/close`, {});
  return res.data;
};

export const deleteQuiz = async (quizId) => {
  const res = await apiClient.delete(`${API_URL}/${quizId}`);
  return res.data;
};

export const updateQuiz = async (quizId, quizData) => {
  const res = await apiClient.put(`${API_URL}/${quizId}`, quizData);
  return res.data;
};

export const getQuizById = async (quizId) => {
  const res = await apiClient.get(`${API_URL}/${quizId}`);
  return res.data;
};

export const submitQuiz = async (quizId, submissionData) => {
  const res = await apiClient.post(`${API_URL}/${quizId}/submit`, submissionData);
  return res.data;
};

export const flagQuizAttempt = async (quizId, violationType) => {
  const res = await apiClient.post(`${API_URL}/${quizId}/flag`, { violationType });
  return res.data;
};
