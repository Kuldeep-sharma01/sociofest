import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";
import { downloadMedia } from "@/utils/downloadUtils";

const AssignmentCard = ({
  title,
  subjectName,
  description,
  media = [],
  dueDate,
  headerAction,
  actionButton,
  children,
  className = "",
  onDownloadFile,
}) => {
  const { appTheme } = useTheme();

  return (
    <div
      className={`rounded-2xl shadow-sm border p-5 hover:shadow-md transition-all group relative overflow-hidden flex flex-col ${getCardThemeClasses(appTheme)} ${className}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-current opacity-50"></div>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3 w-full">
          {headerAction && (
            <div className="mt-1.5 shrink-0">{headerAction}</div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-inherit text-xl leading-tight opacity-90 group-hover:opacity-100 transition-opacity truncate">
              {title}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {subjectName && (
                <span className="text-[10px] sm:text-xs font-bold text-inherit bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-md uppercase tracking-wider border border-inherit/20">
                  {subjectName}
                </span>
              )}
              <span className="text-[10px] sm:text-xs font-bold opacity-80 text-inherit bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-md uppercase tracking-wider border border-inherit/30">
                Due:{" "}
                {new Date(dueDate).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>
        {actionButton && <div className="shrink-0 ml-4">{actionButton}</div>}
      </div>
      {(description || (media && media.length > 0)) && (
        <div className="bg-black/5 dark:bg-white/5 p-3.5 rounded-xl border border-inherit/20 mb-2">
          {description && (
            <p className="text-sm opacity-90 text-inherit whitespace-pre-wrap leading-relaxed">
              {description}
            </p>
          )}
          {media && media.length > 0 && (
            <div
              className={`flex flex-wrap gap-2 ${description ? "mt-4 pt-3 border-t border-inherit/20" : ""}`}
            >
              {media.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (onDownloadFile) {
                      onDownloadFile(
                      file?.path?.startsWith("http")
                        ? file?.path
                        : `/${file?.path}`,
                      file?.title || "Assignment_File",
                      );
                    } else {
                      downloadMedia(file?.path?.startsWith("http") ? file?.path : `/${file?.path}`, file?.title || "Assignment_File");
                    }
                  }}
                  className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 text-inherit px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-colors border border-inherit/30 shadow-sm"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {file.title || `Attachment ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {children && (
        <div className="mt-2 pt-4 border-t border-inherit/30 border-dashed">
          {children}
        </div>
      )}
    </div>
  );
};

export default AssignmentCard;
