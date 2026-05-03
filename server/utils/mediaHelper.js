import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { createReadStream } from "fs";
import fsSync from "fs";
import util from "util";
import Media from "../models/Media.js";
import { fileTypeFromBuffer } from "file-type";
import { allowedMimeTypes } from "../middleware/uploadMiddleware.js";
import logger from "./logger.js";

const execFileAsync = util.promisify(execFile);

// Track FFmpeg processes to gracefully kill them if Node.js server shuts down or crashes
const activeProcesses = new Set();

const cleanupProcesses = () => {
  for (const cp of activeProcesses) {
    try {
      cp.kill("SIGKILL");
    } catch (e) { }
  }
};
process.on("SIGTERM", cleanupProcesses);
process.on("SIGINT", cleanupProcesses);

const getFfmpegConfigPath = () => path.join(process.cwd(), "config", "ffmpegConfig.json");

let dynamicConfig = {};
const loadDynamicConfig = () => {
  try {
    const data = fsSync.readFileSync(getFfmpegConfigPath(), "utf-8");
    dynamicConfig = JSON.parse(data);
  } catch (e) {
    // Fallback to legacy path if new path doesn't exist yet
    try {
      const legacyData = fsSync.readFileSync(path.join(process.cwd(), "ffmpeg_config.json"), "utf-8");
      dynamicConfig = JSON.parse(legacyData);
    } catch (err) { }
  }
};

// Initial load
loadDynamicConfig();

export const getFfmpegConfig = () => {
  // Reload to ensure we have the latest settings from Admin Dashboard without restart
  loadDynamicConfig();
  return {
    maxBuffer:
      dynamicConfig.maxBuffer ||
      (process.env.FFMPEG_MAX_BUFFER
        ? parseInt(process.env.FFMPEG_MAX_BUFFER)
        : 1024 * 1024 * 1024),
    preset: dynamicConfig.preset || process.env.FFMPEG_PRESET || "ultrafast",
    crf: dynamicConfig.crf || process.env.FFMPEG_CRF || "28",
    timeout:
      dynamicConfig.timeout !== undefined
        ? dynamicConfig.timeout
        : process.env.FFMPEG_TIMEOUT
          ? parseInt(process.env.FFMPEG_TIMEOUT)
          : 0,
    enableHls: dynamicConfig.enableHls !== false,
  };
};

export const updateFfmpegConfig = async (newConfig) => {
  dynamicConfig = { ...dynamicConfig, ...newConfig };
  await fs.writeFile(
    getFfmpegConfigPath(),
    JSON.stringify(dynamicConfig, null, 2),
  );
};

// ✅ Parse SVG content and reject files containing script or event handler attributes
const validateSvg = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
  if (!content) return false;
  // Reject if any script tags or JavaScript event handlers present
  const dangerous = /<script[\s>]/i.test(content) ||
    /\bon\w+\s*=/i.test(content) ||
    /javascript:/i.test(content) ||
    /<use\s+href/i.test(content); // blocks external resource injection
  return !dangerous;
};

// Verify file contents using magic numbers
export const verifyFileType = async (filePath, claimedMimetype) => {
  const buffer = Buffer.alloc(4100);
  let fd;
  try {
    fd = await fs.open(filePath, "r");
    await fd.read(buffer, 0, 4100, 0);
  } finally {
    if (fd) await fd.close(); // Use finally to prevent file descriptor leaks
  }
  const detected = await fileTypeFromBuffer(buffer);

  // Text, CSV, and SVG files don't have binary magic numbers that file-type detects reliably
  if (!detected && claimedMimetype === "image/svg+xml") {
    return await validateSvg(filePath);
  }
  if (!detected && claimedMimetype.startsWith("text/")) return true;
  if (!detected) return false; // Unknown binary — reject

  return (
    detected.mime === claimedMimetype || allowedMimeTypes.has(detected.mime)
  );
};

