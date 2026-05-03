import express from "express";
import {
  translateMedia,
  transcribeAudio,
  generateContent,
  textToSpeech,
  analyzeImage,
  fetchModels,
  proxyChat,
  proxyMedia,
  getAiRuntimeConfig,
  upsertAiRuntimeConfig,
  previewSourceEdit,
  getOllamaConfig,
  pullOllamaModel,
  uploadUserVoice,
  checkServiceStatus,
} from "../controllers/aiController.js";
import upload from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";
import { roleCheck } from "../middleware/roleCheck.js";
import { ok, activityLoggerMiddleware } from "../utils/index.js";


const router = express.Router();

/**
 * Service Status
 */

// Status route moved to the end of the file for better consolidation with Python health checks

/**
 * Translation and Media Processing
 */

/**
 * @route   POST /api/ai/translate-media
 * @desc    Translate media content
 * @access  Private
 */
router.post("/translate-media", protect, activityLoggerMiddleware('TRANSLATE_MEDIA'), translateMedia);

/**
 * Audio Processing
 */

/**
 * @route   POST /api/ai/transcribe
 * @desc    Transcribe audio to text
 * @access  Private
 */
router.post("/transcribe", protect, upload.single("audio"), activityLoggerMiddleware('TRANSCRIBE_AUDIO'), transcribeAudio);

/**
 * @route   POST /api/ai/text-to-speech
 * @desc    Convert text to speech
 * @access  Private
 */
router.post("/text-to-speech", protect, activityLoggerMiddleware('TEXT_TO_SPEECH'), textToSpeech);
router.get("/text-to-speech", textToSpeech); // Public GET for direct audio streaming

/**
 * Content Generation and Analysis
 */

/**
 * @route   POST /api/ai/generate-content
 * @desc    Generate AI content
 * @access  Private
 */
router.post("/generate-content", protect, activityLoggerMiddleware('GENERATE_CONTENT'), generateContent);

/**
 * @route   POST /api/ai/analyze-image
 * @desc    Analyze image content
 * @access  Private
 */
router.post("/analyze-image", protect, upload.single("image"), activityLoggerMiddleware('ANALYZE_IMAGE'), analyzeImage);

/**
 * @route   POST /api/ai/models
 * @desc    Fetch available AI models securely from the backend
 * @access  Private/Admin
 */
// ✅ Restrict to Admin or a small set of trusted roles
router.post("/models", protect, roleCheck(['Admin','Teacher','HOD','Student']), fetchModels);

/**
 * @route   POST /api/ai/chat
 * @desc    Proxy chat requests to external LLM providers
 * @access  Private
 */
router.post("/chat", express.json({ limit: '10mb' }), protect, activityLoggerMiddleware('AI_CHAT'), proxyChat);

/**
 * @route   POST /api/ai/media
 * @desc    Proxy media generation (Image/Video) requests
 * @access  Private
 */
router.post("/media", express.json({ limit: '20mb' }), protect, activityLoggerMiddleware('AI_MEDIA'), proxyMedia);

/**
 * @route   GET /api/ai/runtime-config
 * @desc    Get model routing/fallback configuration
 * @access  Private
 */
router.get("/runtime-config", protect, getAiRuntimeConfig);

/**
 * @route   PUT /api/ai/runtime-config
 * @desc    Save model routing/fallback configuration
 * @access  Private/Admin/HOD
 */
router.put(
  "/runtime-config",
  express.json({ limit: "2mb" }),
  protect,
  roleCheck(["Admin", "HOD"]),
  activityLoggerMiddleware("AI_RUNTIME_CONFIG_UPDATE"),
  upsertAiRuntimeConfig,
);

/**
 * @route   POST /api/ai/source-edit/preview
 * @desc    Generate safe, preview-only source edit suggestion
 * @access  Private
 */
router.post(
  "/source-edit/preview",
  express.json({ limit: "2mb" }),
  protect,
  activityLoggerMiddleware("AI_SOURCE_EDIT_PREVIEW"),
  previewSourceEdit,
);

/**
 * @route   GET /api/ai/ollama/config
 * @desc    Get Ollama configuration and installed models
 * @access  Private/Admin
 */
router.get("/ollama/config", protect, roleCheck(["Admin", "HOD"]), getOllamaConfig);

/**
 * @route   POST /api/ai/ollama/pull
 * @desc    Pull an Ollama model to the host
 * @access  Private/Admin
 */
router.post("/ollama/pull", protect, roleCheck(["Admin", "HOD"]), pullOllamaModel);
router.post("/upload-voice", protect, upload.single("audio"), uploadUserVoice);
router.get("/status", checkServiceStatus);

export default router;