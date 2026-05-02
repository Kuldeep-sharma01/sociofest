import { execFile } from "child_process";
import util from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { v4 as uuidv4 } from "uuid";

const execFileAsync = util.promisify(execFile);

/**
 * Separates background sound from source and merges it with new dialogue
 * @param {string} newAudioPath - Path to the generated AI voice file
 * @param {string} sourcePath - Path to the original video/audio file
 * @param {string} outputPath - Where to save the merged result
 */
export const mergeAudioWithBackground = async (newAudioPath, sourcePath, outputPath) => {
  const tempDir = path.join(os.tmpdir(), "sociofest_audio_" + uuidv4());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const bgPath = path.join(tempDir, "background.wav");
    
    // 1. Extract Background (Center-channel removal / Side extraction)
    // This removes center-panned audio (usually vocals) to keep the "surround" background.
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", sourcePath,
      "-af", "pan=stereo|c0=c0-c1|c1=c1-c0", 
      bgPath
    ]);

    // 2. Merge AI Dub with Background
    // amix=inputs=2:duration=longest
    // We lower the background volume slightly (0.6) so the dub is clear.
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", newAudioPath,
      "-i", bgPath,
      "-filter_complex", "[1:a]volume=0.6[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[out]",
      "-map", "[out]",
      "-ac", "2",
      "-ar", "44100",
      outputPath
    ]);

  } finally {
    // Cleanup temp files
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};
