import React from "react";
import { Eye, Download, FileText, Trash2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";
import { downloadMedia } from "@/utils/downloadUtils";

const MaterialCard = ({
  material,
  subjectName,
  onDownload,
  onDelete,
  canManage,
  isSelected,
  onSelect,
  onView,
}) => {
  const { appTheme } = useTheme();

  return (
    <div className={`shadow-sm p-4 rounded-xl flex flex-col justify-between gap-4 hover:shadow-md hover:border-orange-400 dark:hover:border-orange-600 transition-all group relative overflow-hidden h-full border ${getCardThemeClasses(appTheme)}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400"></div>

      <div className="flex items-start gap-3 flex-1 min-w-0">
        {canManage && onSelect && (
          <div className="mt-1 shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(material._id)}
              className="w-4 h-4 text-orange-500 rounded cursor-pointer border-inherit/30 focus:ring-orange-500 shadow-sm"
            />
          </div>
        )}
        <div className="p-2.5 bg-orange-50 text-orange-600 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
          className="font-bold text-inherit text-base line-clamp-2 group-hover:text-orange-500 transition-colors"
            title={material.title}
          >
            {material.title}
          </h3>
          {(subjectName || material.subjectName) && (
            <div className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">
              {subjectName || material.subjectName}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full shrink-0 mt-auto pt-3 border-t border-inherit/30">
        {(material.fileUrls?.length > 0 ? material.fileUrls : [material.fileUrl]).map((url, i) => url && (
           <div key={i} className="flex items-center gap-2 w-full">
              <button
                onClick={(e) => { e.preventDefault(); if(onView) onView(url, `${material.title}${material.fileUrls?.length > 1 ? ` (Part ${i + 1})` : ""}`); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-black/5 dark:bg-white/5 border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg font-bold transition-colors shadow-sm"
              >
                <Eye className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">View {material.fileUrls?.length > 1 ? i + 1 : ""}</span>
              </button>
              <button
                onClick={() => {
                  if (onDownload) {
                    onDownload(url, `${material.title}${material.fileUrls?.length > 1 ? ` (Part ${i + 1})` : ""}`);
                  } else {
                    downloadMedia(url, `${material.title}${material.fileUrls?.length > 1 ? ` (Part ${i + 1})` : ""}`);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 rounded-lg font-bold transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Download</span>
              </button>
           </div>
        ))}
        {canManage && onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); onDelete(material._id); }}
            className="flex items-center justify-center p-1.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 rounded-lg transition-colors shadow-sm w-full"
            title="Delete Material"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Delete Material
          </button>
        )}
      </div>
    </div>
  );
};

export default MaterialCard;
