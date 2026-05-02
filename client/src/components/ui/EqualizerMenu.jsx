import React from "react";
import { X, Mic } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getOptionClasses } from "@/utils/themeUtils";

export const EQ_PRESETS = {
  'flat': { name: 'Flat', values: { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 }, bass: 0, treble: 0 },
  'acoustic': { name: 'Acoustic', values: { 60: 4, 230: 4, 910: 3, 3600: 1, 14000: 2 }, bass: 2, treble: 1 },
  'bass_booster': { name: 'Bass Booster', values: { 60: 6, 230: 5, 910: 0, 3600: 1, 14000: 2 }, bass: 8, treble: 0 },
  'classical': { name: 'Classical', values: { 60: 4, 230: 3, 910: -2, 3600: 3, 14000: 4 }, bass: 0, treble: 2 },
  'dance': { name: 'Dance', values: { 60: 6, 230: 2, 910: 1, 3600: 4, 14000: 5 }, bass: 4, treble: 3 },
  'electronic': { name: 'Electronic', values: { 60: 5, 230: 3, 910: -1, 3600: 2, 14000: 4 }, bass: 5, treble: 4 },
  'hip_hop': { name: 'Hip-Hop', values: { 60: 6, 230: 4, 910: 0, 3600: -1, 14000: 2 }, bass: 6, treble: 1 },
  'jazz': { name: 'Jazz', values: { 60: 3, 230: 2, 910: -2, 3600: 2, 14000: 4 }, bass: 2, treble: 3 },
  'pop': { name: 'Pop', values: { 60: -1, 230: 2, 910: 4, 3600: 2, 14000: -1 }, bass: 0, treble: 1 },
  'rock': { name: 'Rock', values: { 60: 5, 230: 3, 910: -1, 3600: 3, 14000: 5 }, bass: 3, treble: 4 },
};

