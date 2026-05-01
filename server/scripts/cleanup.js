import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Media from "../models/Media.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the server folder
dotenv.config({ path: path.join(__dirname, "../.env") });

const cleanup = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected. Scanning for redundant files...");

    const uploadsDir = path.join(__dirname, "../uploads");
    const tempDir = path.join(__dirname, "../uploads/temp");

    let deletedFiles = 0;
    let freedSpace = 0; // in bytes

    // 1. Clean Temp Directory (Failed/Aborted Uploads)
    try {
      const tempFiles = await fs.readdir(tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        freedSpace += stats.size;
        await fs.unlink(filePath);
        deletedFiles++;
      }
      console.log(`🧹 Cleaned ${tempFiles.length} temporary files.`);
    } catch (e) {
      console.log("No temp directory to clean.");
    }

    // 2. Clean Orphaned/Cached files recursively
    const validMedia = await Media.find().select("path").lean();
    const validPaths = validMedia.map(m => path.basename(m.path));

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const scanAndClean = async (dir) => {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry === 'temp') continue;
        
        const fullPath = path.join(dir, entry);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanAndClean(fullPath);
          continue;
        }
        
        let shouldDelete = false;
        if (entry.startsWith("sample_") && entry.endsWith(".wav")) shouldDelete = true;
        else if ((entry.startsWith("dub_") || entry.startsWith("trans_")) && stats.mtimeMs < sevenDaysAgo) shouldDelete = true;
        else if (!entry.endsWith("_manifest.json") && !entry.startsWith("dub_") && !entry.startsWith("trans_")) {
          if (!validPaths.includes(entry)) shouldDelete = true;
        }
        
        if (shouldDelete) {
          freedSpace += stats.size;
          await fs.unlink(fullPath);
          deletedFiles++;
        }
      }
    };

    await scanAndClean(uploadsDir);

    const freedMB = (freedSpace / (1024 * 1024)).toFixed(2);
    console.log(`\n🎉 Cleanup Complete!`);
    console.log(`- Zombie Files Deleted: ${deletedFiles}`);
    console.log(`- Space Freed: ${freedMB} MB`);

    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  }
};

cleanup();