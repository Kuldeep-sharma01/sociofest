import { pythonClient } from "@/services/apiClient";
import { API_URL } from "@/config/constants";

export { API_URL };

// ✅ Enforce a client-side allowlist before sending — defense in depth
const ALLOWED_CONFIG_KEYS = {
  local: ['path'],
  google_drive: ['credentials_file', 'folder_id'],
  aws_s3: ['bucket', 'region', 'access_key', 'secret_key', 'cdn_url'],
  azure_blob: ['account_name', 'account_key', 'container'],
  huggingface: [],
  cloudinary: ['cloud_name', 'api_key', 'api_secret'],
};

// Python API
// Dev:  pythonClient.baseURL = "/python-api" → Vite proxy strips prefix → http://localhost:5001
// Prod: pythonClient.baseURL = VITE_PYTHON_URL → https://sociofest-python.onrender.com
// All paths here are relative to the Python service root (no /python-api prefix needed).
export const pythonAPI = {
  registerFace: async (formData, signal) => {
    const res = await pythonClient.post("/register-face", formData, { signal });
    return res.data;
  },
  verifyFace: async (formData, signal) => {
    const res = await pythonClient.post("/verify-face", formData, { signal });
    return res.data;
  },
  getStorageBackends: async (target = 'model') => {
    const res = await pythonClient.get(`/admin/storage/backends?target=${target}`);
    return res.data;
  },
  getStorageConfig: async (target = 'model') => {
    const res = await pythonClient.get(`/admin/storage/config?target=${target}`);
    return res.data;
  },
  getStorageStatus: async (target = 'model') => {
    const res = await pythonClient.get(`/admin/storage/status?target=${target}`);
    return res.data;
  },
  getStorageSettings: async (target = 'model') => {
    const res = await pythonClient.get(`/admin/storage/settings?target=${target}`);
    return res.data;
  },
  toggleStorageBackend: async (backendType, enabled, target = 'model') => {
    const res = await pythonClient.post(`/admin/storage/backend/${backendType}/${enabled ? "enable" : "disable"}?target=${target}`, {});
    return res.data;
  },
  updateStorageBackendPriority: async (backendType, priority, target = 'model') => {
    const res = await pythonClient.put(`/admin/storage/backend/${backendType}/priority?target=${target}`, { priority });
    return res.data;
  },
  updateStorageBackendConfig: async (backendType, config, target = 'model') => {
    const allowed = ALLOWED_CONFIG_KEYS[backendType] ?? [];
    const safeConfig = Object.fromEntries(
      Object.entries(config).filter(([k]) => allowed.includes(k))
    );
    const res = await pythonClient.put(`/admin/storage/backend/${backendType}/config?target=${target}`, { config: safeConfig });
    return res.data;
  },
};

// Stable Diffusion API
export const sdAPI = {
  generate: async (data) => {
    const res = await pythonClient.post("/sd-api/generate", data);
    return res.data;
  }
};