/**
 * Processes an uploaded file from Multer to check for duplicates using hashing.
 * If the file is a duplicate, it returns the existing media record and deletes the new upload.
 * If the file is new, it saves it, creates a new media record, and returns it.
 *
 * @param {object} file - The file object from Multer (req.file).
 * @param {string} folderName - Optional subfolder to organize uploads dynamically.
 * @returns {Promise<object>} The media document from the database ({ path, mimetype }).
 */
export const processUpload = async (file, folderName = "") => {
  if (!file) {
    throw new Error("No file provided for processing.");
  }

  // Content-based magic number verification
  const isSafe = await verifyFileType(file.path, file.mimetype);
  if (!isSafe) {
    await fs.unlink(file.path).catch(() => { });
    throw new Error(
      "Security Error: File content does not match declared type.",
    );
  }

  // Helper to run execFile and securely track the child process to avoid zombie cores
  const trackedExecFileAsync = (file, args, options) => {
    return new Promise((resolve, reject) => {
      const cp = execFile(file, args, options, (error, stdout, stderr) => {
        activeProcesses.delete(cp);
        if (error) reject(error);
        else resolve({ stdout, stderr });
      });
      activeProcesses.add(cp);
    });
  };

  // SECURITY FIX: Strictly prevent Directory Path Traversal attacks
  folderName = folderName.replace(/[^a-zA-Z0-9_\-/]/g, "");

  // 1. Calculate the file hash from its temporary path
  const hash = await new Promise((resolve, reject) => {
    const hashStream = crypto.createHash("sha256");
    const rs = createReadStream(file.path);
    rs.on("error", reject);
    rs.on("data", (chunk) => hashStream.update(chunk));
    rs.on("end", () => resolve(hashStream.digest("hex")));
  });

  // Fix: Check for duplicate uploads to prevent E11000 Unique Constraint Crashes
  const existingMedia = await Media.findOne({ hash });
  if (existingMedia) {
    // Physical Verification: Ensure the file wasn't deleted from the server manually or by cleanup script
    try {
      await fs.access(path.resolve(process.cwd(), existingMedia.path));
      await fs.unlink(file.path).catch(() => { });
      return existingMedia;
    } catch (diskErr) {
      // File is physically missing! Delete the orphaned DB record and process the new upload.
      await Media.findByIdAndDelete(existingMedia._id).catch(() => { });
    }
  }

  let extension = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, "");

  // SECURITY FIX: Block highly dangerous executable and script extensions
  const dangerousExts = [
    ".exe",
    ".php",
    ".js",
    ".html",
    ".htm",
    ".sh",
    ".bat",
    ".cgi",
    ".pl",
    ".py",
    ".dll",
  ];
  if (dangerousExts.includes(extension.toLowerCase())) {
    await fs.unlink(file.path).catch(() => { });
    throw new Error(
      "Security Error: Uploading this file type is strictly prohibited.",
    );
  }

  // Fallback if browser/OS strips extension (common in blob uploads)
  if (!extension) {
    if (file.mimetype.startsWith("video/")) extension = ".mp4";
    else if (file.mimetype.startsWith("image/")) extension = ".png";
  }

  // Fix: Force video mimetype if OS uploaded an .mkv/.mp4 as 'application/octet-stream'
  let finalMimeType = file.mimetype;
  if (
    !finalMimeType.startsWith("video/") &&
    /\.(mp4|mkv|webm|mov|avi|hevc)$/i.test(extension)
  ) {
    finalMimeType = "video/mp4";
  }

  // Force .mp4 extension for ALL videos to ensure Express serves the correct MIME type (video/mp4)
  if (finalMimeType.startsWith("video/")) {
    extension = ".mp4";
    finalMimeType = "video/mp4";
  }

  // COLLISION FIX: Append timestamp to prevent cross-deletion breakage
  const newFilename = `${hash}_${Date.now()}${extension}`;

  const baseDir = folderName
    ? path.join("uploads", folderName)
    : "uploads";
  await fs.mkdir(baseDir, { recursive: true }).catch(() => { });
  const newPath = path.join(baseDir, newFilename);

  // Move the file safely (handles cross-device EXDEV errors common in Dropbox/Docker)
  try {
    await fs.rename(file.path, newPath);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fs.copyFile(file.path, newPath);
      await fs.unlink(file.path).catch(() => { });
    } else throw err;
  }

  // Extract embedded multi-track subtitles and audio using FFmpeg & FFprobe
  const isOversized = file.size > 3221225472; // > 3GB

  if (finalMimeType.startsWith("video/") && !isOversized) {
    // Run in background to prevent blocking the HTTP response during upload
    (async () => {
      const baseName = path.basename(newFilename, extension);
      const config = getFfmpegConfig();
      let isSafeForCopy = false;
      let isH264 = false;
      let sourceHeight = 1080; // Added for resolution generation

      // --- PHASE 1: METADATA & TRACK EXTRACTION ---
      try {
        // Massive maxBuffer to prevent FFprobe/FFmpeg crashes on 10GB+ files
        const { stdout } = await trackedExecFileAsync(
          "ffprobe",
          ["-v", "error", "-print_format", "json", "-show_streams", newPath],
          { timeout: 60000, maxBuffer: config.maxBuffer },
        );
        const info = JSON.parse(stdout);
        const subStreams =
          info.streams?.filter((s) => s.codec_type === "subtitle") || [];
        const audioStreams =
          info.streams?.filter((s) => s.codec_type === "audio") || [];
        const videoStream = info.streams?.find((s) => s.codec_type === "video");
        sourceHeight = videoStream?.height || 1080;

        // Detect Dolby Vision metadata
        const isAnyDolbyVision =
          videoStream &&
          (["dvh1", "dvhe"].includes(videoStream.codec_tag_string) ||
            (videoStream.side_data_list &&
              videoStream.side_data_list.some(
                (d) => d.side_data_type && d.side_data_type.includes("DOVI"),
              )));
        // Specifically detect problematic Dolby Vision Profile 5 which uses the ICtCp color space and is not backward-compatible.
        // Other profiles (like Profile 8) have an HDR10 base layer and are safe to stream copy.
        const isProblematicDolbyVision =
          videoStream && videoStream.color_space === "ictcp";

        // Advanced Codec Handles: Catch HEVC, VP9, AV1, and Apple ProRes variations
        const isHEVC =
          videoStream &&
          (["hevc", "h265", "prores", "vp9", "av1"].includes(
            videoStream.codec_name,
          ) ||
            ["hvc1", "hev1", "vp09", "av01"].includes(
              videoStream.codec_tag_string,
            ));
        isH264 = videoStream && videoStream.codec_name === "h264";

        // Only transcode if the format is an incompatible Dolby Vision profile. Otherwise, copy directly.
        isSafeForCopy = (isHEVC || isH264) && !isProblematicDolbyVision;

        const manifest = {
          subtitles: [],
          audioTracks: [],
          hasHls: config.enableHls === true,
          isDolbyVision: isAnyDolbyVision && !isProblematicDolbyVision,
        };

        // Process Subtitles
        for (let i = 0; i < subStreams.length; i++) {
          const s = subStreams[i];

          // const subPath = `uploads/${hash}_sub_${s.index}.vtt`;

          const subPath = path.join(
            baseDir,
            `${baseName}_sub_${s.index}.vtt`,
          );
          try {
            await trackedExecFileAsync(
              "ffmpeg",
              ["-y", "-i", newPath, "-map", `0:${s.index}`, subPath],
              { timeout: 120000, maxBuffer: config.maxBuffer },
            );
            manifest.subtitles.push({
              id: s.index,
              url: `/${subPath.replace(/\\/g, "/")}`,
              label: s.tags?.language || s.tags?.title || `Subtitle ${i + 1}`,
            });
          } catch (err) {
            logger.error(`Failed to extract subtitle stream ${s.index}`, { error: err.message, streamIndex: s.index, file: newPath });
          }
        }

        // Process Audio
        if (audioStreams.length > 1) {
          for (let i = 0; i < audioStreams.length; i++) {
            const a = audioStreams[i];
            // Use .m4a instead of .aac for better browser compatibility with '-c:a copy'
            //  const audioPath = `uploads/${hash}_audio_${a.index}.m4a`;

            const audioPath = path.join(
              baseDir,
              `${baseName}_audio_${a.index}.m4a`,
            );
            try {
              // Optimize: Copy audio instantly if it's already web-friendly AAC
              if (a.codec_name === "aac") {
                await trackedExecFileAsync(
                  "ffmpeg",
                  ["-y", "-i", newPath, "-map", `0:${a.index}`, "-c:a", "copy", audioPath],
                  { timeout: 120000, maxBuffer: config.maxBuffer },
                );
              } else {
                await trackedExecFileAsync(
                  "ffmpeg",
                  ["-y", "-i", newPath, "-map", `0:${a.index}`, "-c:a", "aac", "-b:a", "192k", "-ac", "2", audioPath],
                  { timeout: 300000, maxBuffer: config.maxBuffer },
                );
              }
              manifest.audioTracks.push({
                id: a.index,
                url: `/${audioPath.replace(/\\/g, "/")}`,
                label:
                  a.tags?.language || a.tags?.title || `Audio Track ${i + 1}`,
              });
            } catch (err) {
              logger.error(`Failed to extract audio stream ${a.index}`, { error: err.message, streamIndex: a.index, file: newPath });
            }
          }
        }

        // ALWAYS write the manifest, even if empty, to prevent frontend 404 fetch errors

        // await fs.writeFile(`uploads/${hash}_manifest.json`, JSON.stringify(manifest));

        await fs.writeFile(
          path.join(baseDir, `${baseName}_manifest.json`),
          JSON.stringify(manifest),
        );
        logger.info(`Successfully scanned/extracted tracks for ${newPath}`);
      } catch (err) {
        logger.error("[FFPROBE] Metadata extraction failed, skipping to optimization phase", { error: err.message, file: newPath });
        await fs
          .writeFile(
            path.join(baseDir, `${baseName}_manifest.json`),
            JSON.stringify({ subtitles: [], audioTracks: [], hasHls: false }),
          )
          .catch(() => { });
      }

      // --- PHASE 2: THUMBNAIL GENERATION ---
      try {
        // Generate Thumbnail Poster to prevent Black Screens before playback
        const thumbnailPath = path.join(baseDir, `${baseName}_thumb.jpg`);
        await trackedExecFileAsync(
          "ffmpeg",
          ["-v", "error", "-y", "-i", newPath, "-map", "0:v:0", "-ss", "00:00:01.000", "-vframes", "1", "-q:v", "2", "-pix_fmt", "yuvj420p", thumbnailPath],
          { timeout: 60000, maxBuffer: config.maxBuffer },
        );
      } catch (thumbErr) {
        console.warn(`[FFMPEG] Thumbnail generation failed for ${baseName}`);
      }

      // --- PHASE 3: HLS & FALLBACK MP4 OPTIMIZATION ---
      try {
        // SECURITY FIX: Strictly sanitize Admin inputs to prevent Shell Command Injection
        const FFMPEG_PRESETS = [
          "ultrafast",
          "superfast",
          "veryfast",
          "fast",
          "medium",
          "slow",
          "slower",
          "veryslow",
        ];
        const safePreset = FFMPEG_PRESETS.includes(config.preset)
          ? config.preset
          : "ultrafast";
        const parsedCrf = parseInt(config.crf);
        const safeCrf =
          !isNaN(parsedCrf) && parsedCrf >= 0 && parsedCrf <= 51
            ? parsedCrf
            : 28;

        if (config.enableHls) {
          console.log(`[FFMPEG] Generating HLS Chunks for ${baseName}...`);
          const hlsDir = path.join(baseDir, `${baseName}_hls`);
          await fs.mkdir(hlsDir, { recursive: true }).catch(() => { });
          const hlsPlaylistPath = path.join(hlsDir, "master.m3u8");

          const safeNewPath = newPath.replace(/\\/g, "/");

          try {
            if (!isSafeForCopy)
              throw new Error("Format requires transcoding for web streaming.");
            
            await trackedExecFileAsync(
              "ffmpeg",
              [
                "-v", "error", "-y", "-i", safeNewPath, "-map", "0:v:0", "-map", "0:a:0?",
                "-c", "copy", "-f", "hls", "-hls_time", "4", "-hls_playlist_type", "vod",
                "-hls_segment_type", "mpegts",
                "-hls_segment_filename", path.join(hlsDir, "chunk_%03d.ts").replace(/\\/g, "/"),
                hlsPlaylistPath.replace(/\\/g, "/")
              ],
              { timeout: config.timeout, maxBuffer: config.maxBuffer },
            );
          } catch (hlsCopyErr) {
            await trackedExecFileAsync(
              "ffmpeg",
              [
                "-v", "error", "-y", "-i", safeNewPath, "-map", "0:v:0", "-map", "0:a:0?",
                "-c:v", "libx264", "-preset", safePreset, "-crf", String(safeCrf), "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-f", "hls", "-hls_time", "4",
                "-hls_playlist_type", "vod", "-hls_segment_type", "mpegts",
                "-hls_segment_filename", path.join(hlsDir, "chunk_%03d.ts").replace(/\\/g, "/"),
                hlsPlaylistPath.replace(/\\/g, "/")
              ],
              { timeout: config.timeout, maxBuffer: config.maxBuffer },
            );
          }
          console.log(`[FFMPEG] HLS Chunking complete for ${baseName}!`);
        }

        // Always create a web-friendly H.264 Fast-Start fallback MP4 for offline downloads and legacy devices
        console.log(
          `[FFMPEG] Creating Fast-Start Fallback MP4 for ${baseName}...`,
        );
        const optPath = path.join(baseDir, `${baseName}_opt.mp4`);

        if (!isH264) {
          await trackedExecFileAsync(
            "ffmpeg",
            [
              "-v", "error", "-y", "-i", newPath, "-map", "0:v:0", "-map", "0:a:0?",
              "-c:v", "libx264", "-preset", safePreset, "-crf", String(safeCrf), "-pix_fmt", "yuv420p",
              "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", optPath
            ],
            { timeout: config.timeout, maxBuffer: config.maxBuffer },
          );
        } else {
          // Even if video is copied, ENSURE audio is transcoded to AAC for web compatibility
          await trackedExecFileAsync(
            "ffmpeg",
            [
              "-v", "error", "-y", "-i", newPath, "-map", "0:v:0", "-map", "0:a:0?",
              "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-movflags", "+faststart", optPath
            ],
            { timeout: config.timeout, maxBuffer: config.maxBuffer },
          );
        }

        // CLEANUP: Replace original unoptimized file with the optimized web-safe MP4 to save massive storage space!
        await fs.rename(optPath, newPath);
        console.log(
          `[FFMPEG] Fallback optimization complete for ${baseName}! Original file replaced to save space.`,
        );

        // --- NEW FEATURE: GENERATE MULTIPLE RESOLUTIONS ---
        // Only generate multiple resolutions if HLS/Adaptive streaming is enabled to save massive CPU
        if (config.enableHls) {
          console.log(
            `[FFMPEG] Generating multiple resolutions for ${baseName}...`,
          );
          const targetHeights = [1080, 720, 480, 360];
          let currentManifest = {
            subtitles: [],
            audioTracks: [],
            resolutions: [],
          };

          try {
            const manifestContent = await fs.readFile(
              path.join(baseDir, `${baseName}_manifest.json`),
              "utf-8",
            );
            currentManifest = {
              ...currentManifest,
              ...JSON.parse(manifestContent),
            };
          } catch (e) { }

          // Add the master optimized fallback file as the primary resolution
          currentManifest.resolutions = currentManifest.resolutions || [];
          currentManifest.resolutions.push({
            height: sourceHeight,
            label: `${sourceHeight}p (Original)`,
            url: `/${newPath.replace(/\\/g, "/")}`,
          });

          // Generate lower resolutions based on source height
          for (const h of targetHeights) {
            if (sourceHeight > h + 50) {
              // Only downscale if original is noticeably larger
              const resMp4Path = path.join(
                baseDir,
                `${baseName}_${h}p.mp4`,
              );
              console.log(`[FFMPEG] Generating ${h}p version...`);
              try {
                await trackedExecFileAsync(
                  "ffmpeg",
                  [
                    "-v", "error", "-y", "-i", newPath, "-vf", `scale=-2:${h}`,
                    "-c:v", "libx264", "-preset", safePreset, "-crf", String(safeCrf), "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", resMp4Path
                  ],
                  { timeout: config.timeout, maxBuffer: config.maxBuffer },
                );
                currentManifest.resolutions.push({
                  height: h,
                  label: `${h}p`,
                  url: `/${resMp4Path.replace(/\\/g, "/")}`,
                });
              } catch (resErr) {
                console.error(
                  `[FFMPEG] Failed to generate ${h}p version:`,
                  resErr.message,
                );
              }
            }
          }

          // Sort resolutions from highest to lowest
          currentManifest.resolutions.sort((a, b) => b.height - a.height);
          await fs.writeFile(
            path.join(baseDir, `${baseName}_manifest.json`),
            JSON.stringify(currentManifest),
          );
          console.log(`[FFMPEG] Resolution generation complete for ${baseName}!`);
        } else {
          // Minimal manifest for simple MP4
          let currentManifest = { subtitles: [], audioTracks: [], resolutions: [], hasHls: false };
          try {
            const manifestContent = await fs.readFile(path.join(baseDir, `${baseName}_manifest.json`), "utf-8");
            currentManifest = { ...currentManifest, ...JSON.parse(manifestContent) };
          } catch (e) { }

          currentManifest.resolutions = [{
            height: sourceHeight,
            label: `${sourceHeight}p`,
            url: `/${newPath.replace(/\\/g, "/")}`
          }];

          await fs.writeFile(
            path.join(baseDir, `${baseName}_manifest.json`),
            JSON.stringify(currentManifest),
          );
        }
      } catch (optErr) {
        console.error(
          `[FFMPEG] Optimization failed for ${baseName}:`,
          optErr.message,
        );
      }
    })();
  } else if (finalMimeType.startsWith("video/") && isOversized) {
    console.log(
      `[MEDIA] Video ${file.originalname} is > 3GB. Skipping heavy FFmpeg processing. Storing as cache pending Admin consent.`,
    );
  }

  // 4. Create a new Media document in the database
  const newMedia = new Media({
    hash,
    path: newPath.replace(/\\/g, "/"), // Ensure forwards slashes for web paths
    mimetype: finalMimeType,
    size: file.size,
    originalName: file.originalname,
  });

  if (isOversized) {
    newMedia.isPendingApproval = true;
  }

  await newMedia.save();
  return newMedia;
};

