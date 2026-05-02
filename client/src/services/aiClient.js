import { apiClient } from "@/services/apiClient";

// SECURITY FIX: Store highly sensitive API keys securely in memory instead of plaintext localStorage
// Note: A page refresh will clear these. For persistent storage, they should be moved entirely to the backend DB.
let inMemoryKeys = {};

export const getAiConfig = () => {
  return {
    provider: localStorage.getItem("aiProvider") || "auto",
    geminiKey: inMemoryKeys.geminiKey || "",
    openAiKey: inMemoryKeys.openAiKey || "",
    claudeKey: inMemoryKeys.claudeKey || "",
    boltKey: inMemoryKeys.boltKey || "",
    v0devKey: inMemoryKeys.v0devKey || "",
    emergentKey: inMemoryKeys.emergentKey || "",
    perplexityKey: inMemoryKeys.perplexityKey || "",
    deepseekKey: inMemoryKeys.deepseekKey || "",
    huggingfaceKey: inMemoryKeys.huggingfaceKey || "",
    openRouterKey: inMemoryKeys.openRouterKey || "",
    stabilityKey: inMemoryKeys.stabilityKey || "",
    sdHost: localStorage.getItem("sdHost") || "http://127.0.0.1:5001",
    ollamaHost: localStorage.getItem("ollamaHost") || "http://localhost:11434",
  };
};

export const setAiConfig = (provider, keys) => {
  localStorage.setItem("aiProvider", provider);
  
  const sensitiveKeys = ['geminiKey', 'openAiKey', 'claudeKey', 'boltKey', 'v0devKey', 'emergentKey', 'perplexityKey', 'deepseekKey', 'huggingfaceKey', 'openRouterKey', 'stabilityKey'];
  
  sensitiveKeys.forEach(k => {
    if (keys[k] !== undefined) inMemoryKeys[k] = keys[k];
  });

  // Local network URLs are safe to store in localStorage
  if (keys.sdHost !== undefined)
    localStorage.setItem("sdHost", keys.sdHost);
  if (keys.ollamaHost !== undefined)
    localStorage.setItem("ollamaHost", keys.ollamaHost);
};

// Retrieve secure keys from the backend on refresh
export const syncAiKeys = async () => {
  if (typeof window !== "undefined" && localStorage.getItem("token")) {
    try {
      const res = await apiClient.get("/auth/profile");
      const user = res.data;
      if (user) {
        setAiConfig(localStorage.getItem("aiProvider") || "gemini", {
          geminiKey: user.geminiApiKey,
          openAiKey: user.openAiApiKey,
          stabilityKey: user.stabilityApiKey,
          claudeKey: user.claudeApiKey,
          deepseekKey: user.deepseekApiKey,
          perplexityKey: user.perplexityApiKey,
          boltKey: user.boltApiKey,
          v0devKey: user.v0devApiKey,
          emergentKey: user.emergentApiKey,
          huggingfaceKey: user.huggingfaceApiKey,
          openRouterKey: user.openRouterApiKey,
        });
      }
    } catch (err) {
      console.warn("Could not sync AI keys:", err.message);
    }
  }
};

export const getAiKey = () => {
  const config = getAiConfig();
  if (config.provider === "auto") return "server-managed";
  const keyMap = {
    openai: config.openAiKey,
    claude: config.claudeKey,
    bolt: config.boltKey,
    v0dev: config.v0devKey,
    emergent: config.emergentKey,
    perplexity: config.perplexityKey,
    deepseek: config.deepseekKey,
    huggingface: config.huggingfaceKey,
    openrouter: config.openRouterKey,
    stability: config.stabilityKey,
    stablediffusion: config.sdHost,
    ollama: config.ollamaHost,
  };
  return keyMap[config.provider] || config.geminiKey;
};

