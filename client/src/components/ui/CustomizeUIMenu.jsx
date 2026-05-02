import React from "react";
import { X, LayoutTemplate, GripVertical, Plus } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getOptionClasses } from "@/utils/themeUtils";

const CustomizeUIMenu = ({
  uiPrefs = { toolbarPosition: 'top', showLabels: false, toolbarOrder: [], hiddenTools: [] },
  setUiPrefs,
  UI_LABELS,
  onClose,
  handleDragStart,
  handleDragOver,
  handleDrop,
  moveTool
}) => {
  const { appTheme, isDark } = useTheme();

  return (
    <div 
      className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[20000] w-[90vw] sm:w-80 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}
      onWheel={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm flex items-center gap-2 text-inherit"><LayoutTemplate className="w-4 h-4"/> Customize UI</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
      </div>
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
         <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg mb-2 border border-inherit/10">
           <span className="opacity-80 text-xs font-semibold">Toolbar Position</span>
           <select 
             value={uiPrefs.toolbarPosition} 
             onChange={e => setUiPrefs(prev => ({...prev, toolbarPosition: e.target.value}))}
            className="bg-black/5 dark:bg-white/5 text-inherit text-xs font-bold border border-inherit/30 rounded p-1 focus:outline-none focus:ring-2 focus:ring-current"
           >
            <option value="top" className={getOptionClasses(appTheme, isDark)}>Top Left</option>
            <option value="bottom" className={getOptionClasses(appTheme, isDark)}>Above Controls</option>
            <option value="floating" className={getOptionClasses(appTheme, isDark)}>Free Floating</option>
           </select>
         </div>
         <label className="flex items-center justify-between bg-black/20 p-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors mb-2 border border-inherit/10">
           <span className="opacity-80 text-xs font-semibold">Show Button Labels</span>
           <input type="checkbox" checked={uiPrefs.showLabels} onChange={e => setUiPrefs(prev => ({...prev, showLabels: e.target.checked}))} className="accent-current w-4 h-4" />
         </label>
         
         <div className="max-h-[50vh] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full flex flex-col gap-4">
            {/* Active Tools Dropzone */}
            <div>
              <h4 className="opacity-90 text-xs font-bold mb-2 uppercase tracking-wider flex justify-between">
                <span>Active Tools</span>
                <span className="bg-current/20 px-1.5 rounded text-inherit">{uiPrefs.toolbarOrder.length}</span>
              </h4>
              <div className="flex flex-col gap-1.5" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'active', uiPrefs.toolbarOrder.length)}>
                {uiPrefs.toolbarOrder.map((tool, index) => (
                  <div key={tool} draggable onDragStart={(e) => handleDragStart(e, tool, 'active')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'active', index)} className="p-2 bg-black/20 rounded-lg flex items-center gap-3 cursor-grab active:cursor-grabbing border border-inherit/10 hover:border-inherit/30 transition-colors">
                    <GripVertical className="w-4 h-4 opacity-40" />
                    <span className="opacity-90 text-xs font-semibold flex-1">{UI_LABELS[tool]}</span>
                    <button onClick={() => moveTool(tool, 'hidden')} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors" title="Hide">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {uiPrefs.toolbarOrder.length === 0 ? <div className="opacity-40 text-[10px] text-center border border-dashed border-inherit/20 p-2 rounded-lg">Drag items here</div> : null}
              </div>
            </div>
            {/* Hidden Tools Dropzone */}
            <div>
              <h4 className="opacity-90 text-xs font-bold mb-2 uppercase tracking-wider flex justify-between pt-2 border-t border-inherit/10">
                <span>Hidden Tools</span>
                <span className="bg-current/20 px-1.5 rounded text-inherit">{uiPrefs.hiddenTools.length}</span>
              </h4>
              <div className="flex flex-col gap-1.5" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'hidden', uiPrefs.hiddenTools.length)}>
                {uiPrefs.hiddenTools.map((tool, index) => (
                  <div key={tool} draggable onDragStart={(e) => handleDragStart(e, tool, 'hidden')} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, 'hidden', index)} className="p-2 bg-black/40 rounded-lg flex items-center gap-3 cursor-grab active:cursor-grabbing border border-white/5 hover:border-white/10 transition-colors opacity-70 hover:opacity-100">
                    <GripVertical className="w-4 h-4 opacity-20" />
                    <span className="opacity-70 text-xs font-semibold flex-1 line-through">{UI_LABELS[tool]}</span>
                    <button onClick={() => moveTool(tool, 'active')} className="p-1 hover:bg-green-500/20 text-green-400 rounded transition-colors" title="Add">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {uiPrefs.hiddenTools.length === 0 ? <div className="opacity-40 text-[10px] text-center border border-dashed border-inherit/20 p-2 rounded-lg">No hidden tools</div> : null}
              </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CustomizeUIMenu;