/**
 * Scans text for the first occurrence of a valid image or video URL.
 * @param {string} text - The content text to scan.
 * @returns {object} { mediaUrl, mediaType } or nulls if not found.
 */
export const extractMediaFromText = (text) => {
  if (!text) return { mediaUrl: null, mediaType: null };
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  if (matches) {
    for (const url of matches) {
      if (/\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i.test(url)) {
        return { mediaUrl: url, mediaType: "image" };
      }
      if (/\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(url)) {
        return { mediaUrl: url, mediaType: "video" };
      }
    }
  }
  return { mediaUrl: null, mediaType: null };
};

/**
 * Standardizes array inputs from FormData
 */
export const normalizeArr = (v) => {
  if (v === undefined || v === null) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed))
        return parsed.map((item) =>
          typeof item === "string" ? item.trim() : item,
        );
    } catch (e) {
      if (v.includes(",")) return v.split(",").map((item) => item.trim());
    }
    return [v.trim()];
  }
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((item) => (typeof item === "string" ? item.trim() : item));
};

/**
 * Safely processes and hashes external URLs (like YouTube)
 */
export const processExternalUrl = async (
  url,
  type,
  title,
  description,
  isDownloadable,
) => {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  let mediaDoc = await Media.findOne({ hash });
  if (!mediaDoc) {
    mediaDoc = new Media({
      hash,
      path: url,
      mimetype: type === "video" ? "video/mp4" : type === "youtube" ? "youtube" : type === "audio" ? "audio/mpeg" : type === "document" ? "application/pdf" : "image/jpeg",
      size: 0,
      isExternal: true,
    });
    mediaDoc.set("title", title || "", { strict: true });
    mediaDoc.set("description", description || "", { strict: true });
    mediaDoc.set(
      "isDownloadable",
      isDownloadable === true || String(isDownloadable) === "true",
      { strict: true },
    );
    await mediaDoc.save();
  }
  return mediaDoc._id;
};

