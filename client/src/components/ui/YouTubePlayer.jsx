import React from "react";

const YouTubePlayer = ({ url, className = "" }) => {
  if (!url) return null;

  let iframeUrl = url;
  let isYouTube = false;

  if (
    iframeUrl.includes("youtube.com") ||
    iframeUrl.includes("youtu.be") ||
    iframeUrl.includes("youtube-nocookie.com")
  ) {
    isYouTube = true;
    // Convert standard watch links and short links to proper embeds
    if (iframeUrl.includes("watch?v=")) {
      try {
        const videoId = new URLSearchParams(new URL(iframeUrl).search).get("v");
        if (videoId) iframeUrl = `https://www.youtube.com/embed/${videoId}`;
      } catch (e) {}
    } else if (iframeUrl.includes("youtu.be/")) {
      const videoId = iframeUrl.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) iframeUrl = `https://www.youtube.com/embed/${videoId}`;
    }
  }

  if (isYouTube) {
    // Append standardized player parameters ONLY for YouTube
    try {
      const urlObj = new URL(iframeUrl);
      urlObj.searchParams.set("autoplay", "1");
      urlObj.searchParams.set("controls", "1");
      urlObj.searchParams.set("fs", "1"); // Fullscreen button
      urlObj.searchParams.set("rel", "0"); // Hide related videos
      iframeUrl = urlObj.toString();
    } catch (e) {}
  }

  return (
    <iframe
      src={iframeUrl}
      title="YouTube video player"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowFullScreen
      className={className}
    ></iframe>
  );
};

export default YouTubePlayer;
