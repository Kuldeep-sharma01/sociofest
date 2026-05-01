import React, { useState } from "react";
import { X, Sparkles, Send } from "lucide-react";
import { generateContent } from "@/services/aiService";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getPrimaryButtonClasses } from "@/utils/themeUtils";

export const FILTER_PRESETS = {
  'none': { name: 'None', values: { brightness: 100, contrast: 100, saturate: 100, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'ai_enhance': { name: 'AI Enhance ✨', values: { brightness: 102, contrast: 108, saturate: 125, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'vivid': { name: 'Vivid', values: { brightness: 105, contrast: 110, saturate: 150, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'vintage': { name: 'Vintage', values: { brightness: 95, contrast: 90, saturate: 130, sepia: 40, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'cool': { name: 'Cool Tone', values: { brightness: 100, contrast: 105, saturate: 90, sepia: 15, hueRotate: -5, blur: 0, grayscale: 0, invert: 0 } },
  'warm': { name: 'Warm Tone', values: { brightness: 105, contrast: 100, saturate: 110, sepia: 25, hueRotate: 5, blur: 0, grayscale: 0, invert: 0 } },
  'noir': { name: 'Noir', values: { brightness: 100, contrast: 120, saturate: 0, sepia: 10, hueRotate: 0, blur: 0, grayscale: 100, invert: 0 } },
  'dreamy': { name: 'Dreamy', values: { brightness: 110, contrast: 90, saturate: 110, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'cinematic': { name: 'Cinematic', values: { brightness: 90, contrast: 115, saturate: 85, sepia: 10, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'cyberpunk': { name: 'Cyberpunk', values: { brightness: 105, contrast: 110, saturate: 160, sepia: 0, hueRotate: 300, blur: 0, grayscale: 0, invert: 0 } },
  'matrix': { name: 'Matrix', values: { brightness: 95, contrast: 120, saturate: 120, sepia: 0, hueRotate: 120, blur: 0, grayscale: 0, invert: 0 } },
  'retro_tv': { name: 'Retro TV', values: { brightness: 110, contrast: 85, saturate: 140, sepia: 20, hueRotate: -10, blur: 1, grayscale: 0, invert: 0 } },
  'grayscale': { name: 'Grayscale', values: { brightness: 100, contrast: 110, saturate: 0, sepia: 0, hueRotate: 0, blur: 0, grayscale: 100, invert: 0 } },
  'sepia_deep': { name: 'Deep Sepia', values: { brightness: 90, contrast: 105, saturate: 120, sepia: 80, hueRotate: -10, blur: 0, grayscale: 0, invert: 0 } },
  'high_contrast': { name: 'High Contrast', values: { brightness: 100, contrast: 150, saturate: 100, sepia: 0, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
  'washed_out': { name: 'Washed Out', values: { brightness: 115, contrast: 80, saturate: 60, sepia: 10, hueRotate: 0, blur: 0, grayscale: 0, invert: 0 } },
};

export const filterConstraints = {
  brightness: { min: 0, max: 200, unit: '%' },
  contrast: { min: 0, max: 200, unit: '%' },
  saturate: { min: 0, max: 200, unit: '%' },
  sepia: { min: 0, max: 100, unit: '%' },
  hueRotate: { min: 0, max: 360, unit: 'deg' },
  blur: { min: 0, max: 20, unit: 'px' },
  grayscale: { min: 0, max: 100, unit: '%' },
  invert: { min: 0, max: 100, unit: '%' }
};

const MediaFiltersMenu = ({
  filters,
  setFilters,
  activePreset,
  setActivePreset,
  showCustomFilters,
  setShowCustomFilters,
  onClose,
  resetAll
}) => {
  const { appTheme } = useTheme();

  const [showAiFilters, setShowAiFilters] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const applyPreset = (presetKey) => {
    if (FILTER_PRESETS[presetKey]) {
      setFilters({ ...FILTER_PRESETS['none'].values, ...FILTER_PRESETS[presetKey].values });
      setActivePreset(presetKey);
      setShowCustomFilters(false);
      setShowAiFilters(false);
    }
  };

  const handleFilterSliderChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: Number(value) }));
    setActivePreset('custom');
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const systemPrompt = `You are a professional video color grader. The user wants this visual style applied to their media: "${aiPrompt}".
Respond ONLY with a valid raw JSON object containing these exact keys and numerical values representing CSS filters:
{
  "brightness": 100, // Range: 0-200
  "contrast": 100, // Range: 0-200
  "saturate": 100, // Range: 0-200
  "sepia": 0, // Range: 0-100
  "hueRotate": 0, // Range: 0-360
  "blur": 0, // Range: 0-20
  "grayscale": 0, // Range: 0-100
  "invert": 0 // Range: 0-100
}
Output ONLY the JSON object, absolutely no markdown formatting, no backticks, and no extra text.`;

      const response = await generateContent({ prompt: systemPrompt, contentType: "video_filter" });
      const responseText = response.generated_content || response;
      
      // Securely extract JSON even if AI adds markdown backticks
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}') + 1;
      if (jsonStart === -1 || jsonEnd === 0) throw new Error("Invalid AI response format");
      
      const cleanJson = responseText.substring(jsonStart, jsonEnd);
      const generatedFilters = JSON.parse(cleanJson);
      
      setFilters(prev => ({
        brightness: generatedFilters.brightness ?? prev.brightness,
        contrast: generatedFilters.contrast ?? prev.contrast,
        saturate: generatedFilters.saturate ?? prev.saturate,
        sepia: generatedFilters.sepia ?? prev.sepia,
        hueRotate: generatedFilters.hueRotate ?? prev.hueRotate,
        blur: generatedFilters.blur ?? prev.blur,
        grayscale: generatedFilters.grayscale ?? prev.grayscale,
        invert: generatedFilters.invert ?? prev.invert
      }));
      
      window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Cinematic Grade Applied! ✨" }));
    } catch (error) {
      console.error("AI Color Grade Error:", error);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Failed to generate grade. Please try again. ❌" }));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div 
      className={`fixed sm:absolute top-1/2 sm:top-4 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[100] w-[90vw] sm:w-80 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}
      onWheel={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm text-inherit">Filters</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
          <button key={key} onClick={() => applyPreset(key)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${activePreset === key && !showCustomFilters && !showAiFilters ? 'bg-current text-black border-current shadow-sm' : 'bg-transparent opacity-80 border-inherit/30 hover:bg-white/10'}`}>
            {preset.name}
          </button>
        ))}
        <button onClick={() => { setShowCustomFilters(true); setShowAiFilters(false); setActivePreset('custom'); }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showCustomFilters ? 'bg-current text-black border-current shadow-sm' : 'bg-transparent opacity-80 border-inherit/30 hover:bg-white/10'}`}>
          Custom
        </button>
        <button onClick={() => { setShowAiFilters(true); setShowCustomFilters(false); setActivePreset('ai_custom'); }} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 ${showAiFilters ? 'bg-current text-black border-current shadow-sm' : 'bg-transparent opacity-80 border-inherit/30 hover:bg-white/10'}`}>
          <Sparkles className="w-3 h-3"/> AI Grade
        </button>
      </div>
      
      {showCustomFilters && (
        <div className="border-t border-inherit/20 pt-4 mt-4 animate-in fade-in">
          <h4 className="font-bold text-xs mb-3 uppercase tracking-wider text-inherit">Custom Adjustments</h4>
          <div className="max-h-48 overflow-y-auto pr-2 flex flex-col gap-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
          {Object.entries(filterConstraints).map(([key, config]) => (
            <div key={key}>
              <div className="flex justify-between text-xs opacity-80 mb-1 capitalize">
                <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                <span>{filters[key]}{config.unit}</span>
              </div>
              <input 
                type="range" 
                min={config.min} max={config.max} 
                value={filters[key]} 
                onChange={(e) => handleFilterSliderChange(key, e.target.value)}
                className="w-full accent-current cursor-pointer"
              />
            </div>
          ))}
          </div>
        </div>
      )}

      {showAiFilters && (
        <div className="border-t border-inherit/20 pt-4 mt-4 animate-in fade-in">
          <h4 className="font-bold text-xs mb-3 uppercase tracking-wider flex items-center gap-1 opacity-90 text-inherit">
            <Sparkles className="w-3 h-3" /> AI Color Director
          </h4>
          <div className="flex flex-col gap-3">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the video and vibe (e.g., 'A nature shot, give it a warm dreamy aesthetic')"
              className="w-full bg-black/40 border border-inherit/30 rounded-lg text-xs text-inherit p-2 outline-none focus:border-current resize-none h-20 placeholder:opacity-40"
            />
            <button
              onClick={handleAIGenerate}
              disabled={isGeneratingAi || !aiPrompt.trim()}
              className={`w-full disabled:opacity-50 text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md ${getPrimaryButtonClasses(appTheme)}`}
            >
              {isGeneratingAi ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Apply AI Grade <Send className="w-3 h-3" /></>
              )}
            </button>
          </div>
        </div>
      )}

      <button onClick={resetAll} className="w-full mt-4 py-1.5 bg-black/20 border border-inherit/20 hover:bg-white/10 text-inherit font-bold opacity-80 hover:opacity-100 text-xs rounded-lg transition-colors">
        Reset
      </button>
    </div>
  );
};

export default MediaFiltersMenu;