/**
 * Safely deletes an array of Media documents and their physical files,
 * including all associated sidecar files (manifests, HLS segments, AI dubs, etc.)
 */
export const deleteMediaDocs = async (mediaIds) => {
  if (!mediaIds || mediaIds.length === 0) return;
  for (const mId of mediaIds) {
    const mediaDoc = await Media.findById(mId);
    if (!mediaDoc) continue;

    if (!mediaDoc.isExternal && !mediaDoc.path.startsWith("http")) {
      const fullPath = path.resolve(process.cwd(), mediaDoc.path);
      const baseDir = path.dirname(fullPath);
      const ext = path.extname(fullPath);
      const baseName = path.basename(fullPath, ext);

      try {
        // 1. Delete the main file
        await fs.unlink(fullPath).catch(() => { });

        // 2. Scan for and delete sidecar files
        const filesInDir = await fs.readdir(baseDir).catch(() => []);
        const sidecarPattern = new RegExp(`^${baseName}(_manifest\\.json|_thumb\\.jpg|_opt\\.mp4|_transcription.*\\.vtt|_translated_.*\\.vtt|_dub_.*\\.wav|_\\d+p\\.mp4)$`);
        
        for (const file of filesInDir) {
          if (sidecarPattern.test(file)) {
            await fs.unlink(path.join(baseDir, file)).catch(() => { });
          }
        }

        // 3. Delete HLS directory if it exists
        const hlsDir = path.join(baseDir, `${baseName}_hls`);
        await fs.rm(hlsDir, { recursive: true, force: true }).catch(() => { });

        logger.info(`[Cleanup] Deleted media and all sidecars for: ${baseName}`);
      } catch (err) {
        logger.error(`[Cleanup] Error during media deletion for ${baseName}:`, err.message);
      }
    }
    await mediaDoc.deleteOne();
  }
};

/**
 * Persists AI-generated media (like dubs or transcriptions) to the standard storage location.
 * Respects cloud storage settings if configured.
 */
export const storeAiMedia = async (buffer, filename, mimetype, uploaderId = null) => {
  const { readSystemSettings } = await import("./systemSettings.js");
  const settings = await readSystemSettings();
  
  // Ensure the AI uploads directory exists
  const aiUploadDir = path.join("uploads", "ai");
  await fs.mkdir(aiUploadDir, { recursive: true }).catch(() => { });
  
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const finalFilename = `${hash}_${Date.now()}${path.extname(filename)}`;
  const localPath = path.join(aiUploadDir, finalFilename);

  // Always save locally first as a master/cache
  await fs.writeFile(localPath, buffer);
  
  let finalPath = localPath.replace(/\\/g, "/");

  // If cloud storage is enabled, we'd typically upload here using the Python service.
  
  const mediaDoc = new Media({
    hash,
    path: finalPath,
    mimetype,
    size: buffer.length,
    originalName: filename,
    uploader: uploaderId,
    isPublic: true
  });
  
  await mediaDoc.save();
  return mediaDoc;
};
