import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { getCachedSystemSettings, getPublicSystemSettings } from "@/services/systemSettingsService";

const UniversalVideoPlayer = forwardRef(({
  url,
  mediaData,
  setFullscreenMedia,
  ...props
}, ref) => {
  const videoRef = useRef(null);
  const [manifest, setManifest] = React.useState(null);
  const [currentAudio, setCurrentAudio] = React.useState("Original");
  const [showTrackList, setShowTrackList] = React.useState(false);

  useImperativeHandle(ref, () => videoRef.current);

  const hijackingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.preload = "metadata";
      video.controls = true;
    }
    if (!video || !url || !/\.(mp4|webm|ogg|qt|mkv)(\?.*)?$/i.test(url)) return;

    const handleFullscreenChange = () => {
      // If the browser tries to enter native fullscreen, we catch it and open our modal instead
      if (document.fullscreenElement === video && setFullscreenMedia) {
        hijackingRef.current = true;
        document.exitFullscreen().catch(() => {});
        
        const isPlaying = !video.paused;
        video.pause();
        
        setFullscreenMedia({
          url: video.src || url,
          type: "video",
          startTime: video.currentTime,
          isPlaying,
          authorId: mediaData?.authorId,
          isDownloadable: mediaData?.isDownloadable,
          title: mediaData?.title || "Video Playback"
        });
      }
    };

    video.addEventListener("fullscreenchange", handleFullscreenChange);
    video.addEventListener("webkitbeginfullscreen", handleFullscreenChange); // iOS support

    const systemSettings = getCachedSystemSettings().serviceControls;
    const fallbacksEnabled = systemSettings?.mediaPlayerFallbackEnabled !== false;
    getPublicSystemSettings().catch(() => {});

    const cleanUrl = url.split("?")[0];
    const manifestUrl = !cleanUrl.startsWith("blob:") ? cleanUrl.replace(/\.[^/.]+$/, "_manifest.json") : null;
    
    let hlsInstance = null;

    const handleError = () => {
      if (video.src !== url && (video.src.includes("_hls") || video.src.includes(".m3u8"))) {
        console.warn("HLS stream failed, falling back to original MP4");
        video.src = url;
        video.controls = true;
      }
    };

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
        }
      }
    };

    const initPlayer = async () => {
      video.controls = true;
      video.addEventListener("error", handleError);
      
      // 1. Try to load manifest for advanced features
      if (manifestUrl) {
        try {
          const mRes = await fetch(manifestUrl);
          if (mRes.ok) {
            const data = await mRes.json();
            setManifest(data);
          }
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
                    video.controls = true;
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
      
      video.controls = true;
    };

    initPlayer();

    return () => {
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", handleError);
      video.removeEventListener("fullscreenchange", handleFullscreenChange);
      video.removeEventListener("webkitbeginfullscreen", handleFullscreenChange);
    };
  }, [url, setFullscreenMedia, mediaData]);

  const switchAudio = (track) => {
    const video = videoRef.current;
    if (!video) return;
    const currentTime = video.currentTime;
    const isPlaying = !video.paused;

    if (track === "Original") {
      video.src = url;
      setCurrentAudio("Original");
    } else {
      video.src = track.url;
      setCurrentAudio(track.label);
    }

    video.load();
    video.currentTime = currentTime;
    if (isPlaying) video.play().catch(() => {});
    setShowTrackList(false);
  };

  return (
    <div className="relative group/player w-full h-full">
      <video 
        key={url} 
        ref={videoRef} 
        {...props} 
        controls={props.controls !== false} 
        controlsList={`${props.controlsList || ""} nodownload noplaybackrate`.trim()}
        disablePictureInPicture
        onContextMenu={(e) => {
          if (props.onContextMenu) props.onContextMenu(e);
          e.preventDefault();
        }}
        className={`pointer-events-auto select-auto ${props.className || ""}`}
      >
        {manifest?.subtitles?.map((s, idx) => (
          <track 
            key={idx}
            kind="subtitles"
            src={s.url}
            label={s.label}
            srcLang={s.label.toLowerCase().includes("hindi") ? "hi" : "en"}
          />
        ))}
        Your browser does not support the video tag.
      </video>

      {/* AI Track Selection Overlay */}
      {manifest?.audioTracks?.length > 0 && (
        <div className="absolute top-2 left-2 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTrackList(!showTrackList);
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-black/60 hover:bg-black/80 text-white rounded-md text-xs backdrop-blur-sm border border-white/10 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            AI Vocals: {currentAudio}
          </button>
          
          {showTrackList && (
            <div className="absolute top-full mt-1 left-0 bg-black/90 rounded-md overflow-hidden min-w-[150px] shadow-xl border border-white/10">
              <button
                onClick={() => switchAudio("Original")}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${currentAudio === "Original" ? "text-green-400 bg-white/5" : "text-white"}`}
              >
                Original Vocals
              </button>
              {manifest.audioTracks.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => switchAudio(t)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${currentAudio === t.label ? "text-green-400 bg-white/5" : "text-white"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

UniversalVideoPlayer.displayName = "UniversalVideoPlayer";
export default UniversalVideoPlayer;