export const FALLBACK_MODELS = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
  ],
  openai: [
    { id: "o3-mini", name: "o3-mini (Reasoning)" },
    { id: "o1", name: "o1 (Reasoning)" },
    { id: "gpt-4o-mini", name: "GPT-4o-mini" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  claude: [
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  ],
  bolt: [
    { id: "bolt-auto", name: "Bolt Auto" },
  ],
  v0dev: [
    { id: "v0-auto", name: "v0.dev Auto" },
  ],
  emergent: [
    { id: "emergent-auto", name: "Emergent Auto" },
  ],
  perplexity: [
    { id: "sonar", name: "Sonar" },
    { id: "sonar-pro", name: "Sonar Pro" },
    { id: "sonar-reasoning", name: "Sonar Reasoning" },
    { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat" },
    { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
  ],
  openrouter: [
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini" },
    { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet" },
  ],
  huggingface: [
    { id: "meta-llama/Meta-Llama-3-8B-Instruct", name: "Llama 3 8B Instruct" },
    { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", name: "Mistral 7B Instruct" }
  ],
  stability: [
    { id: "core", name: "Stable Image Core" },
    { id: "sd3", name: "Stable Diffusion 3" },
  ],
  stablediffusion: [
    { id: "sdxl", name: "Local SDXL / SD 1.5" },
  ],
};

const sortModels = (models) => {
  const getModelScore = (id) => {
    let score = 0;
    const lowerId = id.toLowerCase();

        // 👑 SUPER POPULAR MODELS BOOST
        if (/(gpt-4o|claude-3-7-sonnet|claude-3-5-sonnet|gemini-2\.5-flash|gemini-2\.0-flash|deepseek-chat|sonar-pro)/i.test(lowerId)) score += 100000;
        if (/(gpt-4-turbo|gpt-4|o1|o3-mini|claude-3-opus|gemini-1\.5-pro|deepseek-reasoner|sonar-reasoning)/i.test(lowerId)) score += 80000;
        if (/(gpt-3\.5|claude-3-haiku|gemini-1\.5-flash|llama-3)/i.test(lowerId)) score += 60000;

    // Ultimate Priority: Explicitly free models (OpenRouter mostly)
    if (lowerId.includes(":free")) score += 20000;
    else if (lowerId.includes("free")) score += 10000;

    // High Priority: Fast / Lite / Mini models (usually the free tier of APIs)
    if (/flash|mini|lite|haiku|8b/i.test(lowerId)) score += 5000;

    // Demote Heavy / Pro / Legacy models
    if (/pro|plus|max|opus|70b|405b|reasoner/i.test(lowerId)) score -= 1000;
    if (/legacy|deprecated|vision/i.test(lowerId)) score -= 5000;

        // Demote non-text models (audio, embedding, moderation) so they don't clog top results
        if (/(tts-|whisper|dall-e|embedding|moderation|audio|tts)/i.test(lowerId)) score -= 200000;

    // Version tie-breaker (e.g. 2.5 > 2.0 > 1.5)
    const match = lowerId.match(/(\d+(\.\d+)?)/);
    if (match) {
      score += parseFloat(match[1]) * 10;
    }
    return score;
  };

  return [...models].sort((a, b) => {
    const scoreA = getModelScore(a.id);
    const scoreB = getModelScore(b.id);
    if (scoreA === scoreB) {
      return a.name.localeCompare(b.name);
    }
    return scoreB - scoreA;
  });
};

export const fetchAvailableModels = async (provider, apiKey) => {
  try {
    const res = await apiClient.post("/ai/models", { provider });
    const fetchedModels = res.data?.models || [];
    
    if (fetchedModels.length > 0) {
      return sortModels(fetchedModels);
    }
  } catch (err) {
    console.error(`Failed to fetch dynamic models for ${provider}`, err);
  }
  return FALLBACK_MODELS[provider] || [];
};

export const generateContent = async (
  promptOrHistory,
  systemInstruction = "You are a helpful academic AI assistant for a college platform.",
  mediaArray = [],
  signal = null,
) => {
  const config = getAiConfig();
  const provider = config.provider || "auto";
  const apiKey = getAiKey();
  const selectedModel =
    localStorage.getItem(`${provider}Model`) ||
    FALLBACK_MODELS[provider]?.[0]?.id;

  if (!apiKey) {
    throw new Error(`API Key for ${provider.toUpperCase()} is missing. Please configure it in the AI Hub.`);
  }

  // Convert to array if a single string was passed (backward compatibility for Quiz Generator)
  let history = Array.isArray(promptOrHistory)
    ? [...promptOrHistory]
    : [{ role: "user", text: promptOrHistory }];

  // Most AI models (especially Gemini) require the conversation to start with the user.
  while (history.length > 0 && history[0].role === "ai") {
    history.shift();
  }

  if (history.length === 0) throw new Error("No conversation history to send.");

  try {
    const res = await apiClient.post("/ai/chat", {
      provider,
      selectedModel,
      history,
      systemInstruction,
      mediaArray,
    }, { signal });
    return res.data?.generated_content;
  } catch (error) {
    if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
      throw new Error("AI generation was interrupted.");
    }
    throw new Error(
      error.response?.data?.message || error.message || `Failed to generate response using ${provider}. Check your API key.`
    );
  }
};

export const getRuntimeConfig = async () => {
  const res = await apiClient.get("/ai/runtime-config");
  return res.data;
};

export const updateRuntimeConfig = async (routes) => {
  const res = await apiClient.put("/ai/runtime-config", { routes });
  return res.data;
};

export const previewSourceEdit = async ({ filePath, currentCode, instruction }) => {
  const res = await apiClient.post("/ai/source-edit/preview", {
    filePath,
    currentCode,
    instruction,
  });
  return res.data;
};

export const generateMediaContent = async (
  prompt,
  type,
  providerOverride,
  selectedMedia = null,
  userId = null,
  sessionId = null,
  aspectRatio = "1:1"
) => {
  const config = getAiConfig();
  let provider = providerOverride || config.provider;
  const originalProvider = provider;

  // Auto-route image requests to a capable provider if the current one is chat-only
  if (type === "image" && provider !== "openai" && provider !== "stability" && provider !== "stablediffusion") {
    if (config.openAiKey) provider = "openai";
    else if (config.stabilityKey) provider = "stability";
    else if (config.sdHost && config.sdHost !== "http://127.0.0.1:7860") provider = "stablediffusion";
    else provider = "pollinations"; // Ultra-high-quality FREE fallback (Flux)
  }
  // Auto-route video requests to Stability
  if (type === "video" && provider !== "stability" && config.stabilityKey) {
    provider = "stability";
  }

  // Map aspect ratio to exact pixel dimensions for various providers
  let width = 1024;
  let height = 1024;
  let dalleSize = "1024x1024";
  let stabilityRatio = "1:1";

  if (aspectRatio === "16:9") {
    width = 1280; height = 720;
    dalleSize = "1792x1024"; stabilityRatio = "16:9";
  } else if (aspectRatio === "9:16") {
    width = 720; height = 1280;
    dalleSize = "1024x1792"; stabilityRatio = "9:16";
  } else if (aspectRatio === "4:3") {
    width = 1024; height = 768;
    dalleSize = "1024x1024"; stabilityRatio = "4:3"; // DALL-E falls back to 1:1
  } else if (aspectRatio === "3:4") {
    width = 768; height = 1024;
    dalleSize = "1024x1024"; stabilityRatio = "3:4";
  }

  const apiKey = provider === "openai" ? config.openAiKey : provider === "stability" ? config.stabilityKey : provider === "stablediffusion" || provider === "pollinations" ? "local-node" : getAiKey();
  if (!apiKey) throw new Error(`API Key for ${provider.toUpperCase()} is missing.`);

  const PROMPT_SUFFIX = ", natural, realistic, beautiful, ultra hd, 8k resolution, cinematic lighting, photorealistic, intricate details, professional photography, highly detailed, sharp focus, masterpiece, 4k";
  const enhancedPrompt = `${prompt.trim()}${PROMPT_SUFFIX}`;

  const res = await apiClient.post("/ai/media", {
    provider, apiKey, prompt: enhancedPrompt, type, aspectRatio, selectedMedia,
    sdHost: config.sdHost, ollamaHost: config.ollamaHost,
    autoEnhanceEnabled: localStorage.getItem("aiAutoEnhance") !== "false",
    ollamaModel: localStorage.getItem("ollamaModel") || "llama3"
  });
  const data = res.data;
  
  let finalUrl = data.url;
  let isPermanent = !!data.url;

  if (data.base64) {
      try {
        const split = data.base64.split(',');
        const mimeString = split[0].match(/:(.*?);/)[1];
        const byteString = atob(split[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const blobUrl = URL.createObjectURL(blob);
        
        // ONLY use blob if no permanent URL was provided by the server
        if (!finalUrl) {
          finalUrl = blobUrl;
          isPermanent = false;
          console.log("Using temporary blob URL for media");
        } else {
          console.log("Using permanent cloud URL for media:", finalUrl);
        }
      } catch(e) {
        if (!finalUrl) finalUrl = data.base64;
      }
  }

  try {
    const history = JSON.parse(localStorage.getItem("ai_image_gallery") || "[]");
    history.unshift({
      id: Date.now().toString(),
      prompt: data.enhancedPrompt || prompt,
      url: finalUrl, // Use the best URL we have (permanent preferred)
      provider: data.provider || provider,
      aspectRatio,
      isPermanent,
      date: new Date().toISOString()
    });
    if (history.length > 15) history.pop();
    localStorage.setItem("ai_image_gallery", JSON.stringify(history));
  } catch (e) {
    console.warn("Failed to save generated image to gallery.", e);
  }

  // FINAL VALIDATION: Ensure blob URLs are NEVER marked as permanent
  const finalIsPermanent = isPermanent && !finalUrl.startsWith("blob:");

  return { type: data.type, url: finalUrl, isPermanent: finalIsPermanent };
};

export const generateSpeech = async (text, voice = 'alloy', provider = 'google_free', speed = 1.0, language = 'en', useUserVoice = false) => {
  const response = await apiClient.post('/ai/text-to-speech', {
    text, voice, provider, speed, language, useUserVoice
  }, { responseType: 'arraybuffer' });
  
  const blob = new Blob([response.data], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
};

export const speakText = async (text, options = {}) => {
  const config = getAiConfig();
  const provider = options.provider || config.provider;

  // Use Local AI Backend TTS if requested or if provider is stablediffusion/local
  if (provider === 'stablediffusion' || provider === 'local' || options.useBackend) {
    try {
      const audioUrl = await generateSpeech(
        text, 
        options.voice || 'alloy', 
        options.backendProvider || 'google_free', 
        options.rate || 1.0, 
        options.language || 'en',
        options.useUserVoice
      );
      const audio = new Audio(audioUrl);
      if (options.onEnd) audio.onended = options.onEnd;
      if (options.onError) audio.onerror = options.onError;
      audio.play();
      return;
    } catch (err) {
      console.warn("Backend TTS failed, falling back to browser synthesis", err);
    }
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const rate =
      options.rate !== undefined
        ? options.rate
        : parseFloat(localStorage.getItem("aiSpeechRate")) || 1;
    const voiceURI = localStorage.getItem("aiSpeechVoice") || "";
    utterance.rate = rate;
    if (voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find((v) => v.voiceURI === voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    if (options.onBoundary) utterance.onboundary = options.onBoundary;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    window.speechSynthesis.speak(utterance);
  }
};

export const stopSpeaking = () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
};
