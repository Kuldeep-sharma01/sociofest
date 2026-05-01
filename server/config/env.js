// server/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const requireInAllEnvs = ["JWT_SECRET"];
const requireInProduction = ["MONGODB_URI_OR_MONGODB_URI"];

const missing = [];

for (const key of requireInAllEnvs) {
  if (!process.env[key]) missing.push(key);
}

if (
  process.env.NODE_ENV === "production" &&
  !process.env.MONGODB_URI &&
  !process.env.MONGODB_URI
) {
  missing.push("MONGODB_URI_OR_MONGODB_URI");
}

if (missing.length) {
  console.error(
    `❌ Missing required environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

// ✅ Export safely
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 5000),
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
};
