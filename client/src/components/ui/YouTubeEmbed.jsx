import React from "react";
import YouTubePlayer from "./YouTubePlayer";

const YouTubeEmbed = ({ url }) => {
  if (!url) return null;

  const isYouTube = 
    url.includes("youtube.com") || 
    url.includes("youtu.be") || 
    url.includes("youtube-nocookie.com");

  if (!isYouTube) {
    // Standard HTML5 video fallback for direct .mp4 links
    return (
      <video
        src={url}
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full object-cover bg-black"
      />
    );
  }

  // Delegate to the robust YouTubePlayer for standard iframe handling
  return <YouTubePlayer url={url} className="w-full h-full" />;
};

export default YouTubeEmbed;
