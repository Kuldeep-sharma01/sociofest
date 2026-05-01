import { createSlice } from "@reduxjs/toolkit";
import { syncAiKeys, setAiConfig } from "@/services/aiClient";

let parsedUser = null;
let parsedToken = null;
try {
  const storedUser = localStorage.getItem("user");
  const storedToken = localStorage.getItem("token");
  if (storedUser && storedUser !== "undefined") {
    parsedUser = JSON.parse(storedUser);
  }
  if (storedToken && storedToken !== "undefined") {
    parsedToken = storedToken;
  }
} catch (error) {
  console.error("Failed to parse user from local storage", error);
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

// Sync AI keys into secure memory immediately on script load (refresh)
syncAiKeys();

// ✅ Scrub all sensitive keys consistently
const SENSITIVE_FIELDS = [
  'geminiApiKey', 'openAiApiKey', 'stabilityApiKey', 'claudeApiKey',
  'openAiKey', 'stabilityKey', 'claudeKey', 'password', 'otp'
];

const scrubUser = (user) => {
  const clean = { ...user };
  SENSITIVE_FIELDS.forEach(f => delete clean[f]);
  return clean;
};

const initialState = {
  user: parsedUser,
  token: parsedToken,
};
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      const user = { ...action.payload.user };

      // Securely inject keys to memory
      setAiConfig(localStorage.getItem("aiProvider") || "gemini", {
        geminiKey: user.geminiApiKey,
        openAiKey: user.openAiApiKey,
        stabilityKey: user.stabilityApiKey,
        claudeKey: user.claudeApiKey,
      });

      const cleanUser = scrubUser(user);

      state.user = cleanUser;
      state.token = action.payload.token;
      localStorage.setItem("user", JSON.stringify(cleanUser));
      localStorage.setItem("token", action.payload.token);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    },
    updateUser: (state, action) => {
      const user = { ...state.user, ...action.payload };

      setAiConfig(localStorage.getItem("aiProvider") || "gemini", {
        geminiKey: user.geminiApiKey,
        openAiKey: user.openAiApiKey,
        stabilityKey: user.stabilityApiKey,
        claudeKey: user.claudeApiKey,
      });

      const cleanUser = scrubUser(user);

      state.user = cleanUser;
      localStorage.setItem("user", JSON.stringify(cleanUser));
    },
  },
});

export const { login, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
