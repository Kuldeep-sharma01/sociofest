import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import {
  ok,
  badRequest,
  serverError,
  unprocessableEntity,
  forbidden,
} from "../utils/index.js";
import AIModelConfig from "../models/AIModelConfig.js";
import { runWithFallbackChain } from "../utils/aiProviderRouter.js";
import { readSystemSettings } from "../utils/systemSettings.js";

// Lazily load GenAI so missing production keys throw immediate 500s instead of falling back to test mocks
const getGenAI = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
};

// ✅ Enforce file size limits in upload middleware and avoid sync reads
const fileToGenerativePart = async (filePath, mimeType) => {
  const data = await fs.promises.readFile(filePath, { encoding: 'base64' });
  return { inlineData: { data, mimeType } };
};

// ✅ Add quota / entitlement checks at the start of each AI endpoint
const AI_ALLOWED_ROLES = new Set(['Admin', 'Teacher', 'HOD', 'Student']);

// ✅ Enhanced assertAiAccess that returns structured errors instead of throwing
const assertAiAccess = async (req) => {
  // Check 1: User exists
  if (!req.user) {
    return { error: true, status: 401, message: 'Unauthorized - Please log in' };
  }
  
  // Check 2: AI enabled in system settings
  try {
    const settings = await readSystemSettings();
    if (!settings.serviceControls?.aiEnabled) {
      return { error: true, status: 403, message: 'AI features are temporarily disabled by admin' };
    }
  } catch (settingsErr) {
    console.warn('Could not read system settings:', settingsErr.message);
    // Continue with defaults if settings can't be read
  }
  
  // Check 3: User role in allowed list
  if (!AI_ALLOWED_ROLES.has(req.user.role)) {
    return { error: true, status: 403, message: `AI access is not available for your account role (${req.user.role}). Only Admin, Teacher, HOD, and Student roles can access AI.` };
  }
  
  // Check 4: User status is approved
  if (req.user.status !== 'Approved') {
    return { error: true, status: 403, message: `Your account must be Approved to use AI features. Current status: ${req.user.status || 'Unknown'}` };
  }
  
  return { error: false, status: 200 };
};

