import React, { useState } from "react";
import { X, ListOrdered, Sparkles, Play } from "lucide-react";
import { generateContent } from "@/services/aiService";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getPrimaryButtonClasses } from "@/utils/themeUtils";

const SmartChaptersMenu = ({ onClose, videoRef, duration }) => {
  const [chapters, setChapters] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { appTheme } = useTheme();

  const generateChapters = async () => {
    if (!duration || !Number.isFinite(duration) || duration <= 0) {
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: "Video duration not available. Cannot generate chapters. ❌",
      }));
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Analyze this video (duration: ${Math.floor(duration)}s) and generate exactly 5 logical smart chapters based on visual and audio context. Format as a pure JSON array: [{"title": "Chapter Name", "time": 0}, {"title": "...", "time": ...}]. Ensure times are in seconds, within duration.`;
      
      const response = await generateContent({ prompt, contentType: "video_chapters" });
      const resText = response.generated_content || response;
      const match = resText.match(/\[[\s\S]*\]/);
      if (match) {
        const raw = JSON.parse(match[0]);
        if (!Array.isArray(raw)) throw new Error("Invalid chapters format");

        const validated = raw
          .filter(ch =>
            ch &&
            typeof ch.title === "string" &&
            ch.title.trim() !== "" &&
            typeof ch.time === "number" &&
            Number.isFinite(ch.time) &&
            ch.time >= 0 &&
            (!duration || ch.time <= duration)
          )
          .map(ch => ({ title: ch.title.trim().slice(0, 100), time: Math.floor(ch.time) }));

        if (validated.length === 0) throw new Error("No valid chapters in response");
        setChapters(validated);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Smart Chapters Generated! ✨" }));
      }
    } catch(e) {
      console.error("Chapter Generation Failed:", e);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to generate chapters. ❌" }));
    } finally {
      setIsGenerating(false);
    }
  };

  const seekTo = (time) => {
    const video = videoRef?.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || Infinity));
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay blocked or video not ready — silently ignore
        if (err.name !== "AbortError") console.warn("Seek play failed:", err);
      });
    }
  };

  const formatTime = (time) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[20000] w-[90vw] sm:w-72 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}>
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm text-inherit flex items-center gap-2"><ListOrdered className="w-4 h-4"/> Smart Chapters</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
      </div>

      {chapters.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs opacity-70 text-center">No chapters found for this video.</p>
          <button onClick={generateChapters} disabled={isGenerating} className={`w-full disabled:opacity-50 text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md ${getPrimaryButtonClasses(appTheme)}`}>
            {isGenerating ? <div className="loader" style={{'--s': '10px', '--g': '2px'}}/> : <><Sparkles className="w-3 h-3"/> Auto-Generate</>}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {chapters.map((ch, i) => (
            <button key={i} onClick={() => seekTo(ch.time)} className="flex items-center justify-between p-2 bg-black/20 hover:bg-white/10 rounded-lg text-left transition-colors border border-inherit/10 text-xs group">
               <span className="font-semibold opacity-90 truncate pr-2 text-inherit">{ch.title}</span>
               <span className="font-mono opacity-60 group-hover:opacity-100 flex items-center gap-1 text-inherit"><Play className="w-3 h-3 opacity-0 group-hover:opacity-100"/> {formatTime(ch.time)}</span>
            </button>
          ))}
          <button onClick={() => setChapters([])} className="mt-2 py-1 text-[10px] uppercase tracking-wider font-bold opacity-50 hover:opacity-100 text-center w-full text-inherit">Clear Chapters</button>
        </div>
      )}
    </div>
  );
};
export default SmartChaptersMenu;
