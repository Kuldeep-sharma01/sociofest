// client/src/config/constants.js
// ── API base URLs ──
// Dev mode:  VITE_BACKEND_URL is NOT set in browser → fallback to "/api" (Vite proxy handles it)
// Prod mode: VITE_BACKEND_URL = "https://sociofest-backend.onrender.com" → API_URL = "https://...onrender.com/api"
//
// Python service:
//   Dev:  pythonClient uses "/python-api" → Vite proxy strips prefix → http://localhost:5001
//   Prod: pythonClient uses VITE_PYTHON_URL directly → https://sociofest-python.onrender.com

const backendUrl = import.meta.env.VITE_BACKEND_URL; // absolute URL in production, undefined in dev

// Use relative path '/api' in development to utilize Vite proxy (solves CORS issues)
// Use absolute URL in production (VITE_BACKEND_URL)
export const API_URL = (import.meta.env.DEV) 
  ? "/api" 
  : (backendUrl ? (backendUrl.endsWith("/api") ? backendUrl : `${backendUrl.replace(/\/+$/, "")}/api`) : "/api");

// Socket.io always connects to the Node.js backend
export const SOCKET_URL = backendUrl
  ? backendUrl.replace(/\/+$/, "")
  : ""; // empty string = same origin (Vite proxy handles /socket.io)

// Python AI service base URL (used for direct reference, not for axios clients)
export const PYTHON_API_URL = import.meta.env.VITE_PYTHON_URL
  ? import.meta.env.VITE_PYTHON_URL.replace(/\/+$/, "")
  : "/python-api";
