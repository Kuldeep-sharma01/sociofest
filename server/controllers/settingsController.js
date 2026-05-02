import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logActivity } from "../utils/authorizationHelpers.js";
import { ok, badRequest, serverError } from "../utils/index.js";
import {
  defaultSystemSettings,
  readSystemSettings,
  writeSystemSettings,
  getPublicSystemSettings,
} from "../utils/systemSettings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Settings will be stored in server/config/systemSettings.json
const settingsFilePath = path.join(
  __dirname,
  "..",
  "config",
  "systemSettings.json",
);

const ffmpegFilePath = path.join(
  __dirname,
  "..",
  "config",
  "ffmpegConfig.json",
);

const defaultSettings = defaultSystemSettings;

/**
 * Reads settings from the JSON file. Creates the file with defaults if it doesn't exist.
 */
const readSettings = async () => readSystemSettings();

/**
 * Writes the provided settings object to the JSON file.
 */
const writeSettings = async (settings) => writeSystemSettings(settings);

export const getSystemSettings = async (req, res, next) => {
  try {
    const settings = await readSettings();
    if (settings.emailSettings?.pass) settings.emailSettings.pass = '••••••••';
    ok(res, settings, "System settings retrieved successfully.");
  } catch (error) {
    serverError(res, error.message);
  }
};

export const getPublicSettings = async (req, res) => {
  try {
    const settings = await getPublicSystemSettings();
    ok(res, settings, "Public system settings retrieved successfully.");
  } catch (error) {
    serverError(res, error.message);
  }
};

export const getFfmpegConfig = async (req, res) => {
  try {
    const data = await fs.readFile(ffmpegFilePath, "utf-8");
    ok(res, JSON.parse(data), "FFmpeg config retrieved successfully.");
  } catch (e) {
    ok(res, { maxBuffer: 1073741824, preset: "ultrafast", crf: "28", timeout: 0, enableHls: true }, "Default FFmpeg config retrieved.");
  }
};

export const updateFfmpegConfig = async (req, res) => {
  try {
    await fs.mkdir(path.dirname(ffmpegFilePath), { recursive: true });
    const { maxBuffer, preset, crf, timeout, enableHls } = req.body;

    const VALID_PRESETS = ['ultrafast','superfast','veryfast','fast','medium','slow','slower','veryslow'];
    if (preset !== undefined && !VALID_PRESETS.includes(preset))
      return badRequest(res, 'Invalid FFmpeg preset value');

    const parsedCrf = parseInt(crf);
    if (crf !== undefined && (isNaN(parsedCrf) || parsedCrf < 0 || parsedCrf > 51))
      return badRequest(res, 'crf must be an integer between 0 and 51');

    if (enableHls !== undefined && typeof enableHls !== 'boolean')
      return badRequest(res, 'enableHls must be a boolean');

    const safeConfig = {
      ...(maxBuffer !== undefined && { maxBuffer: Math.min(parseInt(maxBuffer) || 1073741824, 4 * 1073741824) }),
      ...(preset !== undefined  && { preset }),
      ...(crf !== undefined     && { crf: parsedCrf }),
      ...(timeout !== undefined && { timeout: Math.max(0, parseInt(timeout) || 0) }),
      ...(enableHls !== undefined && { enableHls }),
    };

    const existing = JSON.parse(await fs.readFile(ffmpegFilePath, 'utf-8').catch(() => '{}')); 
    await fs.writeFile(ffmpegFilePath, JSON.stringify({ ...existing, ...safeConfig }, null, 2));
    ok(res, { config: safeConfig }, "FFmpeg config updated successfully.");
  } catch (e) {
    serverError(res, "Failed to save FFmpeg config.");
  }
};

