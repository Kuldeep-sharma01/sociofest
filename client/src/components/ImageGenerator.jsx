/**
 * Image Generator Component
 * Demonstrates how to integrate Stable Diffusion into Sociofest React app
 * 
 * Features:
 * - Text-to-image generation
 * - Model selection
 * - Generation parameters control
 * - Image download/save
 * - Loading states and error handling
 */

import React, { useState, useEffect } from 'react';
import { generateMediaContent, getAiConfig } from '@/services/aiClient';
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses, getOptionClasses } from "@/utils/themeUtils";
import { Sparkles, Download, RefreshCw, AlertCircle, Image as ImageIcon, Info, Wand2, Palette, Sun } from "lucide-react";

const ImageGenerator = () => {
  // State management
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [style, setStyle] = useState('');
  const [lighting, setLighting] = useState('');
  const [autoEnhance, setAutoEnhance] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);
  const [activeProvider, setActiveProvider] = useState('pollinations');
  
  const { appTheme, isDark } = useTheme();

  useEffect(() => {
    const config = getAiConfig();
    setActiveProvider(config.provider || 'pollinations');
  }, []);

  const handleGenerateImage = async (e) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalPrompt = prompt.trim();
      if (style) finalPrompt += `, ${style}`;
      if (lighting) finalPrompt += `, ${lighting}`;
      finalPrompt += `, symmetrical natural face matching eye colors --enhance ${autoEnhance}`;

      const response = await generateMediaContent(finalPrompt, "image", activeProvider, null, null, null, aspectRatio);
      setGeneratedImage({
        data: response.url,
        filename: `AI_Generated_${Date.now()}.png`,
      });
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Image generated successfully! ✨" }));
    } catch (err) {
      setError(err.message || 'Generation failed');
      console.error('Generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage?.data) return;

    try {
      // Safely fetch and download whether it's a blob, base64, or cross-origin URL
      const res = await fetch(generatedImage.data);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generatedImage.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Image downloaded! 📥" }));
    } catch (err) {
      // Fallback for strict CORS configurations
      const link = document.createElement('a');
      link.href = generatedImage.data;
      link.download = generatedImage.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClearImage = () => {
    setGeneratedImage(null);
    setPrompt('');
  };

  return (
    <div className={`p-6 md:p-8 rounded-2xl shadow-sm border transition-colors w-full max-w-4xl mx-auto ${getCardThemeClasses(appTheme)}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-inherit/20 pb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
          <ImageIcon className="w-6 h-6 text-purple-500" /> AI Image Generator
        </h2>
        <div className="px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 shadow-sm bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="uppercase tracking-wider">{activeProvider} Ready</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-sm rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleGenerateImage} className="flex flex-col gap-6">
        {/* Prompt Input */}
        <div className="flex flex-col gap-2">
          <label htmlFor="prompt" className="text-sm font-bold opacity-90 text-inherit">
            What do you want to create?
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'a serene mountain landscape with a blue sky and birds flying'"
            maxLength={1000}
            disabled={loading}
            className="w-full bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-xl text-sm text-inherit p-4 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-24 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div className="text-right text-xs opacity-60 font-mono">{prompt.length}/1000</div>
        </div>

        {/* Parameters Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-black/5 dark:bg-white/5 p-5 rounded-xl border border-inherit/20">
          <div className="flex flex-col gap-2">
            <label htmlFor="aspectRatio" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80 text-inherit">
               Aspect Ratio
            </label>
            <select
              id="aspectRatio"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              disabled={loading}
              className="w-full bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-sm text-inherit p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <option value="1:1" className={getOptionClasses(appTheme, isDark)}>1:1 (Square)</option>
              <option value="16:9" className={getOptionClasses(appTheme, isDark)}>16:9 (Landscape)</option>
              <option value="9:16" className={getOptionClasses(appTheme, isDark)}>9:16 (Portrait)</option>
              <option value="4:3" className={getOptionClasses(appTheme, isDark)}>4:3 (Standard)</option>
              <option value="3:4" className={getOptionClasses(appTheme, isDark)}>3:4 (Vertical)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="style" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80 text-inherit">
              <Palette className="w-3.5 h-3.5" /> Art Style
            </label>
            <select
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              disabled={loading}
              className="w-full bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-sm text-inherit p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <option value="" className={getOptionClasses(appTheme, isDark)}>None (Default)</option>
              <option value="Photorealistic, 8k, highly detailed, sharp focus" className={getOptionClasses(appTheme, isDark)}>Photorealistic</option>
              <option value="Cinematic, dramatic lighting, movie still, epic" className={getOptionClasses(appTheme, isDark)}>Cinematic</option>
              <option value="Anime style, Studio Ghibli, masterpiece, vibrant" className={getOptionClasses(appTheme, isDark)}>Anime</option>
              <option value="3D Render, Unreal Engine 5, octane render, intricate" className={getOptionClasses(appTheme, isDark)}>3D Render</option>
              <option value="Watercolor painting, soft edges, artistic, expressive" className={getOptionClasses(appTheme, isDark)}>Watercolor</option>
              <option value="Cyberpunk, synthwave, neon, futuristic" className={getOptionClasses(appTheme, isDark)}>Cyberpunk</option>
              <option value="Vintage, retro, sepia tone, nostalgic" className={getOptionClasses(appTheme, isDark)}>Vintage</option>
              <option value="Abstract art, surrealism, imaginative, colorful" className={getOptionClasses(appTheme, isDark)}>Abstract</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="lighting" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80 text-inherit">
              <Sun className="w-3.5 h-3.5" /> Scenery / Lighting
            </label>
            <select
              id="lighting"
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
              disabled={loading}
              className="w-full bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-sm text-inherit p-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <option value="" className={getOptionClasses(appTheme, isDark)}>None (Default)</option>
              <option value="Golden hour, warm sunlight, beautiful sunset" className={getOptionClasses(appTheme, isDark)}>Golden Hour</option>
              <option value="Neon lighting, vivid glowing colors" className={getOptionClasses(appTheme, isDark)}>Neon</option>
              <option value="Dark and moody, low key lighting, shadows" className={getOptionClasses(appTheme, isDark)}>Dark & Moody</option>
              <option value="Studio lighting, professional photography, clean background" className={getOptionClasses(appTheme, isDark)}>Studio Lighting</option>
              <option value="Foggy atmosphere, mysterious, mist, ethereal" className={getOptionClasses(appTheme, isDark)}>Foggy / Mist</option>
              <option value="Volumetric lighting, god rays, majestic" className={getOptionClasses(appTheme, isDark)}>Volumetric / God Rays</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-3 pt-3 border-t border-inherit/20 mt-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold opacity-90 hover:opacity-100 transition-opacity">
              <input 
                type="checkbox" 
                checked={autoEnhance} 
                onChange={(e) => setAutoEnhance(e.target.checked)} 
                disabled={loading}
                className="w-4 h-4 accent-purple-500 cursor-pointer" 
              />
              <Wand2 className="w-4 h-4 text-purple-500" /> Auto-Refine Prompt using AI
            </label>
            <span className="text-xs opacity-60 hidden sm:block">(Online providers or local AI will automatically add details to your prompt)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
          >
            {loading ? (
              <>
                <div className="loader" style={{'--s': '15px', '--g': '3px'}} /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Generate Image
              </>
            )}
          </button>

          {generatedImage && (
            <button
              type="button"
              onClick={handleClearImage}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-black/5 dark:bg-white/5 border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-inherit"
            >
              <RefreshCw className="w-5 h-5" /> New Image
            </button>
          )}
        </div>
      </form>

      {/* Generated Image Display */}
      {generatedImage && (
        <div className="mt-8 pt-8 border-t border-inherit/20 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-inherit"><ImageIcon className="w-5 h-5" /> Generated Result</h3>
          <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-inherit/20 flex flex-col items-center">
          <img
            src={generatedImage.data}
            alt="Generated"
            referrerPolicy="no-referrer"
className="w-full max-w-2xl rounded-xl shadow-md border border-inherit/10 mb-6 object-contain bg-black/5 min-h-[200px] image-rendering-auto"
          />
            <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-2xl gap-4">
              <p className="text-xs font-mono opacity-60 text-inherit truncate max-w-[200px] sm:max-w-[300px]">
                {generatedImage.filename}
              </p>
            <button
              onClick={handleDownloadImage}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm transition-transform active:scale-95 w-full sm:w-auto justify-center"
            >
                <Download className="w-4 h-4" /> Download Image
            </button>
          </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[1000] animate-in fade-in">
          <div className={`p-8 rounded-2xl shadow-2xl flex flex-col items-center border ${getCardThemeClasses(appTheme)}`}>
            <div className="loader mb-6" style={{'--s': '25px', '--g': '5px', 'color': '#a855f7'}} />
            <p className="font-bold text-lg text-inherit">Generating your image...</p>
            <p className="text-xs opacity-60 mt-2 text-inherit max-w-[250px] text-center">
              This may take 1-5 minutes depending on the model and steps selected.
            </p>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 text-inherit">
        <h4 className="font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-3">
          <Info className="w-5 h-5" /> Tips for Better Results
        </h4>
        <ul className="list-disc pl-5 space-y-2 text-sm opacity-80">
          <li><b>Be specific:</b> "oil painting of a sunset over mountains" vs "sunset"</li>
          <li><b>Include style:</b> "anime style", "photorealistic", "digital art"</li>
          <li><b>Mention artist names:</b> "in the style of Van Gogh"</li>
          <li><b>Use negative prompts</b> to avoid unwanted elements (e.g., "blurry, low quality")</li>
          <li>Increase <b>Quality Steps</b> for more details (but slower generation)</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageGenerator;
