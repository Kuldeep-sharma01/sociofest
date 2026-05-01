import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const UploadProgress = ({ progress = 0, fileName = "Uploading file..." }) => {
  const { appTheme } = useTheme();
  const percentage = Math.min(100, Math.max(0, progress));

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${getCardThemeClasses(appTheme)}`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 text-sm text-inherit">
        <span className="truncate font-medium">{fileName}</span>
        <span className="font-semibold">{percentage}%</span>
      </div>
      <div className="h-2 bg-black/10 dark:bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-sky-400 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default UploadProgress;