export const updateSystemSettings = async (req, res, next) => {
  try {
    const { maintenanceMode, registrationEnabled, emailSettings, serviceControls, navigationConfig } = req.body;

    // Data Validation
    if (maintenanceMode !== undefined && typeof maintenanceMode !== "boolean") {
      return badRequest(res, "maintenanceMode must be a boolean.");
    }
    if (registrationEnabled !== undefined && typeof registrationEnabled !== "boolean") {
      return badRequest(res, "registrationEnabled must be a boolean.");
    }
    if (serviceControls !== undefined) {
      if (typeof serviceControls !== "object" || Array.isArray(serviceControls)) {
        return badRequest(res, "serviceControls must be an object.");
      }
      for (const [key, value] of Object.entries(serviceControls)) {
        if (typeof value !== "boolean") {
          return badRequest(res, `serviceControls.${key} must be a boolean.`);
        }
      }
    }

    if (emailSettings !== undefined) {
      if (typeof emailSettings !== "object" || Array.isArray(emailSettings)) {
        return badRequest(res, "emailSettings must be an object.");
      }
      
      const { provider, active, host, port, secure, user, pass } = emailSettings;
      if (provider !== undefined && typeof provider !== "string") return badRequest(res, "provider must be a string.");
      if (active !== undefined && typeof active !== "boolean") return badRequest(res, "emailSettings.active must be a boolean.");
      if (host !== undefined && typeof host !== "string") return badRequest(res, "host must be a string.");
      if (port !== undefined && typeof port !== "number") return badRequest(res, "port must be a number.");
      if (secure !== undefined && typeof secure !== "boolean") return badRequest(res, "secure must be a boolean.");
      if (user !== undefined && typeof user !== "string") return badRequest(res, "user must be a string.");
      if (pass !== undefined && typeof pass !== "string") return badRequest(res, "pass must be a string.");
    }

    const currentSettings = await readSettings();
    
    let safeEmailSettings = {};
    if (emailSettings !== undefined) {
      const { provider, active, host, port, secure, user, pass } = emailSettings;
      if (provider !== undefined) safeEmailSettings.provider = provider;
      if (active !== undefined) safeEmailSettings.active = active;
      if (host !== undefined) safeEmailSettings.host = host;
      if (port !== undefined) safeEmailSettings.port = port;
      if (secure !== undefined) safeEmailSettings.secure = secure;
      if (user !== undefined) safeEmailSettings.user = user;
      if (pass !== undefined) safeEmailSettings.pass = pass;
    }

    // Deep merge to avoid accidentally wiping out nested fields during partial updates
    const mergedEmailSettings = emailSettings 
      ? { ...currentSettings.emailSettings, ...safeEmailSettings }
      : currentSettings.emailSettings;

    const newSettings = {
      ...currentSettings,
      ...(maintenanceMode !== undefined && { maintenanceMode }),
      ...(registrationEnabled !== undefined && { registrationEnabled }),
      emailSettings: mergedEmailSettings,
      serviceControls: {
        ...(currentSettings.serviceControls || defaultSettings.serviceControls),
        ...(serviceControls || {}),
      },
      ...(navigationConfig && { navigationConfig }),
    };
    await writeSettings(newSettings);

    // Log the configuration change
    if (req.user) {
      try {
        const redact = (obj) => {
          if (!obj?.emailSettings) return obj;
          const clone = JSON.parse(JSON.stringify(obj));
          if (clone.emailSettings?.pass) clone.emailSettings.pass = '[REDACTED]';
          return clone;
        };

        await logActivity({
          actor: {
            userId: req.user._id,
            name: req.user.name,
            role: req.user.role,
            department: req.user.department,
          },
          action: "system_settings_updated",
          resource: "settings",
          scope: "global",
          details: { before: redact(currentSettings), after: redact(newSettings) },
          status: "success",
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
          visibility: "admin_only",
          tags: ["settings", "admin_action"],
        });
      } catch (logError) {
        console.error("Failed to log settings update activity:", logError);
      }
    }

    // Prepare response, redacting the password
    const responseSettings = JSON.parse(JSON.stringify(newSettings));
    if (responseSettings.emailSettings?.pass) responseSettings.emailSettings.pass = '••••••••';

    ok(res, { settings: responseSettings }, "Settings updated successfully");
  } catch (error) {
    serverError(res, error.message);
  }
};

export const getEmailSettings = async (req, res, next) => {
  try {
    const settings = await readSettings();
    const emailSettings = settings.emailSettings || defaultSettings.emailSettings;
    if (emailSettings.pass) emailSettings.pass = '••••••••';
    ok(res, emailSettings, "Email settings retrieved successfully.");
  } catch (error) {
    serverError(res, error.message);
  }
};