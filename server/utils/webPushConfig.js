import webpush from "web-push";
import dotenv from "dotenv";
dotenv.config();

// ✅ Export a flag so callers can guard gracefully:
export const isPushConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Configure the VAPID details globally for the server
if (isPushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@sociofest.edu",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  console.log("✅ Web Push (VAPID) configured successfully.");
} else {
  console.warn(
    "⚠️ VAPID keys are missing from .env. Push notifications will be disabled."
  );
}

export default webpush;
