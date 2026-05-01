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
  },
};

const mergeSettings = (base, incoming) => ({
  ...base,
  ...incoming,
  emailSettings: {
    ...base.emailSettings,
    ...(incoming?.emailSettings || {}),
  },
  serviceControls: {
    ...base.serviceControls,
    ...(incoming?.serviceControls || {}),
  },
});

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
    },
  };
};
