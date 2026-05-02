import React from "react";
import { X, Volume2, Subtitles, Upload, Settings2, Sparkles } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getOptionClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
import SubtitleCustomizer from "./SubtitleCustomizer";

const TrackSelectionMenu = ({
  onClose,
  audioTracks = [],
  activeAudioTrack,
  handleAudioTrackChange,
  textTracks = [],
  activeTextTrack,
  handleTextTrackChange,
  subtitleInputRef,
  showSubSettings,
  setShowSubSettings,
  subStyle,
  setSubStyle,
  defaultSubtitleStyle,
  sourceLang,
  setSourceLang,
  targetLang,
  setTargetLang,
  targetVoice,
  setTargetVoice,
  isTranslating,
  handleAITranslate
}) => {
  const { appTheme, isDark } = useTheme();
  const [multiSpeaker, setMultiSpeaker] = React.useState(false);

  return (
    <div 
      className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[20000] w-[90vw] sm:w-72 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}
      onWheel={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm text-inherit">Tracks & Subtitles</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
      </div>
      
      <div className="flex flex-col gap-4 max-h-64 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {/* Audio Tracks */}
        {audioTracks.length > 0 && (
          <div>
            <h4 className="opacity-80 font-bold text-xs mb-2 uppercase tracking-wider flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> Audio Tracks
            </h4>
            <div className="flex flex-col gap-1">
              {audioTracks.map((track, idx) => (
                <button
                  key={`audio-${idx}`}
                  onClick={() => handleAudioTrackChange(idx)}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors border border-transparent ${activeAudioTrack === idx ? 'bg-current text-black font-bold shadow-sm' : 'opacity-80 hover:bg-white/10 hover:border-inherit/30'}`}
                >
                  {track.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subtitles */}
        <div>
          <h4 className="opacity-80 font-bold text-xs mb-2 uppercase tracking-wider flex items-center gap-1 mt-2">
            <Subtitles className="w-3 h-3" /> Subtitles
          </h4>
          <div className="flex flex-col gap-1">
            <button onClick={() => handleTextTrackChange(-1)} className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors border border-transparent ${activeTextTrack === -1 ? 'bg-current text-black font-bold shadow-sm' : 'opacity-80 hover:bg-white/10 hover:border-inherit/30'}`}>
              None (Off)
            </button>
            {textTracks.map((track, idx) => (
              <button key={`text-${idx}`} onClick={() => handleTextTrackChange(idx)} className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors border border-transparent ${activeTextTrack === idx ? 'bg-current text-black font-bold shadow-sm' : 'opacity-80 hover:bg-white/10 hover:border-inherit/30'}`}>
                {track.label}
              </button>
            ))}
            
            <button onClick={() => subtitleInputRef.current?.click()} className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors border border-dashed border-inherit/30 mt-2 opacity-80 hover:bg-white/10 flex items-center gap-2`}>
              <Upload className="w-3 h-3"/> Load from file (.srt / .vtt)
            </button>

            {/* Custom Subtitle Appearance Menu */}
            <button onClick={(e) => { e.stopPropagation(); setShowSubSettings(!showSubSettings); }} className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors border border-inherit/20 mt-4 opacity-80 hover:bg-white/10 flex items-center justify-between ${showSubSettings ? 'bg-white/10' : ''}`}>
              <span className="flex items-center gap-2"><Settings2 className="w-3 h-3"/> Subtitle Appearance</span>
            </button>
            
            {showSubSettings && (
              <SubtitleCustomizer settings={subStyle} onChange={setSubStyle} onReset={() => setSubStyle(defaultSubtitleStyle)} />
            )}
          </div>
        </div>

        {/* AI Translation UI */}
        <div className="mt-4 pt-3 border-t border-inherit/20">
          <h4 className="opacity-80 font-bold text-xs mb-2 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 opacity-90" /> AI Translate
          </h4>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] opacity-50 uppercase px-1">Original</label>
                  <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs text-inherit p-1.5 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer">
                    <option value="Auto-Detect" className={getOptionClasses(appTheme, isDark)}>Auto-Detect</option><option value="English" className={getOptionClasses(appTheme, isDark)}>English</option><option value="Spanish" className={getOptionClasses(appTheme, isDark)}>Spanish</option><option value="French" className={getOptionClasses(appTheme, isDark)}>French</option><option value="Hindi" className={getOptionClasses(appTheme, isDark)}>Hindi</option><option value="German" className={getOptionClasses(appTheme, isDark)}>German</option><option value="Japanese" className={getOptionClasses(appTheme, isDark)}>Japanese</option><option value="Arabic" className={getOptionClasses(appTheme, isDark)}>Arabic</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] opacity-50 uppercase px-1">Translate To</label>
                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs text-inherit p-1.5 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer">
                    <option value="English" className={getOptionClasses(appTheme, isDark)}>English</option><option value="Spanish" className={getOptionClasses(appTheme, isDark)}>Spanish</option><option value="French" className={getOptionClasses(appTheme, isDark)}>French</option><option value="Hindi" className={getOptionClasses(appTheme, isDark)}>Hindi</option><option value="German" className={getOptionClasses(appTheme, isDark)}>German</option><option value="Japanese" className={getOptionClasses(appTheme, isDark)}>Japanese</option><option value="Arabic" className={getOptionClasses(appTheme, isDark)}>Arabic</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
                <select disabled={multiSpeaker} value={targetVoice} onChange={(e) => setTargetVoice(e.target.value)} className="flex-1 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs text-inherit p-1.5 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer disabled:opacity-50" title="Voice Gender">
                    <option value="Auto" className={getOptionClasses(appTheme, isDark)}>Auto Voice</option><option value="Male" className={getOptionClasses(appTheme, isDark)}>Male Voice</option><option value="Female" className={getOptionClasses(appTheme, isDark)}>Female Voice</option>
              </select>
            </div>
            <div className="flex justify-between items-center mt-1 px-1">
               <label className="text-[10px] opacity-80 uppercase font-bold flex items-center gap-1.5">Multi-Speaker Dubbing</label>
               <input type="checkbox" checked={multiSpeaker} onChange={e => setMultiSpeaker(e.target.checked)} className="w-3 h-3 accent-current cursor-pointer" />
            </div>
        <button onClick={handleAITranslate} disabled={isTranslating} className={`w-full disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-md ${getPrimaryButtonClasses(appTheme)}`}>
              {isTranslating ? <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"/> : 'Translate & Dub'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackSelectionMenu;