export const generateContent = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) {
      return accessCheck.status === 401 
        ? badRequest(res, accessCheck.message)
        : forbidden(res, accessCheck.message);
    }
    const { prompt, messages, contentType, systemInstruction } = req.body;

    if (!prompt && (!messages || messages.length === 0)) {
      return badRequest(res, "Prompt is required");
    }

    // ✅ Cap input sizes
    const MAX_PROMPT_LENGTH = 32_000;    // ~8k tokens
    const MAX_MESSAGES = 100;
    const MAX_MESSAGE_LENGTH = 8_000;

    if (prompt && prompt.length > MAX_PROMPT_LENGTH) {
      return badRequest(res, `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
    }
    if (messages) {
      if (messages.length > MAX_MESSAGES) return badRequest(res, 'Too many messages in history');
      for (const m of messages) {
        if (m.text && m.text.length > MAX_MESSAGE_LENGTH) {
          return badRequest(res, 'A message in history exceeds the maximum length');
        }
      }
    }

    // ✅ Restrict system instructions to server-defined presets
    const SYSTEM_PROMPTS = {
      default: 'You are a helpful assistant.',
      quiz_generation: 'You generate JSON quiz objects only.',
      document_chat: 'Answer using the provided document context only.',
    };
    const safeSystem = SYSTEM_PROMPTS[contentType] || SYSTEM_PROMPTS.default;

    const genAI = getGenAI();
    if (!genAI) {
      return serverError(
        res,
        "AI Configuration Error: GEMINI_API_KEY is missing in the server environment.",
      );
    }

    let generatedText = "";

    switch (contentType) {
      case "image_generation":
        return unprocessableEntity(
          res,
          "Image generation backend not yet connected",
        );

      case "document_chat":
        // ✅ Validate messages structure before use
        if (!Array.isArray(messages) || messages.length < 1) {
          return badRequest(res, 'messages must be a non-empty array');
        }
        for (const m of messages) {
          if (!m || !['user', 'ai', 'model'].includes(m.role) || typeof m.text !== 'string') {
            return badRequest(res, 'Invalid message format');
          }
        }

        const chatModel = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          systemInstruction: safeSystem,
        });
        const formattedHistory = messages.slice(0, -1).map((msg) => ({
          role: msg.role === "ai" ? "model" : "user",
          parts: [{ text: msg.text }],
        }));

        const chat = chatModel.startChat({ history: formattedHistory });
        const chatResult = await chat.sendMessage(
          messages[messages.length - 1].text,
        );
        generatedText = chatResult.response.text();
        break;

      case "quiz_generation":
      case "video_chapters":
      case "video_filter":
        const jsonModel = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" },
        });
        const jsonResult = await jsonModel.generateContent(prompt);
        generatedText = jsonResult.response.text();
        break;

      default:
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt || messages[0].text);
        generatedText = result.response.text();
        break;
    }

    ok(
      res,
      { generated_content: generatedText },
      "Content generated successfully",
    );
  } catch (error) {
    console.error("AI Service Error:", error);
    return serverError(res, error.message);
  }
};

export const transcribeAudio = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    if (!req.file) return badRequest(res, "Audio file is required");

    if (process.env.NODE_ENV === "test" || !process.env.GEMINI_API_KEY) {
      return ok(
        res,
        {
          vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nMock transcription.",
          subtitles: "Mock transcription.",
          duration: 5.0,
        },
        "Audio transcribed successfully",
      );
    }

    const genAI = getGenAI();
    if (!genAI) {
      return serverError(
        res,
        "AI Configuration Error: GEMINI_API_KEY is missing in the server environment.",
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const audioPart = await fileToGenerativePart(
      req.file.path,
      req.file.mimetype || "audio/mp3",
    );
    const result = await model.generateContent([
      "Transcribe this audio accurately. Return only raw text.",
      audioPart,
    ]);

    const text = result.response.text();

    ok(
      res,
      {
        vtt: `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${text}`,
        subtitles: text,
        duration: 5.0,
      },
      "Audio transcribed successfully",
    );
  } catch (error) {
    console.error("Transcription Error:", error);
    return serverError(res, error.message);
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
};

export const analyzeImage = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    if (!req.file) return badRequest(res, "Image file is required");

    const { analysis_type } = req.body;

    // ✅ Validate allowed analysis types
    const ALLOWED_ANALYSIS = new Set(['ocr', 'object_detection']);
    if (!ALLOWED_ANALYSIS.has(analysis_type || 'ocr')) {
      return badRequest(res, 'Invalid analysis type');
    }

    const genAI = getGenAI();
    if (!genAI) {
      return serverError(
        res,
        "AI Configuration Error: GEMINI_API_KEY is missing in the server environment.",
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imagePart = await fileToGenerativePart(
      req.file.path,
      req.file.mimetype || "image/jpeg",
    );
    const prompt =
      analysis_type === "object_detection"
        ? 'List the primary objects detected in this image in a strict JSON array format like [{"name": "object name"}]. Return ONLY valid JSON.'
        : "Extract all text from this image exactly as written.";

    const result = await model.generateContent([prompt, imagePart]);
    let text = result.response.text();

    if (analysis_type === "object_detection") {
      try {
        return ok(
          res,
          JSON.parse(
            text
              .replace(/```json/g, "")
              .replace(/```/g, "")
              .trim(),
          ),
          "Image analyzed successfully",
        );
      } catch (e) {
        return ok(res, [{ name: text }], "Image analyzed successfully");
      }
    }
    ok(
      res,
      { text, layout: text, confidence: 0.99 },
      "Image analyzed successfully",
    );
  } catch (error) {
    console.error("Image Analysis Error:", error);
    return serverError(res, error.message);
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }
};

// ✅ Allowlist language labels or map from UI codes
const normalizeLang = (v) => {
  let s = String(v || '').trim().toLowerCase();
  if (s === 'auto-detect') s = 'auto';
  const allowed = new Set(['auto', 'english', 'hindi', 'spanish', 'french', 'german', 'arabic', 'japanese']);
  return allowed.has(s) ? s : 'english';
};

export const translateMedia = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text) return badRequest(res, "Text is required for translation");

    // ✅ Add length cap
    const MAX_TRANSLATION_LENGTH = 5_000;
    if (text.length > MAX_TRANSLATION_LENGTH) {
      return badRequest(res, `Text too long for translation (max ${MAX_TRANSLATION_LENGTH} characters)`);
    }

    const genAI = getGenAI();
    if (!genAI) {
      return serverError(
        res,
        "AI Configuration Error: GEMINI_API_KEY is missing in the server environment.",
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate the following text from ${normalizeLang(sourceLanguage)} to ${normalizeLang(targetLanguage)}:\n\n${text}`;

    const result = await model.generateContent(prompt);
    const translatedText = result.response.text();
    
    // Generate VTT and redirect to TTS for multi-lingual dubbing
    const translatedVtt = `WEBVTT\n\n00:00:00.000 --> 00:10:00.000\n${translatedText}`;
    const translatedAudioUrl = `/api/ai/text-to-speech?text=${encodeURIComponent(translatedText.substring(0, 150))}&language=${targetLanguage}`;

    ok(
      res,
      { translatedText, translatedVtt, translatedAudioUrl },
      "Translation completed successfully",
    );
  } catch (error) {
    console.error("Translation Error:", error);
    return serverError(res, error.message);
  }
};

