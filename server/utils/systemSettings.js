import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsFilePath = path.join(__dirname, "..", "config", "systemSettings.json");

export const defaultSystemSettings = {
  maintenanceMode: false,
  registrationEnabled: true,
  emailSettings: {
    provider: "smtp",
    active: true,
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
  },
  serviceControls: {
    emailVerificationRequired: true,
    aiEnabled: true,
    faceRecognitionEnabled: true,
    wifiEnforcementEnabled: true,
    mediaPlayerFallbackEnabled: true,
    documentViewerFallbackEnabled: true,
    mobileSafeModeEnabled: true,
    compilerEnabled: true,
    marketplaceEnabled: true,
    chatEnabled: true,
    quizEnabled: true,
    attendanceEnabled: true,
    notificationsEnabled: true,
  },
  aiModelConfig: {
    chat: [
      { provider: "deepseek", model: "deepseek-chat", enabled: true, timeoutMs: 20000 },
      { provider: "openrouter", model: "meta-llama/llama-3-8b-instruct:free", enabled: true, timeoutMs: 25000 },
    ],
    media: [
      { provider: "openai", model: "gpt-4o-mini", enabled: true, timeoutMs: 30000 },
    ],
    apiKeys: {
      openai: "",
      deepseek: "",
      openrouter: "",
      gemini: "",
    },
  },
  cloudStorage: {
    activeProvider: "local",
    maxUploadSizeMB: 100,
    allowedFileTypes: ["image/*", "video/*", "audio/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.*"],
    local: { enabled: true, uploadDir: "uploads" },
    s3: { enabled: false, bucket: "", region: "", accessKeyId: "", secretAccessKey: "" },
    cloudinary: { enabled: false, cloudName: "", apiKey: "", apiSecret: "" },
    googleDrive: { enabled: false, folderId: "", serviceAccountKey: "" },
  },
  rateLimits: {
    global: { windowMs: 900000, max: 300 },
    auth: { windowMs: 900000, max: 20 },
    ai: { windowMs: 60000, max: 10 },
    upload: { windowMs: 60000, max: 30 },
    messages: { windowMs: 60000, max: 60 },
    compiler: { windowMs: 900000, max: 50 },
    admin: { windowMs: 900000, max: 30 },
    export: { windowMs: 900000, max: 5 },
  },
  accessControl: {
    allowedRoles: ["Student", "Teacher", "HOD", "Admin", "Seller"],
    defaultNewUserRole: "Student",
    requireApproval: true,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 1440,
    allowGoogleAuth: true,
    corsAllowedOrigins: [],
  },
};

const deepMerge = (base, incoming) => {
  if (!incoming || typeof incoming !== "object") return base;
  const result = { ...base };
  for (const key of Object.keys(base)) {
    if (incoming[key] === undefined) continue;
    if (
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key]) &&
      typeof incoming[key] === "object" &&
      incoming[key] !== null &&
      !Array.isArray(incoming[key])
    ) {
      result[key] = deepMerge(base[key], incoming[key]);
    } else {
      result[key] = incoming[key];
    }
  }
  // preserve any extra keys from incoming that aren't in base
  for (const key of Object.keys(incoming)) {
    if (!(key in base)) {
      result[key] = incoming[key];
    }
  }
  return result;
};

const mergeSettings = (base, incoming) => deepMerge(base, incoming);

export const readSystemSettings = async () => {
  try {
    const data = await fs.readFile(settingsFilePath, "utf-8");
    const parsed = JSON.parse(data);
    return mergeSettings(defaultSystemSettings, parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
      await fs.writeFile(
        settingsFilePath,
        JSON.stringify(defaultSystemSettings, null, 2),
        "utf-8",
      );
      return { ...defaultSystemSettings };
    }
    throw error;
  }
};

export const writeSystemSettings = async (settings) => {
  const merged = mergeSettings(defaultSystemSettings, settings);
  await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
  await fs.writeFile(settingsFilePath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
};

export const getPublicSystemSettings = async () => {
  const settings = await readSystemSettings();
  return {
    maintenanceMode: Boolean(settings.maintenanceMode),
    registrationEnabled: Boolean(settings.registrationEnabled),
    serviceControls: {
      emailVerificationRequired: Boolean(settings.serviceControls?.emailVerificationRequired),
      aiEnabled: Boolean(settings.serviceControls?.aiEnabled),
      faceRecognitionEnabled: Boolean(settings.serviceControls?.faceRecognitionEnabled),
      wifiEnforcementEnabled: Boolean(settings.serviceControls?.wifiEnforcementEnabled),
      mediaPlayerFallbackEnabled: Boolean(settings.serviceControls?.mediaPlayerFallbackEnabled),
      documentViewerFallbackEnabled: Boolean(settings.serviceControls?.documentViewerFallbackEnabled),
      mobileSafeModeEnabled: Boolean(settings.serviceControls?.mobileSafeModeEnabled),
      compilerEnabled: Boolean(settings.serviceControls?.compilerEnabled),
      marketplaceEnabled: Boolean(settings.serviceControls?.marketplaceEnabled),
      chatEnabled: Boolean(settings.serviceControls?.chatEnabled),
      quizEnabled: Boolean(settings.serviceControls?.quizEnabled),
      attendanceEnabled: Boolean(settings.serviceControls?.attendanceEnabled),
      notificationsEnabled: Boolean(settings.serviceControls?.notificationsEnabled),
    },
    navigationConfig: settings.navigationConfig || [],
  };
};
