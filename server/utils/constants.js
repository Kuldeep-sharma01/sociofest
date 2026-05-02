// server/utils/constants.js
// Note: This file is for BROWSER-SIDE usage only (shared constants).
// Server-side code should use process.env directly.

const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168."));

const apiUrl = isLocal
  ? `http://${window.location.hostname}:5000`
  : (typeof import.meta !== "undefined" && import.meta.env?.BACKEND_URL) || "";

export const API_URL = apiUrl ? apiUrl + "/api" : "/api";

const pythonApiUrl = isLocal
  ? `http://${window.location.hostname}:5001`
  : (typeof import.meta !== "undefined" && import.meta.env?.PYTHON_URL) || "";
export const PYTHON_API_URL = pythonApiUrl || "/python-api";