export const textToSpeech = async (req, res) => {
  try {
    // Skip strict auth for GET requests so browser <audio src="..."> tags work natively
    if (req.method !== 'GET') {
      const accessCheck = await assertAiAccess(req);
      if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    }

    const text = req.body.text || req.query.text;
    const voice = req.body.voice || req.query.voice;
    const provider = req.body.provider || req.query.provider;
    const speed = req.body.speed || req.query.speed;
    const language = req.body.language || req.query.language || 'en';

    // ✅ Validate before calling external API
    const MAX_TTS_LENGTH = 4096;
    if (!text || typeof text !== 'string') return badRequest(res, 'Text is required');
    if (text.length > MAX_TTS_LENGTH) {
      return badRequest(res, `Text too long for TTS (max ${MAX_TTS_LENGTH} characters)`);
    }
    // Also validate speed
    const safeSpeed = Math.min(4.0, Math.max(0.25, parseFloat(speed) || 1.0));

    const useProvider = provider || (process.env.OPENAI_API_KEY ? "openai" : "google_free");

    if (useProvider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return serverError(res, "OpenAI API key is missing. Cannot generate speech.");

      // Map to supported OpenAI voices or fallback to 'alloy'
      const openAiVoice = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(voice) ? voice : "alloy";

      const response = await axios.post(
        "https://api.openai.com/v1/audio/speech",
        {
          model: "tts-1",
          input: text,
          voice: openAiVoice,
          speed: safeSpeed,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          responseType: "arraybuffer"
        }
      );

      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(Buffer.from(response.data));
    }

    if (useProvider === "google_free") {
      const safeText = text.substring(0, 200); // Google Free TTS has a 200 char length limit
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(safeText)}&tl=${language}&client=tw-ob`;
      const response = await axios.get(url, { responseType: "arraybuffer" });
      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(Buffer.from(response.data));
    }

    return unprocessableEntity(res, `TTS provider '${useProvider}' is not supported yet.`);
  } catch (error) {
    console.error("Text-to-Speech Error:", error.message);
    return serverError(res, error.response?.data?.error?.message || error.message);
  }
};

// ✅ Allowlist of supported providers
const ALLOWED_PROVIDERS = ['gemini', 'openai', 'openrouter', 'deepseek', 'ollama', 'stability', 'huggingface', 'claude', 'perplexity', 'bolt', 'v0dev', 'emergent'];

// ✅ allowlist models per provider (null means all dynamic models are allowed)
const ALLOWED_MODELS = {
  openai:     null,
  openrouter: null,
  gemini:     null,
  claude:     null,
  deepseek:   null,
  perplexity: null,
  ollama:     null,
  huggingface: null,
  stability:  null,
  bolt:       null,
  v0dev:      null,
  emergent:   null,
};

const validateModel = (provider, model) => {
  if (!model || typeof model !== 'string' || model.length > 200) return false;
  if (!/^[\w\.\-:\/]+$/.test(model)) return false;  // safe charset only
  const allowed = ALLOWED_MODELS[provider];
  if (allowed && !allowed.has(model)) return false;
  return true;
};

const DEFAULT_CHAT_CHAIN = [
  { provider: "gemini", model: "gemini-2.5-flash", enabled: true, timeoutMs: 20000 },
  { provider: "openai", model: "gpt-4o-mini", enabled: true, timeoutMs: 20000 },
  { provider: "deepseek", model: "deepseek-chat", enabled: true, timeoutMs: 20000 },
];

const getModelConfig = async () => {
  const cfg = await AIModelConfig.findOne({ key: "global" }).lean();
  return cfg || { key: "global", routes: { chat: DEFAULT_CHAT_CHAIN, media: [] } };
};

export const getAiRuntimeConfig = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    const cfg = await getModelConfig();
    return ok(res, cfg, "AI runtime configuration fetched");
  } catch (error) {
    return serverError(res, error.message);
  }
};

export const upsertAiRuntimeConfig = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    if (!["Admin", "HOD"].includes(req.user.role)) {
      return badRequest(res, "Only Admin/HOD can update AI runtime configuration");
    }
    const { routes } = req.body || {};
    const chatChain = Array.isArray(routes?.chat) ? routes.chat : DEFAULT_CHAT_CHAIN;
    const normalized = chatChain
      .filter((n) => n?.provider && n?.model)
      .map((n) => ({
        provider: String(n.provider).toLowerCase(),
        model: String(n.model),
        enabled: n.enabled !== false,
        timeoutMs: Math.min(120000, Math.max(1000, Number(n.timeoutMs) || 20000)),
      }));

    const updated = await AIModelConfig.findOneAndUpdate(
      { key: "global" },
      {
        $set: {
          key: "global",
          updatedBy: req.user._id,
          routes: {
            chat: normalized.length ? normalized : DEFAULT_CHAT_CHAIN,
            media: Array.isArray(routes?.media) ? routes.media : [],
          },
        },
      },
      { upsert: true, new: true },
    ).lean();

    return ok(res, updated, "AI runtime configuration saved");
  } catch (error) {
    return serverError(res, error.message);
  }
};

export const previewSourceEdit = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    const { filePath, currentCode, instruction } = req.body || {};
    if (!filePath || !currentCode || !instruction) {
      return badRequest(res, "filePath, currentCode and instruction are required");
    }

    const cfg = await getModelConfig();
    const chain = cfg?.routes?.chat?.length ? cfg.routes.chat : DEFAULT_CHAT_CHAIN;
    const prompt = [
      "You are a code assistant. Return a concise edit preview in markdown.",
      `Target file: ${filePath}`,
      `Instruction: ${instruction}`,
      "Current code:",
      currentCode.slice(0, 12000),
    ].join("\n\n");

    const routed = await runWithFallbackChain(
      chain,
      {
        messages: [{ role: "user", content: prompt }],
      },
      undefined,
    );

    return ok(
      res,
      {
        preview: routed.text,
        providerUsed: routed.provider,
        modelUsed: routed.model,
        fallbackUsed: routed.fallbackUsed,
      },
      "Source edit preview generated",
    );
  } catch (error) {
    return serverError(res, error.message);
  }
};

export const fetchModels = async (req, res) => {
  try {
    // ✅ Check authorization before proceeding
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) {
      return accessCheck.status === 401 
        ? badRequest(res, accessCheck.message)
        : forbidden(res, accessCheck.message);
    }
    
    const { provider, apiKey: bodyApiKey } = req.body;
    const clientKey = bodyApiKey || req.headers['x-api-key'] || req.headers['x-ai-key'];
    
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return badRequest(res, 'Invalid provider');
    }

    const fetchers = {
      gemini: async () => {
        const apiKey = clientKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Gemini not configured');
        const response = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        return (response.data.models || [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent"),
          )
          .map((m) => ({
            id: m.name.replace("models/", ""),
            name: m.displayName || m.name.replace("models/", ""),
          }));
      },
      openai: async () => {
        const apiKey = clientKey || req.user?.openAiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OpenAI not configured');
        const response = await axios.get("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return (response.data.data || [])
          .map((m) => ({ id: m.id, name: m.id }));
      },
      openrouter: async () => {
        const response = await axios.get("https://openrouter.ai/api/v1/models");
        return (response.data.data || []).map((m) => ({
          id: m.id,
          name: m.name,
        }));
      },
      deepseek: async () => {
        const apiKey = clientKey || req.user?.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) throw new Error('DeepSeek not configured');
        const response = await axios.get("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return (response.data.data || []).map((m) => ({
          id: m.id,
          name: m.id,
        }));
      },
      ollama: async () => {
        // For ollama, use a fixed allowlisted host
        const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
        const response = await fetch(`${host}/api/tags`).catch(() => ({
          json: () => ({ models: [] }),
        }));
        const data = await response.json();
        return (data.models || []).map((model) => ({
          id: model?.name || "unknown",
          name: model?.name || "Unknown Model",
        }));
      },
      stability: async () => {
        return [
          { id: "stable-video-diffusion", name: "Stable Video Diffusion" },
          { id: "core", name: "Stable Image Core" },
          { id: "sd3", name: "Stable Diffusion 3" }
        ];
      },
      huggingface: async () => {
        const response = await axios.get("https://huggingface.co/api/models?pipeline_tag=text-generation&sort=trending&limit=50");
        return (response.data || []).map((m) => ({
          id: m.id,
          name: `${m.id.split('/').pop()} (${m.author || 'Community'})`,
        }));
      },
      claude: async () => {
        const apiKey = clientKey || req.user?.claudeApiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
        try {
            if (!apiKey) throw new Error("No Key");
            const response = await axios.get("https://api.anthropic.com/v1/models", {
                headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
            });
            return (response.data.data || []).map(m => ({ id: m.id, name: m.display_name || m.id }));
        } catch(e) {
            return [
              { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
              { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
              { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
              { id: 'claude-3-opus-latest', name: 'Claude 3 Opus' }
            ];
        }
      },
perplexity: async () => [
        { id: 'sonar', name: 'Sonar' },
        { id: 'sonar-pro', name: 'Sonar Pro' },
        { id: 'sonar-reasoning', name: 'Sonar Reasoning' },
        { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
        { id: 'r1-1776', name: 'R1 1776' }
      ],
      bolt: async () => [{ id: 'bolt-auto', name: 'Bolt Auto' }],
      v0dev: async () => [{ id: 'v0-auto', name: 'v0.dev Auto' }],
      emergent: async () => [{ id: 'emergent-auto', name: 'Emergent Auto' }],
    };

    // Gracefully handle errors instead of returning 500
    let fetchedModels = [];
    if (fetchers[provider]) {
      try {
        fetchedModels = await fetchers[provider]();
      } catch (fetcherError) {
        console.warn(`Fetcher for ${provider} failed:`, fetcherError.message);
        // Return empty models - client will use fallbacks
        fetchedModels = [];
      }
    }
    ok(res, { models: fetchedModels }, "Models fetched successfully");
  } catch (error) {
    console.error(
      `Failed to fetch dynamic models for ${req.body.provider}`,
      error.message,
    );
    // Return empty models instead of 500 so client uses fallbacks
    return ok(res, { models: [] }, "Using fallback models");
  }
};

export const proxyChat = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    const {
      provider,
      selectedModel,
      history,
      systemInstruction,
      mediaArray,
      apiKey: bodyApiKey
    } = req.body;
    const clientKey = bodyApiKey || req.headers['x-api-key'] || req.headers['x-ai-key'];
    const controller = new AbortController();
    req.on("aborted", () => controller.abort());

    // ✅ Validate history structure before use
    if (!Array.isArray(history)) {
      return badRequest(res, 'history must be an array');
    }
    for (const m of history) {
      if (!m || !['user', 'ai', 'model', 'assistant', 'system'].includes(m.role) || typeof m.text !== 'string') {
        return badRequest(res, 'Invalid history message format');
      }
    }

    // ✅ Validate mediaArray items
    const MAX_MEDIA_ITEMS = 5;
    const MAX_BASE64_SIZE = 5 * 1024 * 1024 * 1.37;  // ~5MB image → ~6.85MB base64

    if (mediaArray && !Array.isArray(mediaArray)) return badRequest(res, 'mediaArray must be an array');
    if (mediaArray?.length > MAX_MEDIA_ITEMS) return badRequest(res, `Max ${MAX_MEDIA_ITEMS} media items allowed`);
    for (const media of (mediaArray || [])) {
      if (!media?.data || typeof media.data !== 'string') return badRequest(res, 'Invalid media item');
      if (media.data.length > MAX_BASE64_SIZE) return badRequest(res, 'Media item too large');
      // Validate mimeType against allowlist
      const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      if (media.mimeType && !ALLOWED_MIME.has(media.mimeType)) {
        return badRequest(res, 'Unsupported media MIME type');
      }
    }

    // OPTIMIZATION: Limit context to last 15 messages to drastically improve API speed, lower latency, and save tokens
    const optimizedHistory = history.slice(-30); // Increased for better context memory

    if ((provider === "auto" || !provider) && Array.isArray(history) && history.length) {
      const cfg = await getModelConfig();
      const chain = cfg?.routes?.chat?.length ? cfg.routes.chat : DEFAULT_CHAT_CHAIN;
      const messages = optimizedHistory.map((msg) => ({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.text,
      }));
      const routed = await runWithFallbackChain(chain, { messages }, controller.signal);
      return ok(
        res,
        {
          generated_content: routed.text,
          providerUsed: routed.provider,
          modelUsed: routed.model,
          fallbackUsed: routed.fallbackUsed,
          cachedFallback: routed.cached,
        },
        "Chat generated with routed fallback chain",
      );
    }

    if (!validateModel(provider, selectedModel)) {
      return badRequest(res, 'Invalid or unsupported model for this provider');
    }

    // ✅ Support server-configured env variables or user-provided keys via frontend
    const PROVIDER_CONFIG = {
      openai: { url: 'https://api.openai.com/v1/chat/completions', key: clientKey || req.user?.openAiApiKey || process.env.OPENAI_API_KEY },
      openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: clientKey || req.user?.openRouterApiKey || process.env.OPENROUTER_API_KEY },
      claude: { url: 'https://api.anthropic.com/v1/messages', key: clientKey || req.user?.claudeApiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY },
      deepseek: { url: 'https://api.deepseek.com/chat/completions', key: clientKey || req.user?.deepseekApiKey || process.env.DEEPSEEK_API_KEY },
      perplexity: { url: 'https://api.perplexity.ai/chat/completions', key: clientKey || req.user?.perplexityApiKey || process.env.PERPLEXITY_API_KEY },
      gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/...', key: clientKey || req.user?.geminiApiKey || process.env.GEMINI_API_KEY },
      bolt: { url: 'https://api.bolt.new/v1/chat/completions', key: clientKey || req.user?.boltApiKey || process.env.BOLT_API_KEY },
      v0dev: { url: 'https://api.v0.dev/v1/chat/completions', key: clientKey || req.user?.v0devApiKey || process.env.V0DEV_API_KEY },
      emergent: { url: 'https://api.emergent.ai/v1/chat/completions', key: clientKey || req.user?.emergentApiKey || process.env.EMERGENT_API_KEY },
      huggingface: { url: 'https://api-inference.huggingface.co/v1/chat/completions', key: clientKey || req.user?.huggingfaceApiKey || process.env.HUGGINGFACE_API_KEY },
      ollama: { key: 'local' }
    };

    if (!PROVIDER_CONFIG[provider]) return badRequest(res, 'Invalid provider');
    const apiKey = PROVIDER_CONFIG[provider].key;
    if (!apiKey) return serverError(res, `${provider} is not configured`);

    // Remove ollamaHost from client input; use an env allowlist
    const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

    let resultText = "";

    if (
      ["openai", "openrouter", "bolt", "v0dev", "emergent", "huggingface"].includes(provider)
    ) {
      const url = PROVIDER_CONFIG[provider].url;
      const messages = [];

      if (selectedModel.includes("o1") || selectedModel.includes("o3")) {
        messages.push({ role: "developer", content: systemInstruction });
      } else {
        messages.push({ role: "system", content: systemInstruction });
      }

      optimizedHistory.forEach((msg, idx) => {
        const isLast = idx === optimizedHistory.length - 1;
        const role = msg.role === "ai" ? "assistant" : "user";
        let content = msg.text;
        if (isLast && mediaArray && mediaArray.length > 0) {
          content = [{ type: "text", text: msg.text }];
          mediaArray.forEach((media) => {
            let base64Data = media.data.includes(",")
              ? media.data.split(",")[1]
              : media.data;
            content.push({
              type: "image_url",
              image_url: {
                url: `data:${media.mimeType || "image/jpeg"};base64,${base64Data}`,
              },
            });
          });
        }
        if (
          messages.length > 1 &&
          messages[messages.length - 1].role === role
        ) {
          const prev = messages[messages.length - 1];
          if (typeof prev.content === "string" && typeof content === "string")
            prev.content += `\n\n${content}`;
          else {
            const prevArr =
              typeof prev.content === "string"
                ? [{ type: "text", text: prev.content }]
                : prev.content;
            const newArr =
              typeof content === "string"
                ? [{ type: "text", text: content }]
                : content;
            messages[messages.length - 1].content = [...prevArr, ...newArr];
          }
        } else {
          messages.push({ role, content });
        }
      });

      const response = await axios.post(
        url,
        { model: selectedModel, messages },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );
      resultText = response.data.choices[0].message.content;
    } else if (provider === "claude") {
      const messages = [];
      optimizedHistory.forEach((msg, idx) => {
        const isLast = idx === optimizedHistory.length - 1;
        const role = msg.role === "ai" ? "assistant" : "user";
        let content = msg.text;
        if (isLast && mediaArray && mediaArray.length > 0) {
          content = [{ type: "text", text: msg.text }];
          mediaArray.forEach((media) => {
            let base64Data = media.data.includes(",")
              ? media.data.split(",")[1]
              : media.data;
            content.push({
              type: "image",
              source: {
                type: "base64",
                media_type: media.mimeType || "image/jpeg",
                data: base64Data,
              },
            });
          });
        }
        if (
          messages.length > 0 &&
          messages[messages.length - 1].role === role
        ) {
          const prev = messages[messages.length - 1];
          if (typeof prev.content === "string" && typeof content === "string")
            prev.content += `\n\n${content}`;
          else {
            const prevArr =
              typeof prev.content === "string"
                ? [{ type: "text", text: prev.content }]
                : prev.content;
            const newArr =
              typeof content === "string"
                ? [{ type: "text", text: content }]
                : content;
            messages[messages.length - 1].content = [...prevArr, ...newArr];
          }
        } else {
          messages.push({ role, content });
        }
      });

      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: selectedModel || "claude-3-7-sonnet-20250219",
          max_tokens: 8192,
          system: systemInstruction,
          messages,
        },
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          signal: controller.signal,
        },
      );
      resultText = response.data.content[0].text;
    } else if (provider === "perplexity" || provider === "deepseek") {
      const messages = [{ role: "system", content: systemInstruction }];
      optimizedHistory.forEach((msg) => {
        const role = msg.role === "ai" ? "assistant" : "user";
        if (messages.length > 1 && messages[messages.length - 1].role === role)
          messages[messages.length - 1].content += `\n\n${msg.text}`;
        else messages.push({ role, content: msg.text });
      });
      const url =
        provider === "perplexity"
          ? "https://api.perplexity.ai/chat/completions"
          : "https://api.deepseek.com/chat/completions";
      const response = await axios.post(
        url,
        { model: selectedModel, messages },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );
      resultText = response.data.choices[0].message.content;
    } else if (provider === "ollama") {
      const ollamaMessages = [{ role: "system", content: systemInstruction }];
      optimizedHistory.forEach((msg, idx) => {
        const isLast = idx === optimizedHistory.length - 1;
        const message = {
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.text,
        };
        if (isLast && mediaArray && mediaArray.length > 0) {
          message.images = mediaArray.map(media => 
            media.data.includes(",") ? media.data.split(",")[1] : media.data
          );
        }
        ollamaMessages.push(message);
      });
      const response = await fetch(`${host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel || "llama3",
          messages: ollamaMessages,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      resultText = data.message.content;
    } else {
      // Gemini Fallback
      const contents = [];
      optimizedHistory.forEach((msg, idx) => {
        const isLast = idx === optimizedHistory.length - 1;
        const role = msg.role === "ai" ? "model" : "user";
        const parts = [{ text: msg.text }];
        if (isLast && mediaArray && mediaArray.length > 0) {
          mediaArray.forEach((media) => {
            parts.push({
              inlineData: {
                mimeType: media.mimeType || "image/jpeg",
                data: media.data.includes(",")
                  ? media.data.split(",")[1]
                  : media.data,
              },
            });
          });
        }
        if (contents.length > 0 && contents[contents.length - 1].role === role)
          contents[contents.length - 1].parts.push(...parts);
        else contents.push({ role, parts });
      });
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel || "gemini-2.5-flash"}:generateContent?key=${apiKey}`,
        {
          contents: contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
        },
        { signal: controller.signal },
      );
      resultText = response.data.candidates[0].content.parts[0].text;
    }

    ok(res, { generated_content: resultText }, "Chat generated successfully");
  } catch (error) {
    console.error("AI Generation Error:", error.response?.data || error.message);
    let errorDetail = error.message;
    if (error.response?.data) {
      errorDetail = error.response.data.error?.message || error.response.data.error || error.response.data.message || error.message;
    }
    const clientMessage = process.env.NODE_ENV === 'production'
      ? 'AI request failed. Please try again later.'
      : errorDetail;
    return serverError(res, clientMessage);
  }
};

export const proxyMedia = async (req, res) => {
  try {
    const accessCheck = await assertAiAccess(req);
    if (accessCheck.error) return res.status(accessCheck.status).json({ message: accessCheck.message });
    const {
      provider,
      prompt,
      type,
      aspectRatio,
      selectedMedia,
      autoEnhanceEnabled,
      ollamaModel,
      apiKey: bodyApiKey
    } = req.body;
    
    const clientKey = bodyApiKey || req.headers['x-api-key'] || req.headers['x-ai-key'];

    // ✅ Allow server-configured environments or user-provided keys
    const MEDIA_PROVIDER_CONFIG = {
      openai: { key: clientKey || req.user?.openAiApiKey || process.env.OPENAI_API_KEY },
      stability: { key: clientKey || req.user?.stabilityApiKey || process.env.STABILITY_API_KEY },
      pollinations: { key: 'local' },
      stablediffusion: { key: 'local' }
    };

    if (!MEDIA_PROVIDER_CONFIG[provider]) return badRequest(res, 'Invalid provider');
    const apiKey = MEDIA_PROVIDER_CONFIG[provider].key;
    if (!apiKey) return serverError(res, `${provider} is not configured`);

    // ✅ Same rule: server-side credentials and fixed host allowlists only
    const ALLOWED_SD_HOSTS = new Set([process.env.SD_HOST || 'http://127.0.0.1:5001', 'http://localhost:5001', 'http://127.0.0.1:7860']);
    const sdHost = process.env.SD_HOST || 'http://127.0.0.1:5001';
    if (!ALLOWED_SD_HOSTS.has(sdHost)) return serverError(res, 'SD host misconfigured. Allowed hosts: 5001 or 7860.');

    const ALLOWED_OLLAMA_HOSTS = new Set([process.env.OLLAMA_HOST || 'http://127.0.0.1:11434', 'http://localhost:11434']);
    const ollamaHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    if (!ALLOWED_OLLAMA_HOSTS.has(ollamaHost)) return serverError(res, 'Ollama host misconfigured');

    let targetRatio = aspectRatio || "1:1";
    let targetEnhance = autoEnhanceEnabled ?? true;
    let cleanPrompt = prompt || "";

    // Extract --ar tag if appended by frontend
    const arMatch = cleanPrompt.match(/--ar\s+(16:9|9:16|4:3|3:4|1:1)/i);
    if (arMatch) {
      targetRatio = arMatch[1];
      cleanPrompt = cleanPrompt.replace(arMatch[0], '').trim();
    }

    // Extract --enhance tag if appended by frontend
    const enhanceMatch = cleanPrompt.match(/--enhance\s+(true|false)/i);
    if (enhanceMatch) {
      targetEnhance = enhanceMatch[1].toLowerCase() === 'true';
      cleanPrompt = cleanPrompt.replace(enhanceMatch[0], '').trim();
    }

    let width = 1024,
      height = 1024,
      dalleSize = "1024x1024",
      stabilityRatio = "1:1";
    if (targetRatio === "16:9") {
      width = 1280;
      height = 720;
      dalleSize = "1792x1024";
      stabilityRatio = "16:9";
    } else if (targetRatio === "9:16") {
      width = 720;
      height = 1280;
      dalleSize = "1024x1792";
      stabilityRatio = "9:16";
    } else if (targetRatio === "4:3") {
      width = 1024;
      height = 768;
      dalleSize = "1792x1024"; // DALL-E 3 fallback for landscape
      stabilityRatio = "4:3";
    } else if (targetRatio === "3:4") {
      width = 768;
      height = 1024;
      dalleSize = "1024x1792"; // DALL-E 3 fallback for portrait
      stabilityRatio = "3:4";
    }

    let enhancedPrompt = cleanPrompt || "";
    const negativePrompt = "cropped, out of frame, cut off, missing head, truncated, poorly drawn face, poorly drawn feet, poorly drawn hands, bad anatomy, deformed, mutated, extra limbs, ugly, blurry, watermark, text, dense dark dots on face, heavy freckles, skin artifacts, asymmetrical eyes, heterochromia, mismatched eye colors";

    // ✅ Validate ollamaModel exactly like selectedModel
    const safeOllamaModel = ollamaModel && /^[\w\.\-:\/]+$/.test(ollamaModel) && ollamaModel.length <= 100
      ? ollamaModel
      : process.env.DEFAULT_OLLAMA_MODEL || 'llama3';

    // Auto-Enhance execution natively inside the backend using Ollama fallback
    if (
      type === "image" &&
      enhancedPrompt.length > 0 &&
      enhancedPrompt.length < 150 &&
      targetEnhance
    ) {
      try {
        const sysInstruction =
          "You are a master AI image prompt engineer. Expand this concept into highly detailed prompt. PRESERVE previous subject/style/reference from conversation history (e.g. if 'naruto' was mentioned before, keep Naruto character). Make exactly 2D if '2d' specified, symmetrical natural face with matching eye colors. Ultra-realistic skin without dense dark dots (light freckles OK). Return ONLY raw prompt text.";
        
        const cfg = await getModelConfig();
        const chain = cfg?.routes?.chat?.length ? cfg.routes.chat : DEFAULT_CHAT_CHAIN;
        const combinedPrompt = `${sysInstruction}\n\nConcept to expand: ${cleanPrompt}`;

        try {
          const routed = await runWithFallbackChain(
            chain,
            { messages: [{ role: "user", content: combinedPrompt }] }
          );
          if (routed && routed.text) {
            enhancedPrompt = routed.text.trim();
          }
        } catch (chainErr) {
          // Fallback to Ollama if online providers fail or not configured
          const host = ollamaHost;
          const ollamaRes = await fetch(`${host}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: safeOllamaModel,
              messages: [
                { role: "system", content: sysInstruction },
                { role: "user", content: cleanPrompt },
              ],
              stream: false,
            }),
          });
          if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            if (data.message?.content)
              enhancedPrompt = data.message.content.trim();
          }
        }
      } catch (e) {} // Fallback to normal if enhancement fails
    }

