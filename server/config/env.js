// server/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const requireInAllEnvs = ["JWT_SECRET"];

const missing = [];

for (const key of requireInAllEnvs) {
  if (!process.env[key]) missing.push(key);
}

if (
  process.env.NODE_ENV === "production" &&
  !process.env.MONGODB_URI
) {
  missing.push("MONGODB_URI");
}

if (missing.length) {
  console.error(
    `❌ Missing required environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

// ✅ Export safely — the 3 core URLs + essentials
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5000),
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173", // For CORS
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:5000", // For self-reference (e.g., email links)
  PYTHON_INTERNAL_URL: process.env.PYTHON_INTERNAL_URL || "http://localhost:5001",
  VOICE_AI_URL: process.env.VOICE_AI_URL || "http://localhost:8000",
  SD_API_URL: process.env.SD_API_URL || "http://127.0.0.1:7860",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
};
