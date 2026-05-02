// client/src/services/aiService.js
/**
 * AI service - handles AI-powered features
 * Covers translation, transcription, image generation, and AI content features
 */
import axios from "axios";
import { apiClient, pythonClient } from "@/services/apiClient";
import { getPublicSystemSettings } from "@/services/systemSettingsService";

const API_BASE = "/ai";

/**
 * Smart Helper to dynamically build FormData
 * Allows passing extra parameters alongside files without manual appending
 */
const buildSmartFormData = (fileKey, file, extraData = {}) => {
  const formData = new FormData();
  formData.append(fileKey, file);
  Object.entries(extraData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });
  return formData;
};

/**
 * Translate media (audio) with optional text-to-speech
 * @param {Object} data - { text, sourceLanguage, targetLanguage, targetVoice, generateAudio, sourceAudioUrl }
 * @param {Object} config - Axios config options (e.g., { signal: abortController.signal })
 * @returns {Promise<Object>} Translation result with audio URL
 */
export const translateMedia = async (data, config = {}) => {
  const res = await apiClient.post(`${API_BASE}/translate-media`, data, config);
  return res.data;
};

/**
 * Transcribe audio to text
 * @param {File} audioFile - Audio file to transcribe
 * @param {Object} config - Axios config options (e.g., { onUploadProgress })
 * @returns {Promise<Object>} { vtt, subtitles, duration }
 */
export const transcribeAudio = async (audioFile, config = {}) => {
  const formData = new FormData();
  formData.append("audio", audioFile);
  const res = await apiClient.post(`${API_BASE}/transcribe`, formData, config);
  return res.data;
};

/**
 * Clone voice from an audio reference using the Coqui XTTSv2 Microservice
 */
export const cloneVoice = async (text, language, audioFile, config = {}) => {
  const formData = new FormData();
  formData.append("text", text);
  formData.append("language", language);
  formData.append("speaker_wav", audioFile);
  const res = await pythonClient.post(`/voice-api/clone-voice`, formData, {
    responseType: "blob",
    ...config,
  });
  return res.data;
};

/**
 * Generate content using AI
 * @param {Object} data - { prompt, contentType, context }
 * @param {Object} config - Axios config options
 * @returns {Promise<Object>} { generated_content }
 */
export const generateContent = async (data, config = {}) => {
  const settings = await getPublicSystemSettings();
  if (settings.serviceControls?.aiEnabled === false) {
    throw new Error("AI features are temporarily disabled by admin.");
  }
  const res = await apiClient.post(`${API_BASE}/generate-content`, data, config);
  return res.data;
};

/**
 * Verify face recognition
 * @param {File} imageFile - Image file for face verification
 * @param {Object} config - Axios config options
 * @returns {Promise<Object>} { verified, confidence, userId }
 */
export const verifyFace = async (imageFile, userId, config = {}) => {
  const formData = buildSmartFormData("image", imageFile, {
    userId,
    clientLivenessVerified: "true",
  });
  const res = await pythonClient.post(`/verify-face`, formData, config);
  return res.data;
};

/**
 * Register face recognition for a user
 */
export const registerFace = async (imageFile, userId, config = {}) => {
  const formData = buildSmartFormData("image", imageFile, {
    userId,
    clientLivenessVerified: "true",
  });
  const res = await pythonClient.post(`/register-face`, formData, config);
  return res.data;
};

/**
 * Assess face quality for registration
 */
export const assessFace = async (imageFile, config = {}) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  const res = await pythonClient.post(`/assess-face`, formData, config);
  return res.data;
};

/**
 * Get AI service status
 * @param {Object} config - Axios config options
 * @returns {Promise<Object>} { status, version, features }
 */
export const getServiceStatus = async (config = {}) => {
  try {
    const res = await apiClient.get(`${API_BASE}/status`, config);
    return res.data;
  } catch (error) {
    if (error.name === "CanceledError") throw error; // Re-throw cancellations
    return { status: "offline", error: error.message };
  }
};

/**
 * Get detailed health status from Python AI microservice
 */
export const getPythonHealth = async (config = {}) => {
  const res = await pythonClient.get("/health", config);
  return res.data;
};

/**
 * Toggle AI hardware between CPU and GPU
 */
export const toggleHardware = async (device, config = {}) => {
  const res = await pythonClient.post("/toggle-hardware", { device }, config);
  return res.data;
};

/**
 * Text-to-Speech conversion
 * @param {Object} data - { text, language, voice, speed }
 * @param {Object} config - Axios config options
 * @returns {Promise<Blob>} Audio file blob
 */
export const textToSpeech = async (data, config = {}) => {
  const response = await apiClient.post(`${API_BASE}/text-to-speech`, data, {
    responseType: "blob",
    ...config,
  });
  return response.data;
};

/**
 * Analyze image using computer vision
 * @param {File} imageFile - Image file to analyze
 * @param {String} analysisType - Type of analysis (object_detection, ocr, etc.)
 * @param {Object} config - Axios config options
 * @returns {Promise<Object>} Analysis results
 */
export const analyzeImage = async (imageFile, analysisType = "object_detection", config = {}) => {
  const formData = buildSmartFormData("image", imageFile, { analysis_type: analysisType });
  const res = await apiClient.post(`${API_BASE}/analyze-image`, formData, config);
  return res.data;
};

/**
 * Detect objects in image
 * @param {File} imageFile - Image file
 * @param {Object} config - Axios config options
 * @returns {Promise<Array>} Detected objects with confidence scores
 */
export const detectObjects = async (imageFile, config = {}) => {
  return analyzeImage(imageFile, "object_detection", config);
};

/**
 * Extract text from image (OCR)
 * @param {File} imageFile - Image file
 * @param {Object} config - Axios config options
 * @returns {Promise<Object>} { text, layout, confidence }
 */
export const extractTextFromImage = async (imageFile, config = {}) => {
  return analyzeImage(imageFile, "ocr", config);
};

export default {
  translateMedia,
  transcribeAudio,
  cloneVoice,
  generateContent,
  verifyFace,
  registerFace,
  assessFace,
  getStatus: getServiceStatus,
  textToSpeech,
  analyzeImage,
  detectObjects,
  extractText: extractTextFromImage,
  getPythonHealth,
  toggleHardware,
};
