import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { getCachedSystemSettings, getPublicSystemSettings } from "@/services/systemSettingsService";

const UniversalVideoPlayer = forwardRef(({
  url,
  mediaData,
  setFullscreenMedia,
  ...props
}, ref) => {
  const videoRef = useRef(null);
  const hijackingRef = useRef(false);

  useImperativeHandle(ref, () => videoRef.current);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.controls = true;
      video.preload = "metadata";
    }
    if (!video || !url || !/\.(mp4|webm|ogg|qt|mkv)(\?.*)?$/i.test(url)) return;

    const controls = getCachedSystemSettings().serviceControls;
    const fallbacksEnabled = controls?.mediaPlayerFallbackEnabled !== false;
    getPublicSystemSettings().catch(() => {});

    const cleanUrl = url.split("?")[0];
    const manifestUrl = !cleanUrl.startsWith("blob:") ? cleanUrl.replace(/\.[^/.]+$/, "_manifest.json") : null;
    
    let hlsInstance = null;
    let manifestData = null;

    const handleTimeUpdate = () => {
      if (video.currentTime > 0.8 && !video.paused) {
        const quality = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
        if (quality && quality.totalVideoFrames === 0) {
          if (!video.__fallbackTriggered) {
            video.__fallbackTriggered = true;
            window.dispatchEvent(
              new CustomEvent("showToast", {
                detail: "Video is optimizing in the background. Audio only for now! ⏳",
              }),
            );
          }
          video.removeEventListener("timeupdate", handleTimeUpdate);
        } else if (quality && quality.totalVideoFrames > 0) {
          video.removeEventListener("timeupdate", handleTimeUpdate);
        }
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement === video) {
        hijackingRef.current = true;
        document.exitFullscreen();
      } else if (hijackingRef.current) {
        hijackingRef.current = false;
        requestAnimationFrame(() => {
          const isPlaying = !video.paused;
          video.pause();
          if (setFullscreenMedia && mediaData) {
            setFullscreenMedia({
              url: mediaData.url || url,
              type: "video",
              startTime: video.currentTime,
              isPlaying,
              authorId: mediaData.authorId,
              isDownloadable: mediaData.isDownloadable,
              title: mediaData.title,
            });
          }
        });
      }
    };

    const initPlayer = async () => {
      // 1. Try to load manifest for advanced features
      if (manifestUrl) {
        try {
          const mRes = await fetch(manifestUrl);
          if (mRes.ok) manifestData = await mRes.json();
        } catch (e) {}
      }

      const hlsUrl = !cleanUrl.startsWith("blob:") ? cleanUrl.replace(/\.[^/.]+$/, "_hls/master.m3u8") : null;

      if (!fallbacksEnabled) {
        video.src = url;
      } else {
        // If we have HLS and it's supported, use it for adaptive bitrate
        if (hlsUrl) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = hlsUrl;
          } else {
            try {
              const Hls = await (async () => {
                if (window.Hls) return window.Hls;
                return new Promise((resolve) => {
                  const s = document.createElement("script");
                  s.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
                  s.onload = () => resolve(window.Hls);
                  document.head.appendChild(s);
                });
              })();
              if (Hls.isSupported()) {
                hlsInstance = new Hls({ maxMaxBufferLength: 30 });
                hlsInstance.loadSource(hlsUrl);
                hlsInstance.attachMedia(video);
                hlsInstance.on(Hls.Events.ERROR, (_, data) => {
                  if (data.fatal) {
                    hlsInstance.destroy();
                    hlsInstance = null;
                    video.src = url;
                  }
                });
              } else {
                video.src = url;
              }
            } catch {
              video.src = url;
            }
          }
        } else {
          video.src = url;
        }

        video.addEventListener("timeupdate", handleTimeUpdate);
      }
    };

    initPlayer();

    video.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("fullscreenchange", handleFullscreenChange);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [url, setFullscreenMedia, mediaData]);

  return <video ref={videoRef} {...props} />;
});

UniversalVideoPlayer.displayName = "UniversalVideoPlayer";
export default UniversalVideoPlayer;