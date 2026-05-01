import React from "react";
import { Type, Edit2, Zap } from "lucide-react";
import { HIGHLIGHT_STYLES } from "@/utils/textUtils";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses } from "@/utils/themeUtils";

const AIHighlightCustomizer = ({
  highlightStyle,
  setHighlightStyle,
  highlightSpeed,
  setHighlightSpeed,
  textSize,
  setTextSize,
}) => {
  const { appTheme, isDark } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label className="block text-sm font-bold opacity-90 mb-2 flex items-center gap-2">
          <Edit2 className="w-4 h-4" /> Reading Style
        </label>
        <select
          value={highlightStyle}
          onChange={(e) => {
            setHighlightStyle(e.target.value);
            localStorage.setItem("aiHighlightStyle", e.target.value);
          }}
          className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium text-sm"
        >
          {Object.entries(HIGHLIGHT_STYLES).map(([key, style]) => (
            <option
              key={key}
              value={key}
              className={getOptionClasses(appTheme, isDark)}
            >
              {style.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold opacity-90 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Transition Speed
        </label>
        <select
          value={highlightSpeed}
          onChange={(e) => {
            setHighlightSpeed(e.target.value);
            localStorage.setItem("aiHighlightSpeed", e.target.value);
          }}
          className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium text-sm"
        >
          <option
            value="duration-75"
            className={getOptionClasses(appTheme, isDark)}
          >
            Very Fast
          </option>
          <option
            value="duration-150"
            className={getOptionClasses(appTheme, isDark)}
          >
            Fast
          </option>
          <option
            value="duration-300"
            className={getOptionClasses(appTheme, isDark)}
          >
            Normal
          </option>
          <option
            value="duration-500"
            className={getOptionClasses(appTheme, isDark)}
          >
            Smooth
          </option>
          <option
            value="duration-700"
            className={getOptionClasses(appTheme, isDark)}
          >
            Slow
          </option>
          <option
            value="duration-0"
            className={getOptionClasses(appTheme, isDark)}
          >
            Instant (Off)
          </option>
        </select>
      </div>

      <div className="pb-4">
        <label className="block text-sm font-bold opacity-90 mb-2 flex items-center gap-2">
          <Type className="w-4 h-4" /> Text Size
        </label>
        <select
          value={textSize}
          onChange={(e) => {
            setTextSize(e.target.value);
            localStorage.setItem("aiTextSize", e.target.value);
          }}
          className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium text-sm"
        >
          <option
            value="text-sm"
            className={getOptionClasses(appTheme, isDark)}
          >
            Small
          </option>
          <option
            value="text-base"
            className={getOptionClasses(appTheme, isDark)}
          >
            Normal
          </option>
          <option
            value="text-lg"
            className={getOptionClasses(appTheme, isDark)}
          >
            Large
          </option>
          <option
            value="text-xl"
            className={getOptionClasses(appTheme, isDark)}
          >
            Extra Large
          </option>
          <option
            value="text-2xl"
            className={getOptionClasses(appTheme, isDark)}
          >
            Huge
          </option>
        </select>
      </div>
    </div>
  );
};

export default AIHighlightCustomizer;
