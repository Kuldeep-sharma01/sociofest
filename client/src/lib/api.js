import { pythonClient, sdClient } from "@/services/apiClient";
import { API_URL, PYTHON_API_URL, SD_API_URL } from "@/config/constants";

export { API_URL, PYTHON_API_URL, SD_API_URL };

// ✅ Enforce a client-side allowlist before sending — defense in depth
const ALLOWED_CONFIG_KEYS = {
  local: ['path'],
  google_drive: ['credentials_file', 'folder_id'],
  aws_s3: ['bucket', 'region', 'access_key', 'secret_key'],
  azure_blob: ['account_name', 'account_key', 'container'],
  huggingface: [],
};

// Python API
export const pythonAPI = {
  registerFace: async (formData, signal) => {
    const res = await pythonClient.post("/python-api/register-face", formData, { signal });
    return res.data;
  },
  verifyFace: async (formData, signal) => {
    const res = await pythonClient.post("/python-api/verify-face", formData, { signal });
    return res.data;
  },
  getStorageBackends: async () => {
    const res = await pythonClient.get("/python-api/admin/storage/backends");
    return res.data;
  },
  getStorageConfig: async () => {
    const res = await pythonClient.get("/python-api/admin/storage/config");
    return res.data;
  },
  getStorageStatus: async () => {
    const res = await pythonClient.get("/python-api/admin/storage/status");
    return res.data;
  },
  getStorageSettings: async () => {
    const res = await pythonClient.get("/python-api/admin/storage/settings");
    return res.data;
  },
  toggleStorageBackend: async (backendType, enabled) => {
    const res = await pythonClient.post(`/python-api/admin/storage/backend/${backendType}/${enabled ? "enable" : "disable"}`, {});
    return res.data;
  },
  updateStorageBackendPriority: async (backendType, priority) => {
    const res = await pythonClient.put(`/python-api/admin/storage/backend/${backendType}/priority`, { priority });
    return res.data;
  },
  updateStorageBackendConfig: async (backendType, config) => {
    const allowed = ALLOWED_CONFIG_KEYS[backendType] ?? [];
    const safeConfig = Object.fromEntries(
      Object.entries(config).filter(([k]) => allowed.includes(k))
    );
    const res = await pythonClient.put(`/python-api/admin/storage/backend/${backendType}/config`, { config: safeConfig });
    return res.data;
  },
};

// Stable Diffusion API
export const sdAPI = {
  generate: async (data) => {
    const res = await sdClient.post("/generate", data);
    return res.data;
  }
};