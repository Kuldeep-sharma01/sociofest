import React, { useState } from "react";
import YouTubePlayer from "./YouTubePlayer";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const LinkPreviewCard = ({ preview, className = "" }) => {
  const { appTheme } = useTheme();
  const [showIframe, setShowIframe] = useState(false);
  
  if (!preview || (!preview.url && !preview.mediaId && !preview.image)) return null;

  // Proxy YouTube thumbnails through an image CDN to completely bypass browser Tracking Prevention warnings
  let safeImage = preview.image;
  if (
    safeImage &&
    (safeImage.includes("img.youtube.com") || safeImage.includes("i.ytimg.com"))
  ) {
    const cleanUrl = safeImage.replace(/^https?:\/\//, "");
    safeImage = `https://wsrv.nl/?url=${cleanUrl}&q=100`;
  }

  if (preview.type === "youtube" && preview.mediaId) {
    return (
      <div
        className={`mt-2 relative w-full pt-[56.25%] rounded-lg border border-inherit/30 overflow-hidden bg-black shadow-sm ${className}`}
      >
        {!showIframe ? (
          <div
            className="absolute inset-0 w-full h-full cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              setShowIframe(true);
            }}
          >
            <img
              src={
                safeImage ||
                `https://wsrv.nl/?url=i.ytimg.com/vi/${preview.mediaId}/maxresdefault.jpg&q=100`
              }
              alt="Video thumbnail"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ) : (
          <YouTubePlayer
            url={`https://www.youtube.com/embed/${preview.mediaId}`}
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>
    );
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col w-full mt-2 ${getCardThemeClasses(appTheme)} border border-inherit/30 rounded-lg overflow-hidden hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${className} text-inherit`}
      onClick={(e) => e.stopPropagation()}
    >
      {safeImage && (
        <div className="w-full aspect-video bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden border-b border-inherit/10">
          <img
            referrerPolicy="no-referrer"
            src={safeImage}
            alt=""
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-3">
        <p className="text-[10px] md:text-xs text-inherit opacity-70 uppercase font-semibold mb-1">
          {preview.siteName}
        </p>
        <h4 className="font-bold text-inherit text-xs md:text-base leading-tight mb-1 line-clamp-2">
          {preview.title}
        </h4>
        {preview.description && (
          <p className="text-[10px] md:text-sm text-inherit opacity-80 line-clamp-2">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
};

export default LinkPreviewCard;
