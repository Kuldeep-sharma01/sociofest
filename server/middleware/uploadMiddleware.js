import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const tempDir = path.resolve(process.cwd(), "uploads/temp");
fs.mkdirSync(tempDir, { recursive: true });

const blockedExtensions = new Set([
  ".exe",
  ".php",
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".sh",
  ".bat",
  ".cmd",
  ".cgi",
  ".pl",
  ".py",
  ".dll",
  ".msi",
  ".jsp",
  ".asp",
  ".aspx",
]);

export const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9.]/g, "") || "";
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (blockedExtensions.has(ext)) {
    return cb(new Error("Prohibited file type"), false);
  }

  if (!allowedMimeTypes.has(file.mimetype)) {
    return cb(new Error("Unsupported file type"), false);
  }

  cb(null, true);
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024,
    files: 10,
    fields: 50,
  },
});

const wrapMulter = (instance) => {
  const methods = ["any", "array", "fields", "none", "single"];
  const wrapper = {};
  
  methods.forEach((method) => {
    wrapper[method] = function () {
      const middleware = instance[method].apply(instance, arguments);
      return (req, res, next) => {
        middleware(req, res, (err) => {
          if (err) return next(err);

          // Globally unwrap __type = 'json' fields appended by the client
          if (req.body) {
            Object.keys(req.body).forEach((key) => {
              const typeKey = `${key}__type`;
              const typeVal = req.body[typeKey];
              
              const isJson = typeVal === "json" || (Array.isArray(typeVal) && typeVal.includes("json"));
              
              if (isJson) {
                try {
                  const val = req.body[key];
                  if (val !== undefined) {
                    if (Array.isArray(val)) {
                      // Map through array items and parse strings back to objects
                      req.body[key] = val.map((item) => {
                        try { return typeof item === "string" ? JSON.parse(item) : item; } 
                        catch (e) { return item; }
                      });
                    } else if (typeof val === "string") {
                      req.body[key] = JSON.parse(val);
                    }
                  }
                  // Clean up the helper key so it doesn't bloat controller logic
                  delete req.body[typeKey];
                } catch (e) {
                  console.error(`[Multer Wrapper] Failed to parse JSON for field ${key}:`, e.message);
                }
              }
            });
          }
          next();
        });
      };
    };
  });
  
  return wrapper;
};

const upload = wrapMulter(multerInstance);
export default upload;
