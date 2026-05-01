import { apiClient } from "@/services/apiClient";

let cachedSettings = null;
let cachedAt = 0;
let fetchPromise = null;
const CACHE_TTL_MS = 60 * 1000;

const fallbackSettings = {
  maintenanceMode: false,
  registrationEnabled: true,
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

export const getPublicSystemSettings = async (force = false) => {
  const now = Date.now();
  if (!force && cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  if (!force && fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await apiClient.get("/settings/public");
      const payload = res.data;
      cachedSettings = {
        ...fallbackSettings,
        ...payload,
        serviceControls: {
          ...fallbackSettings.serviceControls,
          ...(payload?.serviceControls || {}),
        },
      };
      cachedAt = Date.now();
      return cachedSettings;
    } catch {
      return fallbackSettings;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

export const getCachedSystemSettings = () => cachedSettings || fallbackSettings;