const EqualizerMenu = ({
  onClose,
  activeEqPreset,
  applyEqPreset,
  setActiveEqPreset,
  eqValues = { 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 },
  handleEqChange,
  bassBoost,
  handleBassChange,
  trebleBoost,
  handleTrebleChange,
  activeVoiceEffect,
  setActiveVoiceEffect,
  voiceEffectIntensity,
  setVoiceEffectIntensity,
  balance,
  handleBalanceChange
}) => {
  const { appTheme, isDark } = useTheme();

  return (
    <div 
      className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[20000] w-[90vw] sm:w-72 md:w-80 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}
      onWheel={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm text-inherit">Equalizer & Audio</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 text-inherit"><X className="w-4 h-4"/></button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="opacity-80 text-xs font-bold text-inherit">Presets</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
          {Object.entries(EQ_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyEqPreset(key)}
              className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
                activeEqPreset === key
                  ? 'bg-current text-black border-current shadow-sm'
                  : 'bg-transparent opacity-80 border-inherit/30 hover:bg-white/10 text-inherit'
              }`}
            >
              {preset.name}
            </button>
          ))}
          <button
            onClick={() => setActiveEqPreset('custom')}
            className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
              activeEqPreset === 'custom'
                ? 'bg-current text-black border-current shadow-sm'
                : 'bg-transparent opacity-80 border-inherit/30 hover:bg-white/10 text-inherit'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="flex justify-between h-40 items-end pb-2 gap-2 mt-4">
        {[60, 230, 910, 3600, 14000].map(freq => (
          <div key={freq} className="flex flex-col items-center gap-3 h-full flex-1">
            <span className="opacity-80 text-[10px] font-mono h-4 text-inherit">{eqValues[freq] > 0 ? '+' : ''}{eqValues[freq]}</span>
            <div className="relative h-24 w-4 flex items-center justify-center">
              <input type="range" min="-12" max="12" step="1" value={eqValues[freq]} onChange={(e) => handleEqChange(freq, e.target.value)} className="absolute w-24 h-1.5 bg-black/40 rounded-lg accent-current cursor-pointer -rotate-90" />
            </div>
            <span className="opacity-50 text-[10px] font-bold h-4 text-inherit">{freq >= 1000 ? `${freq/1000}k` : freq}</span>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-between mt-4">
          <span className="opacity-80 text-xs font-bold text-inherit">Bass</span>
          <input type="range" min="-24" max="24" step="1" value={bassBoost} onChange={handleBassChange} className="w-32 h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"/>
          <span className="opacity-50 text-xs font-mono text-inherit">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</span>
      </div>
      <div className="flex items-center justify-between mt-2">
          <span className="opacity-80 text-xs font-bold text-inherit">Treble</span>
          <input type="range" min="-24" max="24" step="1" value={trebleBoost} onChange={handleTrebleChange} className="w-32 h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"/>
          <span className="opacity-50 text-xs font-mono text-inherit">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</span>
      </div>
<div className="flex flex-col gap-2">
  <div className="flex justify-between items-center text-xs font-bold">
    <span className="text-inherit/70">Balance</span>
    <span className="text-inherit w-10 text-center">
      {balance === 0 ? 'C' : balance < 0 ? `L ${Math.abs(balance * 100).toFixed(0)}` : `R ${Math.abs(balance * 100).toFixed(0)}`}
    </span>
  </div>
  <input
    type="range"
    min="-1"
    max="1"
    step="0.05"
    value={balance}
    onChange={handleBalanceChange}
    className="w-full h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"
  />
</div>
      <div className="flex flex-col mt-4 pt-3 border-t border-inherit/20 gap-2">
        <div className="flex items-center justify-between">
            <span className="opacity-80 text-xs font-bold flex items-center gap-1 text-inherit"><Mic className="w-3 h-3"/> Voice Effect</span>
              <select value={activeVoiceEffect} onChange={(e) => setActiveVoiceEffect(e.target.value)} className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-xs text-inherit p-1.5 focus:outline-none focus:ring-2 focus:ring-current cursor-pointer w-28 text-center">
                <option value="none" className={getOptionClasses(appTheme, isDark)}>Normal</option><option value="robot" className={getOptionClasses(appTheme, isDark)}>🤖 Robot</option><option value="alien" className={getOptionClasses(appTheme, isDark)}>👽 Alien</option><option value="telephone" className={getOptionClasses(appTheme, isDark)}>📞 Radio</option><option value="echo" className={getOptionClasses(appTheme, isDark)}>🗣️ Echo</option><option value="muffled" className={getOptionClasses(appTheme, isDark)}>🧦 Muffled</option><option value="megaphone" className={getOptionClasses(appTheme, isDark)}>📢 Megaphone</option><option value="underwater" className={getOptionClasses(appTheme, isDark)}>🌊 Underwater</option><option value="cave" className={getOptionClasses(appTheme, isDark)}>🦇 Cave</option>
            </select>
        </div>
        {activeVoiceEffect !== 'none' && (
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1">
            <span className="opacity-60 text-[10px] font-bold text-inherit">Intensity</span>
            <input type="range" min="0" max="100" step="1" value={voiceEffectIntensity} onChange={(e) => setVoiceEffectIntensity(Number(e.target.value))} className="w-24 h-1.5 bg-black/40 rounded-lg appearance-none accent-current cursor-pointer"/>
            <span className="opacity-50 text-[10px] font-mono w-6 text-right text-inherit">{voiceEffectIntensity}%</span>
          </div>
        )}
      </div>

      <button onClick={() => {
        applyEqPreset('flat');
        setActiveVoiceEffect('none');
        setVoiceEffectIntensity(100);
        if (handleBalanceChange) handleBalanceChange({ target: { value: 0 } });
      }} className="w-full mt-4 py-1.5 bg-black/20 border border-inherit/20 hover:bg-white/10 text-inherit font-bold opacity-80 hover:opacity-100 text-xs rounded-lg transition-colors">
        Reset Flat
      </button>
    </div>
  );
};

export default EqualizerMenu;
