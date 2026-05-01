import React from "react";
import { Type, PaintBucket, Layers, Droplet, ArrowUpDown } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses } from "@/utils/themeUtils";

const SubtitleCustomizer = ({ settings, onChange, onReset }) => {
  const update = (key, val) => {
    console.log(`[SubtitleCustomizer] Successfully Updated: ${key} =`, val);
    onChange(prev => ({ ...prev, [key]: val }));
  };

  const { appTheme, isDark } = useTheme();

  return (
    <div 
      className="flex flex-col gap-4 p-4 bg-black/20 rounded-xl border border-inherit/20 animate-in fade-in zoom-in-95 duration-200 mt-2 shadow-inner text-inherit"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs opacity-80 font-semibold flex items-center gap-1.5"><Type className="w-3.5 h-3.5"/> Font Size</span>
          <span className="text-[10px] font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded opacity-90">{settings.fontSize || 100}%</span>
        </div>
        <input 
          type="range" min="50" max="300" step="10" 
          value={settings.fontSize || 100} 
          onChange={(e) => update("fontSize",  Number(e.target.value))} 
          className="w-full h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"
        />
      </div>
      
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs opacity-80 font-semibold flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5"/> Vertical Shift</span>
          <span className="text-[10px] font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded opacity-90">{settings.positionY || 0}px</span>
        </div>
        <input 
          type="range" min="0" max="300" step="10" 
          value={settings.positionY || 0}
          onChange={(e) => update("positionY", Number(e.target.value))} 
          className="w-full h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs opacity-80 font-semibold flex items-center gap-1.5"><PaintBucket className="w-3.5 h-3.5"/> Text Color</span>
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-inherit/10">
             <input type="color" value={settings.color || "#ffffff"} onChange={(e) => update("color", e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"/>
             <span className="text-[10px] font-mono font-bold opacity-80 uppercase">{settings.color || "#ffffff"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs opacity-80 font-semibold flex items-center gap-1.5"><Layers className="w-3.5 h-3.5"/> Bg Color</span>
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-lg border border-inherit/10">
             <input type="color" value={settings.bgColor || "#000000"} onChange={(e) => update("bgColor", e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"/>
             <span className="text-[10px] font-mono font-bold opacity-80 uppercase">{settings.bgColor || "#000000"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs opacity-80 font-semibold flex items-center gap-1.5"><Droplet className="w-3.5 h-3.5"/> Bg Opacity</span>
          <span className="text-[10px] font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded opacity-90">{Math.round((settings.bgOpacity ?? 0.8) * 100)}%</span>
        </div>
        <input 
          type="range" min="0" max="1" step="0.1" 
          value={settings.bgOpacity ?? 0.8} 
          onChange={(e) => update("bgOpacity", Number(e.target.value))} 
          className="w-full h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs opacity-80 font-semibold">Font Family</span>
          <select value={settings.fontFamily || "sans-serif"} onChange={(e) => update("fontFamily", e.target.value)} className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs font-semibold text-inherit p-2 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer w-full">
            <option value="sans-serif" className={getOptionClasses(appTheme, isDark)}>Sans-Serif (Default)</option>
            <option value="serif" className={getOptionClasses(appTheme, isDark)}>Serif</option>
            <option value="monospace" className={getOptionClasses(appTheme, isDark)}>Monospace</option>
            <option value="cursive" className={getOptionClasses(appTheme, isDark)}>Comic</option>
            <option value="fantasy" className={getOptionClasses(appTheme, isDark)}>Impact</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs opacity-80 font-semibold">Edge Style</span>
          <select value={settings.textShadow || "drop-shadow"} onChange={(e) => update("textShadow", e.target.value)} className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs font-semibold text-inherit p-2 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer w-full">
            <option value="none" className={getOptionClasses(appTheme, isDark)}>None</option>
            <option value="drop-shadow" className={getOptionClasses(appTheme, isDark)}>Drop Shadow</option>
            <option value="raised" className={getOptionClasses(appTheme, isDark)}>Raised</option>
            <option value="depressed" className={getOptionClasses(appTheme, isDark)}>Depressed</option>
            <option value="uniform" className={getOptionClasses(appTheme, isDark)}>Uniform</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center mt-2 border-t border-inherit/10 pt-3">
          <span className="text-xs opacity-80 font-bold flex items-center gap-1.5">Custom Render Engine</span>
          <input 
            type="checkbox" 
            checked={settings.useCustomEngine ?? true} 
            onChange={(e) => update("useCustomEngine", e.target.checked)} 
            className="w-4 h-4 accent-current cursor-pointer"
          />
        </div>
        <p className="text-[10px] opacity-50 leading-tight">
          Bypasses browser restrictions for guaranteed style application.
        </p>
      </div>

      {onReset && (
        <div className="pt-2 border-t border-inherit/10 mt-2">
          <button onClick={onReset} className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-bold rounded-lg transition-colors">
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
};

export default SubtitleCustomizer;
