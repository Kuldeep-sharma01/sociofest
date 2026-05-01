const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168."));

const apiUrl = isLocal
  ? `http://${window.location.hostname}:5000`
  : import.meta.env.VITE_CLIENT_URL || import.meta.env.VITE_CLIENT_URL;

export const API_URL = apiUrl + "/api";
export const API_URL = import.meta.env.VITE_CLIENT_URL || "";

const pythonApiUrl = isLocal
  ? `http://${window.location.hostname}:5001`
  : import.meta.env.PYTHON_API_URL || import.meta.env.PYTHON_API_URL;
export const PYTHON_API_URL = pythonApiUrl || "/python-api";

const sdApiUrl = isLocal
  ? "http://127.0.0.1:7860"
  : import.meta.env.VITE_PUBLIC_SD_API_URL || import.meta.env.VITE_SD_API_URL;
export const SD_API_URL = sdApiUrl || "/sd-api";