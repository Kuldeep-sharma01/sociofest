import React, { useState, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Tag,
  User,
  MapPin,
  Trash2,
  Edit,
  FileText,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";
import UniversalVideoPlayer from "@/components/ui/UniversalVideoPlayer";

const DocumentViewer = lazy(() => import("@/components/ui/DocumentViewer"));

const DEFAULT_COLORS = {
  Seminar: "#3174ad",
  Workshop: "#4caf50",
  Competition: "#f44336",
  Festival: "#ff9800",
  Personal: "#9c27b0",
  "Study Plan": "#009688",
  Other: "#607d8b",
};

const EventDetailsModal = ({
  event,
  onClose,
  currentUser,
  onDelete,
  onEdit,
}) => {
  const { appTheme } = useTheme();
  const [viewerFile, setViewerFile] = useState(null);

  if (!event) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const categoryColor = DEFAULT_COLORS[event.category] || DEFAULT_COLORS.Other;
  const isOwner =
    currentUser && currentUser._id === (event.author?._id || event.author);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className={`${getCardThemeClasses(appTheme)} rounded-xl shadow-xl w-full max-w-lg overflow-hidden border max-h-[90vh] flex flex-col transition-colors animate-in zoom-in-95 duration-200`}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-inherit/30 flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
          <h3 className="font-bold text-lg text-inherit">Event Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors opacity-70 hover:opacity-100"
          >
            <X className="w-5 h-5 text-inherit" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div>
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-inherit leading-tight">
                {event.title}
              </h2>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: categoryColor }}
              >
                {event.category}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-sm text-inherit opacity-90">
              <p className="flex items-center gap-2">
                <Tag className="w-4 h-4" /> {event.category}
              </p>
              <p className="flex items-center gap-2">
                <User className="w-4 h-4" /> Created by:{" "}
                {event.author?.name || "Unknown"}{" "}
                {!event.isPublic && (
                  <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full ml-2 text-inherit opacity-80">
                    Private
                  </span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {event.location || "Campus"}
              </p>
              <p className="text-xs font-medium text-inherit opacity-80 mt-2 bg-black/5 dark:bg-white/5 border border-inherit/30 p-2 rounded-md inline-block">
                {formatDate(event.start)} - {formatDate(event.end)}
              </p>
            </div>
          </div>

          <div className="bg-black/5 dark:bg-white/5 p-4 rounded-lg border border-inherit/30 shadow-inner">
            <p className="text-inherit opacity-90 whitespace-pre-wrap text-sm">
              {event.description || "No description provided."}
            </p>
          </div>

          {event.media && event.media.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              {event.media.map((m, idx) => {
                const mPath = typeof m === "string" ? m : m.path;
                const url = mPath?.startsWith("http") ? mPath : `/${mPath}`;
                return (
                  <div
                    key={idx}
                    className="relative rounded-lg overflow-hidden bg-black/5 border border-inherit/30 shadow-sm aspect-video"
                  >
                    {m.mimetype?.startsWith("video") ? (
                  <div className="w-full h-full relative group/eventvid">
                    <UniversalVideoPlayer
                      url={url}
                      mediaData={{ url, type: "video", title: m.title || "Video" }}
                      setFullscreenMedia={setViewerFile}
                      className="w-full h-full object-contain bg-black/10"
                    />
                    <div 
                      className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-black/20 opacity-0 group-hover/eventvid:opacity-100 transition-opacity"
                      onClick={() => setViewerFile({ url, type: "video", title: m.title || "Video" })}
                    >
                      <Video className="w-10 h-10 text-white drop-shadow-md" />
                    </div>
                  </div>
                    ) : m.mimetype?.startsWith("image") ? (
                      <img
                        src={url}
                        alt="Event Attachment"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() =>
                          setViewerFile({
                            url,
                            type: "image",
                            title: m.title || "Image",
                          })
                        }
                      />
                    ) : (
                      <button
                        onClick={() =>
                          setViewerFile({ url, title: m.title || "Document" })
                        }
                        className="w-full h-full flex flex-col items-center justify-center text-inherit opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <FileText className="w-8 h-8 mb-1" />
                        <span className="text-xs font-medium">View File</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t mt-4">
            {isOwner ? (
              <>
                <button
                  onClick={() => onDelete(event._id)}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={() => onEdit(event)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
              </>
            ) : (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 text-inherit opacity-50 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                <Edit className="w-4 h-4" /> Edit (Owner Only)
              </button>
            )}
          </div>
        </div>
      </div>

      {viewerFile && (
        <div className="absolute z-[10000]">
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[10000] bg-black/80 flex flex-col gap-4 items-center justify-center text-white">
                <div
                  className="loader"
                  style={{ "--s": "20px", "--g": "4px" }}
                ></div>
                <p className="font-bold">Loading Viewer...</p>
              </div>
            }
          >
            <DocumentViewer
              url={viewerFile.url}
              title={viewerFile.title || "Document"}
              media={viewerFile}
              currentUser={currentUser}
              onClose={() => setViewerFile(null)}
              canEdit={false}
            />
          </Suspense>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default EventDetailsModal;