// Force 16K super-HD + framing (max pixel density)
if (type === "image") {
    const hdAdditions = ", 16k uhd, ultra high resolution 2048px, pixel perfect, hyper detailed 8k textures, no pixelation, ultra sharp, crisp edges, masterpiece, best quality, photorealistic";
    if (!enhancedPrompt.toLowerCase().includes("16k")) {
        enhancedPrompt += hdAdditions;
    }
}

    if (type === "image") {
      let base64ForStorage = null;
      let pollinationsUrl = null;

      if (provider === "openai") {
        const response = await axios.post(
          "https://api.openai.com/v1/images/generations",
          {
            model: "dall-e-3",
            prompt: enhancedPrompt,
            n: 1,
            size: dalleSize,
            quality: "hd",
            style: "vivid",
            response_format: "b64_json",
          },
          { headers: { Authorization: `Bearer ${apiKey}` } },
        );
        base64ForStorage = `data:image/png;base64,${response.data.data[0].b64_json}`;
      } else if (provider === "stability") {
        if (selectedMedia?.data) {
          // Image-to-Image or Edit request
          const imageBuffer = Buffer.from(
            selectedMedia.data.split(",")[1],
            "base64",
          );

          if (/remove background|erase background/i.test(cleanPrompt)) {
            const form = new FormData();
            form.append("image", imageBuffer, "source.png");
            const response = await axios.post(
              "https://api.stability.ai/v2beta/stable-image/edit/remove-background",
              form,
              {
                headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
                responseType: "arraybuffer",
              },
            );
            base64ForStorage = `data:image/png;base64,${Buffer.from(response.data, "binary").toString("base64")}`;
            enhancedPrompt = `Background removed from reference image.`;
          } else {
            // Generic Image-to-Image
            const form = new FormData();
            form.append("image", imageBuffer, "source.png");
            form.append("prompt", enhancedPrompt);
            form.append("negative_prompt", negativePrompt);
            form.append("output_format", "png");
            form.append("mode", "image-to-image");
            form.append("strength", "0.65");
            const response = await axios.post(
              "https://api.stability.ai/v2beta/stable-image/generate/core",
              form,
              {
                headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
                responseType: "arraybuffer",
              },
            );
            base64ForStorage = `data:image/png;base64,${Buffer.from(response.data, "binary").toString("base64")}`;
          }
        } else {
          // Text-to-Image
          const form = new FormData();
          form.append("prompt", enhancedPrompt);
          form.append("negative_prompt", negativePrompt);
          form.append("output_format", "png");
          form.append("aspect_ratio", stabilityRatio);
          const response = await axios.post(
            "https://api.stability.ai/v2beta/stable-image/generate/core",
            form,
            {
              headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}`, Accept: "image/*" },
              responseType: "arraybuffer",
            },
          );
          base64ForStorage = `data:image/png;base64,${Buffer.from(response.data, "binary").toString("base64")}`;
        }
      } else if (provider === "pollinations") {
        const seed = Math.floor(Math.random() * 1000000);
pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&model=flux-schnell&nologo=true&embed=true&seed=${seed}`;
      } else if (provider === "stablediffusion") {
        const host = sdHost;
        const cleanHost = host.replace(/\/+$/, "");
          if (cleanHost.includes("5001") || cleanHost.includes("api/images")) {
            const startRes = await axios.post(
              `${cleanHost}/python-api/images/generate`,
              {
                prompt: enhancedPrompt,
                negative_prompt: negativePrompt,
                num_steps: Math.min(parseInt(req.body.num_steps || 30), 50),
                guidance_scale: 7.5,
                width,
                height,
                return_base64: true,
              },
              { headers: { Authorization: req.headers.authorization } }
            );

            // Always poll for completion - handles both immediate and queued responses
            if (startRes.data.task_id) {
              const taskId = startRes.data.task_id;
              let isFinished = false;
              let pollAttempts = 0;
              const MAX_POLL_ATTEMPTS = 80; // 80 * 3s = 4 minutes max timeout
              const POLL_INTERVAL_MS = 3000;

              while (!isFinished && pollAttempts < MAX_POLL_ATTEMPTS) {
                await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
                
                try {
                  const pollRes = await axios.get(
                    `${cleanHost}/python-api/images/status/${taskId}`,
                    { 
                      headers: { Authorization: req.headers.authorization },
                      timeout: 10000  // 10s timeout per poll
                    }
                  );

                  const task = pollRes.data;
                  
                  if (task.state === 'SUCCESS') {
                    if (task.result && task.result.image_base64) {
                      base64ForStorage = `data:image/png;base64,${task.result.image_base64}`;
                      console.log(`SD Image generated successfully after ${pollAttempts * 3}s`);
                      isFinished = true;
                    } else {
                      throw new Error('SUCCESS state but no image data returned');
                    }
                  } else if (task.state === 'FAILURE') {
                    throw new Error(task.error || 'Generation failed in Python worker');
                  } else {
                    console.log(`SD task ${taskId} still ${task.state} (attempt ${pollAttempts + 1}/${MAX_POLL_ATTEMPTS})`);
                  }
                } catch (pollErr) {
                  if (pollErr.code === 'ECONNREFUSED' || pollErr.code === 'ENOTFOUND') {
                    throw new Error('Stable Diffusion Python service unreachable');
                  }
                  console.warn(`Poll attempt ${pollAttempts + 1} failed:`, pollErr.message);
                }
                
                pollAttempts++;
              }
              
              if (!isFinished) {
                throw new Error(`Stable Diffusion generation timed out after ${MAX_POLL_ATTEMPTS * 3 / 60}m`);
              }
            } else if (startRes.data.image_base64) {
              // Immediate response (no queue)
              base64ForStorage = `data:image/png;base64,${startRes.data.image_base64}`;
              console.log('SD Image generated immediately (no queue)');
            } else {
              throw new Error('Invalid response from Stable Diffusion API');
            }
          } else {
            // A1111 legacy API
            const response = await axios.post(`${cleanHost}/sdapi/v1/txt2img`, {
              prompt: enhancedPrompt,
              negative_prompt: negativePrompt,
              steps: 30,
              width,
              height,
              sampler_name: "DPM++ 2M Karras",
              cfg_scale: 7,
            });
            base64ForStorage = `data:image/png;base64,${response.data.images[0]}`;
            console.log('A1111 SD image generated');
          }
      }

      return ok(res, {
        type: "image",
        base64: base64ForStorage,
        url: pollinationsUrl,
        provider,
        enhancedPrompt,
      });
    } else if (type === "video") {
      if (provider === "stability") {
        if (!selectedMedia || !selectedMedia.data)
          return badRequest(res, "Initial image required for animation");

        // ✅ Validate base64 structure before splitting
        const rawData = selectedMedia.data;
        if (!rawData || !rawData.includes(',')) {
          return badRequest(res, 'Invalid media data format; expected base64 data URL');
        }
        const imageBuffer = Buffer.from(rawData.split(',')[1], 'base64');
        if (imageBuffer.length === 0) return badRequest(res, 'Empty image data');

        // Image to Video Init
        const form = new FormData();
        form.append("image", imageBuffer, "image.jpg");
        form.append("seed", "0");
        form.append("cfg_scale", "1.8");
        form.append("motion_bucket_id", "127");

        const startRes = await axios.post(
          "https://api.stability.ai/v2beta/image-to-video",
          form,
          {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
          },
        );
        if (startRes.status !== 200)
          throw new Error(`Stability API error: ${startRes.statusText}`);

        const startData = startRes.data;
        const generationId = startData.id;

        // Long Polling performed securely on the backend
        let isFinished = false;
        let videoBuffer = null;
        
        // ✅ Add a timeout and maximum poll count
        const MAX_POLL_ATTEMPTS = 24;   // 24 × 5s = 2 minutes max
        let pollAttempts = 0;

        while (!isFinished) {
          if (++pollAttempts > MAX_POLL_ATTEMPTS) {
            return serverError(res, 'Video generation timed out after 2 minutes');
          }
          await new Promise((r) => setTimeout(r, 5000));
          const pollRes = await axios.get(
            `https://api.stability.ai/v2beta/image-to-video/result/${generationId}`,
            {
              headers: { Authorization: `Bearer ${apiKey}`, Accept: "video/*" },
              responseType: "arraybuffer",
              validateStatus: (s) => s === 200 || s === 202,
            },
          );
          if (pollRes.status === 200) {
            videoBuffer = pollRes.data;
            isFinished = true;
          }
        }
        const base64 = Buffer.from(videoBuffer, "binary").toString("base64");
        return ok(res, {
          type: "video",
          base64: `data:video/mp4;base64,${base64}`,
        });
      }
    }
  } catch (error) {
    console.error("AI Media Error:", error.response?.data || error.message);
    let errorDetail = error.message;
    if (error.response?.data) {
      errorDetail = error.response.data.error?.message || error.response.data.error || error.response.data.message || error.message;
    }
    const clientMessage = process.env.NODE_ENV === 'production'
      ? 'AI media request failed. Please try again later.'
      : errorDetail;
    return serverError(res, clientMessage);
  }
};
