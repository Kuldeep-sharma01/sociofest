import React from "react";
import { Activity } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme } from "@/utils/themeUtils";

const MediaStatsMenu = ({ videoStats }) => {
  const { appTheme } = useTheme();

  return (
    <div className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-auto right-auto sm:right-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-xl shadow-2xl z-[100] w-[90vw] sm:w-64 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-right-4 pointer-events-none border ${getPanelTheme(appTheme)}`}>
      <h3 className="font-bold text-sm flex items-center gap-2 mb-3 border-b border-inherit/20 pb-2 text-inherit"><Activity className="w-4 h-4"/> Codec & Stats</h3>
      <div className="flex flex-col gap-1.5 text-xs font-mono">
        <div className="flex justify-between"><span className="opacity-60">Resolution:</span> <span className="font-bold">{videoStats.resolution}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Dropped Frames:</span> <span className="font-bold">{videoStats.droppedFrames} / {videoStats.totalFrames}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Current Time:</span> <span className="font-bold">{videoStats.currentTime}s</span></div>
        <div className="flex justify-between"><span className="opacity-60">Est. Bitrate:</span> <span className="font-bold">{videoStats.bitrate}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Decode Tech:</span> <span className="font-bold">{videoStats.codec}</span></div>
        <div className="flex justify-between"><span className="opacity-60">Network State:</span> <span className="font-bold">{videoStats.networkState}</span></div>
      </div>
    </div>
  );
};

export default MediaStatsMenu;
