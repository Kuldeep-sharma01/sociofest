import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Download,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Settings2,
  Lock,
  Unlock,
  PictureInPicture,
  Gauge,
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  Sun,
  FastForward,
  Rewind,
  Camera,
  Subtitles,
  SlidersHorizontal,
  Headphones,
  Waves,
  Upload,
  Sparkles,
  Mic,
  Crop,
  Monitor,
  Move,
  Activity,
  Repeat,
  Scissors,
  Speaker,
  Tv,
  LayoutTemplate,
  GripVertical,
  HelpCircle,
  Eye,
  Image as ImageIcon,
  ListOrdered,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { fetchJsonResource, fetchResource, fetchTextResource } from "@/services/apiClient";
import { translateMedia } from "@/services/aiService";
import YouTubePlayer from "./YouTubePlayer";
import MediaFiltersMenu, { FILTER_PRESETS } from "./MediaFiltersMenu";
import EqualizerMenu, { EQ_PRESETS } from "./EqualizerMenu";
import CustomizeUIMenu from "./CustomizeUIMenu";
import MediaStatsMenu from "./MediaStatsMenu";
import TrackSelectionMenu from "./TrackSelectionMenu";
import SmartChaptersMenu from "./SmartChaptersMenu";
import ThumbnailsMenu from "./ThumbnailsMenu";
import { getPanelTheme } from "@/utils/themeUtils";
import { downloadMedia } from "@/utils/downloadUtils";

function buildImpulse(audioContext, duration = 2, decay = 2) {
  const rate = audioContext.sampleRate;
  const length = rate * duration;
  const impulse = audioContext.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = length - i;
    left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
  }
  return impulse;
}

function makeDistortionCurve(amount) {
  const k = typeof amount === "number" ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

const hexToRgba = (hex = "#000000", alpha = 0.8) => {
  if (!hex || typeof hex !== "string" || hex.length < 7) hex = "#000000";
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getShadowCss = (type) => {
  switch (type) {
    case "none":
      return "none";
    case "drop-shadow":
      return "2px 2px 4px rgba(0,0,0,0.9)";
    case "raised":
      return "-1px -1px 0 #000, 1px 1px 0 #000, 1px 1px 2px #000";
    case "depressed":
      return "1px 1px 0 #000, -1px -1px 0 #000, -1px -1px 2px #000";
    case "uniform":
      return "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
    default:
      return "2px 2px 4px rgba(0,0,0,0.9)";
  }
};

export const defaultUiPrefs = {
  toolbarOrder: [
    "webSafe",
    "hwDecode",
    "playbackRate",
    "loop",
    "atmos",
    "vision",
    "zoom",
    "reset",
    "pan",
    "aspectRatio",
    "objectFit",
    "backgroundPlay",
    "liveDub",
    "subtitles",
    "reverb",
    "equalizer",
    "rotate",
    "mirror",
    "screenshot",
    "filters",
    "thumbnails",
    "chapters",
  ],
  hiddenTools: [],
  toolbarPosition: "top", // 'top', 'bottom', or 'floating'
  showLabels: false,
};

export const UI_LABELS = {
  webSafe: "Fix Dolby Vision",
  hwDecode: "HW/SW Render",
  playbackRate: "Playback Speed",
  loop: "A-B Loop Trim",
  atmos: "Dolby Atmos",
  vision: "Dolby Vision",
  zoom: "Zoom Controls",
  reset: "Reset View",
  pan: "Free Pan Mode",
  aspectRatio: "Aspect Ratio",
  objectFit: "Video Fit",
  backgroundPlay: "Background Play",
  liveDub: "Live Dubbing",
  subtitles: "Tracks & Subtitles",
  reverb: "3D Reverb",
  equalizer: "Equalizer",
  rotate: "Rotate View",
  mirror: "Mirror View",
  screenshot: "Screenshot",
  filters: "Color Filters",
  thumbnails: "AI Thumbnails",
  chapters: "Smart Chapters",
};

export const defaultSubtitleStyle = {
  fontSize: 120,
  color: "#ffff00",
  bgColor: "#000000",
  bgOpacity: 0.5,
  textShadow: "drop-shadow",
  fontFamily: "sans-serif",
  positionY: 0,
  useCustomEngine: true,
};

const getInitialSubStyle = () => {
  try {
    const saved = localStorage.getItem("sociofest_subtitle_style");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === "object" && parsed !== null) {
        return { ...defaultSubtitleStyle, ...parsed };
      }
    }
  } catch (e) { }
  return defaultSubtitleStyle;
};

const sanitizeCSS = (val) => String(val).replace(/[<>&"']/g, "");

const FullscreenMediaModal = ({ media, onClose, currentUser }) => {
  const { appTheme } = useTheme();
  const startTime = media?.startTime || 0;

  const mediaOwner = media?.authorId || media?.uploader?._id || media?.uploader;
  const isOwnMedia =
    currentUser?._id &&
    mediaOwner &&
    String(currentUser._id) === String(mediaOwner);
  const canDownload =
    isOwnMedia ||
    media?.isDownloadable !== false ||
    currentUser?.role === "Admin";

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);

  const [useWebSafe, setUseWebSafe] = useState(false);
  const [hwDecode, setHwDecode] = useState(true);

  // Advanced Editor & Player State
  const [flip, setFlip] = useState({ x: 1, y: 1 });
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    sepia: 0,
    hueRotate: 0,
    blur: 0,
    grayscale: 0,
    invert: 0,
  });
  const [activePreset, setActivePreset] = useState("none");
  const [showCustomFilters, setShowCustomFilters] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [activeEqPreset, setActiveEqPreset] = useState("flat");
  const [isReverbOn, setIsReverbOn] = useState(false);
  const [eqValues, setEqValues] = useState({
    60: 0,
    230: 0,
    910: 0,
    3600: 0,
    14000: 0,
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  const [balance, setBalance] = useState(0);
  const [bassBoost, setBassBoost] = useState(0);
  const [trebleBoost, setTrebleBoost] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState(false);
  const [textTracks, setTextTracks] = useState([]);
  const [activeTextTrack, setActiveTextTrack] = useState(-1);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState(-1);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState("English");
  const [sourceLang, setSourceLang] = useState("Auto-Detect");
  const [targetVoice, setTargetVoice] = useState("Auto");
  const [translatedScript, setTranslatedScript] = useState("");
  const [mergeBackground, setMergeBackground] = useState(true);
  const [activeVoiceEffect, setActiveVoiceEffect] = useState("none");
  const [voiceEffectIntensity, setVoiceEffectIntensity] = useState(100);
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [objectFit, setObjectFit] = useState("contain");
  const [isPanModeActive, setIsPanModeActive] = useState(false);
  const [subStyle, setSubStyle] = useState(getInitialSubStyle());
  const [showSubSettings, setShowSubSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [resolutions, setResolutions] = useState([]);
  const [activeResolution, setActiveResolution] = useState(-1);

  // WebRTC Live Dubbing State
  const [isLiveDubbing, setIsLiveDubbing] = useState(false);
  const rtcPeerRef = useRef(null);
  const localStreamRef = useRef(null);

  // Advanced UI & Stats State
  const [uiPrefs, setUiPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("sociofest_player_ui");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.toolbarOrder) return { ...defaultUiPrefs, ...parsed };
        // Auto-Migrate from old boolean system to new array sorting system
        const order = defaultUiPrefs.toolbarOrder.filter(
          (k) => parsed[k] !== false,
        );
        const hidden = defaultUiPrefs.toolbarOrder.filter(
          (k) => parsed[k] === false,
        );
        return {
          toolbarOrder: order,
          hiddenTools: hidden,
          toolbarPosition: parsed.toolbarPosition || "top",
          showLabels: parsed.showLabels ?? false,
        };
      }
    } catch {
      return defaultUiPrefs;
    }
    // CRITICAL FIX: Return default preferences if storage is empty!
    return defaultUiPrefs;
  });
  const [showUiSettings, setShowUiSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hideTitle, setHideTitle] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [videoStats, setVideoStats] = useState({});

  // Advanced Independent Free-Floating X/Y Tools State
  const [toolPositions, setToolPositions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sociofest_tool_positions")) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "sociofest_tool_positions",
      JSON.stringify(toolPositions),
    );
  }, [toolPositions]);

  // Cinematic Enhancements State
  const [isAtmosOn, setIsAtmosOn] = useState(false);
  const [isVisionOn, setIsVisionOn] = useState(false);
  const [isNativeDolbyVision, setIsNativeDolbyVision] = useState(false);

  // A-B Loop & Recording State
  const [loopA, setLoopA] = useState(null);
  const [loopB, setLoopB] = useState(null);
  const [isRecordingLoop, setIsRecordingLoop] = useState(false);
  const isRecordingLoopRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  useEffect(() => {
    isRecordingLoopRef.current = isRecordingLoop;
  }, [isRecordingLoop]);

  // Custom Video State
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [gesture, setGesture] = useState({ active: false, type: "", text: "" });
  const [showKeymapHint, setShowKeymapHint] = useState(true);
  const [subtitleUrl, setSubtitleUrl] = useState(null);
  const [activeCues, setActiveCues] = useState([]);

  const startPanRef = useRef({ x: 0, y: 0 });
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const subtitleInputRef = useRef(null);
  const touchState = useRef({
    active: false,
    startX: 0,
    startY: 0,
    downTime: 0,
    startVol: 0,
    startBright: 100,
    startTime: 0,
    type: null,
  });
  const longPressSpeedTimer = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const activePointers = useRef(new Map());
  const initialPinchDistance = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const eqBandsRef = useRef({});
  const convolverNodeRef = useRef(null);
  const reverbWetGainRef = useRef(null);
  const reverbDryGainRef = useRef(null);
  const lastTapTime = useRef(0);
  const tapTimeoutRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const bassFilterRef = useRef(null);
  const trebleFilterRef = useRef(null);
  const containerRef = useRef(null);
  const lastTimeRef = useRef(startTime);
  const customAudioRef = useRef(null);
  const videoGainRef = useRef(null);
  const customGainRef = useRef(null);
  const atmosWetGainRef = useRef(null);
  const atmosDryGainRef = useRef(null);
  const voiceEffectGainsRef = useRef(null);

  // Persist subtitle styles
  useEffect(() => {
    console.log("Saving new Subtitle Style to Storage:", subStyle);
    localStorage.setItem("sociofest_subtitle_style", JSON.stringify(subStyle));
  }, [subStyle]);

  // Save UI Preferences
  useEffect(() => {
    localStorage.setItem("sociofest_player_ui", JSON.stringify(uiPrefs));
  }, [uiPrefs]);

  // Memory Leak Cleanup
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      recordedChunksRef.current = [];
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => { });
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (rtcPeerRef.current) {
        rtcPeerRef.current.close();
      }
    };
  }, []);

  // WebRTC P2P Signaling Listeners (Frontend to Backend Bridge)
  useEffect(() => {
    const handleAnswer = async (e) => {
      const { sdp, mediaId } = e.detail;
      if (mediaId === media?.url && rtcPeerRef.current) {
        try {
          await rtcPeerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) { console.error("WebRTC Answer error", err); }
      }
    };

    const handleIceCandidate = async (e) => {
      const { candidate, mediaId } = e.detail;
      if (mediaId === media?.url && rtcPeerRef.current && candidate) {
        try {
          await rtcPeerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) { console.error("WebRTC ICE candidate error", err); }
      }
    };

    window.addEventListener("webrtc-answer-received", handleAnswer);
    window.addEventListener("webrtc-ice-candidate-received", handleIceCandidate);
    return () => {
      window.removeEventListener("webrtc-answer-received", handleAnswer);
      window.removeEventListener("webrtc-ice-candidate-received", handleIceCandidate);
    };
  }, [media]);

  // Advanced Hardware Decoder & Performance Stats Engine
  useEffect(() => {
    let interval;
    if (showStats && videoRef.current && media?.type === "video") {
      interval = setInterval(() => {
        const v = videoRef.current;
        if (!v) return;
        const quality = v.getVideoPlaybackQuality
          ? v.getVideoPlaybackQuality()
          : {};
        const bitrate =
          v.currentTime > 0 && v.webkitVideoDecodedByteCount
            ? (
              (v.webkitVideoDecodedByteCount * 8) /
              v.currentTime /
              1000
            ).toFixed(0)
            : 0;

        setVideoStats({
          resolution: `${v.videoWidth || 0}x${v.videoHeight || 0}`,
          droppedFrames: quality.droppedVideoFrames || 0,
          totalFrames: quality.totalVideoFrames || 0,
          networkState: v.networkState,
          readyState: v.readyState,
          currentTime: v.currentTime.toFixed(2),
          bitrate: bitrate > 0 ? `${bitrate} kbps` : "Calculating...",
          codec: v.webkitDecodedFrameCount
            ? "Hardware / GPU Accelerated"
            : "Standard / Software",
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showStats, media]);

  // Advanced Subtitle Extraction Engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    if (!tracks) return;

    const handleCueChange = () => {
      let currentCues = [];
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === "hidden" || tracks[i].mode === "showing") {
          const cues = tracks[i].activeCues;
          if (cues) {
            for (let j = 0; j < cues.length; j++) {
              currentCues.push(cues[j].text);
            }
          }
        }
      }

      // Prevent useless React re-renders during fast playback
      setActiveCues((prev) => {
        if (
          prev.length === currentCues.length &&
          prev.every((val, idx) => val === currentCues[idx])
        ) {
          return prev;
        }
        return currentCues;
      });
    };

    const handleAddTrack = (e) => {
      const track = e.track;
      if (subStyle.useCustomEngine && track.mode === "showing")
        track.mode = "hidden";
      track.addEventListener("cuechange", handleCueChange);
    };

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (subStyle.useCustomEngine && track.mode === "showing")
        track.mode = "hidden";
      else if (!subStyle.useCustomEngine && track.mode === "hidden")
        track.mode = "showing";
      track.addEventListener("cuechange", handleCueChange);
    }

    tracks.addEventListener("addtrack", handleAddTrack);
    return () => {
      tracks.removeEventListener("addtrack", handleAddTrack);
      for (let i = 0; i < tracks.length; i++)
        tracks[i].removeEventListener("cuechange", handleCueChange);
    };
  }, [subtitleUrl, subStyle.useCustomEngine, media]);

  const { safeUrl, isEmbed } = useMemo(() => {
    const url = media?.url;
    if (!url) {
      return {
        safeUrl: null,
        isEmbed: media?.type === "youtube" || media?.type === "embed",
      };
    }

    let finalUrl = url;
    let embed = media.type === "youtube" || media.type === "embed";

    if (url.includes("img.youtube.com") || url.includes("i.ytimg.com")) {
      const cleanUrl = url.replace(/^https?:\/\//, "");
      finalUrl = `https://wsrv.nl/?url=${cleanUrl}&q=100`;
      embed = false;
    } else if (
      /youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|dailymotion\.com|spotify\.com|soundcloud\.com/i.test(
        url,
      )
    ) {
      embed = true;
    }

    return { safeUrl: finalUrl, isEmbed: embed };
  }, [media]);

  const handleClose = () => {
    if (media?.type === "video" && videoRef.current) {
      try {
        // Save checkpoint before closing
        if (safeUrl) {
          const t = videoRef.current.currentTime;
          const dur = videoRef.current.duration;
          const savedProgress = JSON.parse(localStorage.getItem("sociofest_video_progress")) || {};
          if (t > 2 && dur && t < dur - 2) {
            savedProgress[safeUrl] = t;
          } else if (dur && t >= dur - 2) {
            delete savedProgress[safeUrl];
          }
          localStorage.setItem("sociofest_video_progress", JSON.stringify(savedProgress));
        }

        const bgVideos = document.querySelectorAll("video");
        for (let i = 0; i < bgVideos.length; i++) {
          const bgVideo = bgVideos[i];
          if (bgVideo.__mediaData && bgVideo.__mediaData.url === media.url) {
            bgVideo.currentTime = videoRef.current.currentTime;
            break;
          }
        }
      } catch (e) { }
    }
    onClose();
  };

  // --- Device Orientation & Fullscreen Engine ---
  const toggleFullscreen = async (e) => {
    if (e) e.stopPropagation();
    const container = containerRef.current;
    const video = videoRef.current;

    if (!document.fullscreenElement) {
      try {
        if (container?.requestFullscreen) {
          await container.requestFullscreen();
          // Force native device sensor to tilt to landscape!
          if (
            window.screen &&
            window.screen.orientation &&
            window.screen.orientation.lock
          ) {
            try {
              await window.screen.orientation.lock("landscape");
            } catch (err) { }
          }
        } else if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      } catch (err) { }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          if (
            window.screen &&
            window.screen.orientation &&
            window.screen.orientation.unlock
          ) {
            try {
              window.screen.orientation.unlock();
            } catch (err) { }
          }
        }
      } catch (err) { }
    }
  };

  // --- Independent Tool Drag Engine (Free-Floating X/Y) ---
  const handleIndividualToolDrag = (e, tool) => {
    e.preventDefault();
    e.stopPropagation();

    const isTouch = e.type === "touchstart";
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    // Default cascading position if not yet placed by the user
    const index =
      uiPrefs.toolbarOrder.indexOf(tool) !== -1
        ? uiPrefs.toolbarOrder.indexOf(tool)
        : 20;
    const defaultX = 20 + (index % 8) * 55;
    const defaultY = 80 + Math.floor(index / 8) * 55;

    const currentX = toolPositions[tool]?.x ?? defaultX;
    const currentY = toolPositions[tool]?.y ?? defaultY;

    const startX = clientX - currentX;
    const startY = clientY - currentY;

    const handleMove = (moveEvent) => {
      const mx = isTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const my = isTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
      setToolPositions((prev) => ({
        ...prev,
        [tool]: {
          x: Math.max(0, Math.min(window.innerWidth - 50, mx - startX)),
          y: Math.max(0, Math.min(window.innerHeight - 50, my - startY)),
        },
      }));
    };

    const handleUp = () => {
      if (isTouch) {
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleUp);
        document.removeEventListener("touchcancel", handleUp);
      } else {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      }
    };

    if (isTouch) {
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleUp);
      document.addEventListener("touchcancel", handleUp);
    } else {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    }
  };

  // --- Customization Drag and Drop Engine ---
  const handleDragStart = (e, item, source) => {
    setDraggedItem({ item, source });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetList, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    setUiPrefs((prev) => {
      let newOrder = [...prev.toolbarOrder].filter(
        (i) => i !== draggedItem.item,
      );
      let newHidden = [...prev.hiddenTools].filter(
        (i) => i !== draggedItem.item,
      );

      if (targetList === "active") {
        if (targetIndex >= newOrder.length || targetIndex === -1)
          newOrder.push(draggedItem.item);
        else newOrder.splice(targetIndex, 0, draggedItem.item);
      } else {
        if (targetIndex >= newHidden.length || targetIndex === -1)
          newHidden.push(draggedItem.item);
        else newHidden.splice(targetIndex, 0, draggedItem.item);
      }
      return { ...prev, toolbarOrder: newOrder, hiddenTools: newHidden };
    });
    setDraggedItem(null);
  };

  const moveTool = (item, targetList) => {
    setUiPrefs((prev) => {
      let newOrder = [...prev.toolbarOrder].filter((i) => i !== item);
      let newHidden = [...prev.hiddenTools].filter((i) => i !== item);
      if (targetList === "active") newOrder.push(item);
      else newHidden.push(item);
      return { ...prev, toolbarOrder: newOrder, hiddenTools: newHidden };
    });
  };

  const handleRecordLoop = () => {
    if (!videoRef.current || loopA === null || loopB === null) return;
    if (!canDownload) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Cannot download this content. ❌",
        }),
      );
      return;
    }

    // Pause first to ensure a clean seek
    videoRef.current.pause();

    const startRecording = () => {
      try {
        const video = videoRef.current;

        // Hidden Canvas Render Engine to bypass Chromium's hardware capture bug
        const canvas = document.createElement("canvas");
        const rawWidth = video.videoWidth || 1280;
        const rawHeight = video.videoHeight || 720;

        // CRITICAL FIX: Hardware encoders (VP8/H264) crash and flash green on odd-numbered dimensions (common on 9:16 mobile videos)
        canvas.width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;
        canvas.height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;

        // CRITICAL FIX: Append canvas to the DOM!
        // Chrome drops frames/flashes green on off-screen canvases using captureStream.
        canvas.style.position = "fixed";
        canvas.style.top = "-10000px";
        canvas.style.opacity = "0";
        document.body.appendChild(canvas);

        // HW vs SW Context selection based on user preference
        const ctx = canvas.getContext("2d", { willReadFrequently: !hwDecode });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Bake active user color filters & Dolby Vision directly into the downloaded video!
        const b = isVisionOn ? filters.brightness * 1.15 : filters.brightness;
        const c = isVisionOn ? filters.contrast * 1.15 : filters.contrast;
        const s = isVisionOn ? filters.saturate * 1.25 : filters.saturate;

        let animationFrameId;
        const drawFrame = () => {
          if (!video.paused && !video.ended) {
            // Clear filter to guarantee pure black background and prevent transparent green bleeding
            ctx.filter = "none";
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Reapply filters specifically for the video draw
            ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${filters.sepia}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) grayscale(${filters.grayscale || 0}%) invert(${filters.invert || 0}%)`;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          // Force continuous repaints to keep the browser's GPU stream alive
          animationFrameId = requestAnimationFrame(drawFrame);
        };

        // Force Initial Draw execution
        ctx.filter = "none";
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${filters.sepia}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) grayscale(${filters.grayscale || 0}%) invert(${filters.invert || 0}%)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        drawFrame(); // Start render loop

        const stream = canvas.captureStream(30); // Flawless 30fps lock

        // Merge the audio track from the original video seamlessly
        const originalStream = video.captureStream
          ? video.captureStream()
          : video.mozCaptureStream
            ? video.mozCaptureStream()
            : null;
        if (originalStream && originalStream.getAudioTracks().length > 0) {
          stream.addTrack(originalStream.getAudioTracks()[0]);
        }

        let options = { mimeType: "video/webm;codecs=vp8,opus" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: "video/webm" };
        }

        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = () => {
          cancelAnimationFrame(animationFrameId); // Kill render loop to save memory
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas); // Clean up DOM
          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `SocioFest_Trim_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          window.dispatchEvent(
            new CustomEvent("showToast", {
              detail: "Trimmed section downloaded locally! 📥",
            }),
          );
        };

        // Wait for exactly two monitor frame refreshes to guarantee the GPU has fully painted the canvas
        // This entirely prevents the "Green/Flashy" transparent YUV keyframe bug at the start of the video!
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mediaRecorder.start(100); // Flush buffer every 100ms prevents data corruption
            setIsRecordingLoop(true);
            video.play();
            window.dispatchEvent(
              new CustomEvent("showToast", {
                detail: "Recording loop section... 🔴",
              }),
            );
          });
        });
      } catch (err) {
        console.error("Recording failed", err);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Browser doesn't support local video capture. ❌",
          }),
        );
      }
    };

    const onSeeked = () => {
      videoRef.current.removeEventListener("seeked", onSeeked);
      // Allow browser 150ms to strictly decode and paint the keyframe before recording begins
      setTimeout(startRecording, 150);
    };

    videoRef.current.addEventListener("seeked", onSeeked);
    videoRef.current.currentTime = loopA;
  };

  const handleBalanceChange = (e) => {
    const value = Number(e.target.value);
    setBalance(value);
    if (pannerNodeRef.current && audioCtxRef.current) {
      // Smoothly pan audio to prevent clipping/popping
      pannerNodeRef.current.pan.setTargetAtTime(
        value,
        audioCtxRef.current.currentTime,
        0.05,
      );
    }
  };

  const renderLabel = (key) =>
    uiPrefs.showLabels ? (
      <span
        className={`ml-1.5 text-xs font-bold text-inherit truncate max-w-[120px]`}
      >
        {UI_LABELS[key]}
      </span>
    ) : null;

  const renderTool = (tool) => {
    const isVideo = media.type === "video" && !isEmbed;
    const isImage = media.type === "image";

    switch (tool) {
      case "webSafe":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setUseWebSafe(!useWebSafe);
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: !useWebSafe
                    ? "Dolby Vision Color Fix Applied ✅"
                    : "Original Colors Restored 🎬",
                }),
              );
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${useWebSafe ? "bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Fix Dolby Vision (Green/Purple Screen)"
          >
            <Eye className="w-5 h-5" />
            {renderLabel("webSafe")}
          </button>
        ) : null;
      case "hwDecode":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setHwDecode(!hwDecode);
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: !hwDecode
                    ? "Hardware GPU Rendering Enabled (HW) 🚀"
                    : "Software CPU Rendering Enabled (SW) 💻",
                }),
              );
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center justify-center font-bold text-xs h-10 px-3 ${hwDecode ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title={
              hwDecode
                ? "Hardware Acceleration Active (Click for SW)"
                : "Software Rendering Active (Click for HW)"
            }
          >
            {hwDecode ? "HW" : "SW"}
            {renderLabel("hwDecode")}
          </button>
        ) : null;
      case "playbackRate":
        return isVideo ? (
          <div
            key={tool}
            className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-sm shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Gauge className="w-4 h-4 text-white/80" />
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={playbackRate}
              onChange={handleSpeedSliderChange}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="w-16 sm:w-24 h-1.5 accent-white cursor-pointer"
            />
            <span className="text-white font-mono w-10 text-center text-sm font-bold">
              {playbackRate.toFixed(1)}x
            </span>
            {renderLabel("playbackRate")}
          </div>
        ) : null;
      case "loop":
        return isVideo ? (
          <div
            key={tool}
            className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1.5 rounded-full border border-white/20 shadow-sm shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Repeat className="w-4 h-4 text-white/80 ml-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (loopB !== null && currentTime >= loopB) {
                  window.dispatchEvent(
                    new CustomEvent("showToast", {
                      detail: "Loop A must be before Loop B! ⚠️",
                    }),
                  );
                  return;
                }
                setLoopA(currentTime);
              }}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${loopA !== null ? "bg-indigo-500 text-white shadow-inner" : "hover:bg-white/20 text-white/70"}`}
              title="Set Loop Start (A)"
            >
              A {loopA !== null ? `(${formatTime(loopA)})` : ""}
            </button>
            <span className="text-white/30">-</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (loopA !== null && currentTime <= loopA) {
                  window.dispatchEvent(
                    new CustomEvent("showToast", {
                      detail: "Loop B must be after Loop A! ⚠️",
                    }),
                  );
                  return;
                }
                setLoopB(currentTime);
              }}
              className={`px-2 py-1 rounded text-xs font-bold transition-colors ${loopB !== null ? "bg-indigo-500 text-white shadow-inner" : "hover:bg-white/20 text-white/70"}`}
              title="Set Loop End (B)"
            >
              B {loopB !== null ? `(${formatTime(loopB)})` : ""}
            </button>
            {(loopA !== null || loopB !== null) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLoopA(null);
                  setLoopB(null);
                  setIsRecordingLoop(false);
                  if (mediaRecorderRef.current?.state === "recording")
                    mediaRecorderRef.current.stop();
                }}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded-full transition-colors ml-1"
                title="Clear Loop"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {loopA !== null && loopB !== null && canDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isRecordingLoop) {
                    mediaRecorderRef.current?.stop();
                    setIsRecordingLoop(false);
                  } else {
                    handleRecordLoop();
                  }
                }}
                className={`p-1.5 rounded-full transition-colors ml-1 flex items-center ${isRecordingLoop ? "bg-red-500 text-white animate-pulse" : "hover:bg-green-500/20 text-green-400"}`}
                title={
                  isRecordingLoop
                    ? "Stop Recording"
                    : "Record & Download Trimmed Loop (Client-Side)"
                }
              >
                <Scissors className="w-4 h-4" />
              </button>
            )}
            {renderLabel("loop")}
          </div>
        ) : null;
      case "atmos":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              initAudioEngine();
              setIsAtmosOn(!isAtmosOn);
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: isAtmosOn
                    ? "Dolby Atmos Disabled"
                    : "Dolby Atmos Spatial Enabled 🎧",
                }),
              );
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isAtmosOn ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Dolby Atmos Spatial Audio"
          >
            <Speaker className="w-5 h-5" />
            {renderLabel("atmos")}
          </button>
        ) : null;
      case "vision":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setIsVisionOn(!isVisionOn);
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: isVisionOn
                    ? "Dolby Vision Disabled"
                    : "Dolby Vision HDR Enabled 📺",
                }),
              );
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isVisionOn ? "bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Dolby Vision / HDR Enhancer"
          >
            <Tv className="w-5 h-5" />
            {renderLabel("vision")}
          </button>
        ) : null;
      case "aspectRatio":
        return isVideo ? (
          <button
            key={tool}
            onClick={handleAspectRatioCycle}
            className="p-2 bg-black/60 backdrop-blur-md hover:bg-white/20 rounded-full transition-colors text-white shrink-0 border border-white/20 flex items-center gap-1"
            title="Change Aspect Ratio"
          >
            <Crop className="w-5 h-5" />
            <span className="text-xs font-bold w-10 text-center">
              {aspectRatio === "auto" ? "Auto" : aspectRatio}
            </span>
            {renderLabel("aspectRatio")}
          </button>
        ) : null;
      case "objectFit":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={handleObjectFitCycle}
            className="p-2 bg-black/60 backdrop-blur-md hover:bg-white/20 rounded-full transition-colors text-white shrink-0 border border-white/20 flex items-center gap-1"
            title="Change Media Fit"
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs font-bold w-12 text-center capitalize">
              {objectFit}
            </span>
            {renderLabel("objectFit")}
          </button>
        ) : null;
      case "backgroundPlay":
        return isVideo ? (
          <button
            key={tool}
            onClick={handleBackgroundPlay}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isBackgroundPlayEnabled ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Background Play"
          >
            <Headphones className="w-5 h-5" />
            {renderLabel("backgroundPlay")}
          </button>
        ) : null;
      case "liveDub":
        return isVideo || isEmbed ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              toggleLiveDubbing();
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isLiveDubbing ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Broadcast Live WebRTC Dubbing"
          >
            <Mic className="w-5 h-5" />
            {renderLabel("liveDub")}
          </button>
        ) : null;
      case "subtitles":
        return isVideo ? (
          <button
            key={tool}
            onClick={handleSubtitleToggle}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showTrackMenu ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Tracks & Subtitles"
          >
            <Subtitles className="w-5 h-5" />
            {renderLabel("subtitles")}
          </button>
        ) : null;
      case "reverb":
        return isVideo ? (
          <button
            key={tool}
            onClick={handleReverbToggle}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isReverbOn ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="3D Reverb"
          >
            <Waves className="w-5 h-5" />
            {renderLabel("reverb")}
          </button>
        ) : null;
      case "equalizer":
        return isVideo ? (
          <button
            key={tool}
            onClick={handleEqualizerToggle}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showEqualizer ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Equalizer"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {renderLabel("equalizer")}
          </button>
        ) : null;
      case "screenshot":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={handleScreenshot}
            className="p-2 bg-black/60 backdrop-blur-md hover:bg-white/20 rounded-full transition-colors text-white shrink-0 border border-white/20 flex items-center gap-1"
            title="Capture Screenshot"
          >
            <Camera className="w-5 h-5" />
            {renderLabel("screenshot")}
          </button>
        ) : null;

      case "zoom":
        return isVideo || isImage ? (
          <div
            key={tool}
            className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20 shrink-0"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(-1);
              }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white shrink-0"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white/80 text-xs font-mono w-8 text-center font-bold shrink-0 my-auto">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(1);
              }}
              className="p-2 hover:bg-white/20 rounded-full transition-colors text-white shrink-0"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            {renderLabel("zoom")}
          </div>
        ) : null;
      case "reset":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              resetAll();
            }}
            className="p-2 bg-black/60 backdrop-blur-md hover:bg-white/20 rounded-full transition-colors text-white shrink-0 border border-white/20 flex items-center gap-1"
            title="Reset View"
          >
            <RefreshCw className="w-5 h-5" />
            {renderLabel("reset")}
          </button>
        ) : null;
      case "pan":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setIsPanModeActive((prev) => !prev);
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${isPanModeActive ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Toggle Free Pan Mode"
          >
            <Move className="w-5 h-5" />
            {renderLabel("pan")}
          </button>
        ) : null;
      case "rotate":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setRotation((prev) => prev + 90);
            }}
            className="p-2 bg-black/60 backdrop-blur-md hover:bg-white/20 rounded-full transition-colors text-white shrink-0 border border-white/20 flex items-center gap-1"
            title="Rotate View"
          >
            <RotateCw className="w-5 h-5" />
            {renderLabel("rotate")}
          </button>
        ) : null;
      case "mirror":
        return isVideo || isImage ? (
          <button
            key={tool}
            onClick={handleMirror}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${flip.x === -1 ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Mirror View"
          >
            <FlipHorizontal className="w-5 h-5" />
            {renderLabel("mirror")}
          </button>
        ) : null;
      case "filters":
        return isVideo || isImage || isEmbed ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setShowFilters(!showFilters);
              setShowEqualizer(false);
              setShowTrackMenu(false);
              setShowUiSettings(false);
              setShowChapters(false);
              setShowThumbnails(false);
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showFilters ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Adjust Colors"
          >
            <Settings2 className="w-5 h-5" />
            {renderLabel("filters")}
          </button>
        ) : null;
      case "chapters":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setShowChapters(!showChapters);
              setShowFilters(false);
              setShowEqualizer(false);
              setShowTrackMenu(false);
              setShowThumbnails(false);
              setShowUiSettings(false);
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showChapters ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Smart Chapters"
          >
            <ListOrdered className="w-5 h-5" />
            {renderLabel("chapters")}
          </button>
        ) : null;
      case "thumbnails":
        return isVideo ? (
          <button
            key={tool}
            onClick={(e) => {
              e.stopPropagation();
              setShowThumbnails(!showThumbnails);
              setShowChapters(false);
              setShowFilters(false);
              setShowEqualizer(false);
              setShowTrackMenu(false);
              setShowUiSettings(false);
            }}
            className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showThumbnails ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
            title="Custom Thumbnails"
          >
            <ImageIcon className="w-5 h-5" />
            {renderLabel("thumbnails")}
          </button>
        ) : null;
      default:
        return null;
    }
  };

  // Add ESC key and video shortcuts listener
  useEffect(() => {
    // Accessibility: Auto-focus the close button or container on open
    const timer = setTimeout(() => {
      const closeBtn = containerRef.current?.querySelector('button[title*="Close"]');
      if (closeBtn) closeBtn.focus();
      else containerRef.current?.focus();
    }, 100);

    const handleKeyDown = (e) => {
      // Accessibility: Focus Trap logic
      if (e.key === "Tab" && containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }

      // PREVENT KEYBOARD HIJACKING WHEN TYPING IN INPUTS
      const activeTag = document.activeElement.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT" ||
        document.activeElement.isContentEditable
      ) {
        if (e.key === "Escape") document.activeElement.blur();
        return;
      }

      if (e.key === "Escape" && !isLocked) {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
          return;
        }
        handleClose();
        return;
      }

      // Video keyboard shortcuts (Disabled if Locked)
      if (media?.type === "video" && videoRef.current && !isLocked) {
        const video = videoRef.current;
        switch (e.key.toLowerCase()) {
          case " ":
            e.preventDefault();
            if (video.paused) video.play();
            else video.pause();
            break;
          case "arrowright":
            e.preventDefault();
            video.currentTime += 10;
            break;
          case "arrowleft":
            e.preventDefault();
            video.currentTime -= 10;
            break;
          case "arrowup":
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            break;
          case "arrowdown":
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            break;
          case "f":
            e.preventDefault();
            toggleFullscreen();
            break;
          case "m":
            e.preventDefault();
            video.muted = !video.muted;
            break;
          case ">":
            e.preventDefault();
            handleSpeedChange(0.1);
            break;
          case "<":
            e.preventDefault();
            handleSpeedChange(-0.1);
            break;
          case "[":
            e.preventDefault();
            if (loopB !== null && video.currentTime >= loopB) {
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: "Loop A must be before Loop B! ⚠️",
                }),
              );
              return;
            }
            setLoopA(video.currentTime);
            window.dispatchEvent(
              new CustomEvent("showToast", { detail: `Loop A Set` }),
            );
            break;
          case "]":
            e.preventDefault();
            if (loopA !== null && video.currentTime <= loopA) {
              window.dispatchEvent(
                new CustomEvent("showToast", {
                  detail: "Loop B must be after Loop A! ⚠️",
                }),
              );
              return;
            }
            setLoopB(video.currentTime);
            window.dispatchEvent(
              new CustomEvent("showToast", { detail: `Loop B Set` }),
            );
            break;
          case "\\":
            e.preventDefault();
            setLoopA(null);
            setLoopB(null);
            setIsRecordingLoop(false);
            if (mediaRecorderRef.current?.state === "recording")
              mediaRecorderRef.current.stop();
            window.dispatchEvent(
              new CustomEvent("showToast", { detail: "A-B Loop Cleared" }),
            );
            break;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, media, isLocked]);

  // Reset state when media changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlip({ x: 1, y: 1 });
    setFilters({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      sepia: 0,
      hueRotate: 0,
      blur: 0,
      grayscale: 0,
      invert: 0,
    });
    setActivePreset("none");
    setShowCustomFilters(false);
    setShowEqualizer(false);
    setShowUiSettings(false);
    setShowStats(false);
    setShowHelp(false);
    setHideTitle(false);
    setShowChapters(false);
    setShowThumbnails(false);
    setActiveEqPreset("flat");
    setIsReverbOn(false);
    setEqValues({ 60: 0, 230: 0, 910: 0, 3600: 0, 14000: 0 });
    setShowTrackMenu(false);
    setTextTracks([]);
    setActiveTextTrack(-1);
    setAudioTracks([]);
    setActiveAudioTrack(-1);
    setResolutions([]);
    setActiveResolution(-1);
    setActiveVoiceEffect("none");
    setVoiceEffectIntensity(100);
    setSourceLang("Auto-Detect");
    setIsTranslating(false);
    setAspectRatio("auto");
    setObjectFit("contain");
    setIsPanModeActive(false);
    setIsAtmosOn(false);

    if (isLiveDubbing) {
      setIsLiveDubbing(false);
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (rtcPeerRef.current) rtcPeerRef.current.close();
    }

    setIsNativeDolbyVision(false);
    setIsVisionOn(false);
    setLoopA(null);
    setLoopB(null);
    setIsRecordingLoop(false);
    if (mediaRecorderRef.current?.state === "recording")
      mediaRecorderRef.current.stop();
    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.removeAttribute("src");
    }
    setBalance(0);
    setBassBoost(0);
    setTrebleBoost(0);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => { });
      audioCtxRef.current = null;
      eqBandsRef.current = {};
    }
    setPlaybackRate(1);
    setIsLocked(false);
    setIsBackgroundPlayEnabled(false);
    // Also reset video playback state for new media
    setUseWebSafe(false);
    setCurrentTime(startTime);
    lastTimeRef.current = startTime;
    setIsPlaying(media?.isPlaying !== false);
    setSubtitleUrl(media?.subtitleUrl || null);

    const isEmbed =
      media?.type === "youtube" ||
      media?.type === "embed" ||
      (media?.url && /youtube\.com|youtu\.be|vimeo\.com/i.test(media.url));
    if (media?.type === "video" && !isEmbed) {
      setShowKeymapHint(true);
      const hintTimer = setTimeout(() => setShowKeymapHint(false), 3000);
      return () => clearTimeout(hintTimer);
    }
  }, [media, startTime]);

  // Sync video time when exiting native fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const video = videoRef.current;
      // If we're exiting fullscreen and the video element exists
      if (!document.fullscreenElement && video) {
        // Restore playback time if browser strictly reset it
        if (Math.abs(video.currentTime - lastTimeRef.current) > 1.5) {
          video.currentTime = lastTimeRef.current;
        }
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Save checkpoint on page refresh/unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (media?.type === "video" && videoRef.current && safeUrl) {
        try {
          const t = videoRef.current.currentTime;
          const dur = videoRef.current.duration;
          const savedProgress = JSON.parse(localStorage.getItem("sociofest_video_progress")) || {};
          if (t > 2 && dur && t < dur - 2) {
            savedProgress[safeUrl] = t;
          } else if (dur && t >= dur - 2) {
            delete savedProgress[safeUrl];
          }
          localStorage.setItem("sociofest_video_progress", JSON.stringify(savedProgress));
        } catch (err) { }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [media, safeUrl]);

  // Auto-hide custom video controls
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Ignore simulated mousemoves triggered by touch devices
      if (e && e.movementX === 0 && e.movementY === 0) return;

      if (!isLocked) {
        setShowControls(true);
        if (controlsTimeoutRef.current)
          clearTimeout(controlsTimeoutRef.current);
        if (isPlaying)
          controlsTimeoutRef.current = setTimeout(
            () => setShowControls(false),
            8000,
          );
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isLocked]);

  // AudioEngine Initialization (Delayed until user interaction to bypass Safari Deadlock)
  const initAudioEngine = () => {
    if (
      media?.type !== "video" ||
      isEmbed ||
      !videoRef.current ||
      !customAudioRef.current ||
      audioCtxRef.current
    )
      return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      if (ctx.state === "suspended") {
        ctx
          .resume()
          .catch((e) => console.error("Audio context resume failed", e));
      }

      const videoSource = ctx.createMediaElementSource(videoRef.current);
      const customSource = ctx.createMediaElementSource(customAudioRef.current);
      audioSourceNodeRef.current = videoSource;

      const vGain = ctx.createGain();
      const cGain = ctx.createGain();

      vGain.gain.value = 1;
      cGain.gain.value = 0;

      videoGainRef.current = vGain;
      customGainRef.current = cGain;

      videoSource.connect(vGain);
      customSource.connect(cGain);

      const mergeNode = ctx.createGain();
      vGain.connect(mergeNode);
      cGain.connect(mergeNode);

      // EQ Bands
      const bands = [60, 230, 910, 3600, 14000];
      let prevNode = mergeNode;

      bands.forEach((freq) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = eqValues[freq];
        eqBandsRef.current[freq] = filter;
        prevNode.connect(filter);
        prevNode = filter;
      });

      // Bass Boost Filter
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = "lowshelf";
      bassFilter.frequency.value = 250;
      bassFilter.gain.value = bassBoost;
      bassFilterRef.current = bassFilter;
      prevNode.connect(bassFilter);
      prevNode = bassFilter;

      // Treble Boost Filter
      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = "highshelf";
      trebleFilter.frequency.value = 6000;
      trebleFilter.gain.value = trebleBoost;
      trebleFilterRef.current = trebleFilter;
      prevNode.connect(trebleFilter);
      prevNode = trebleFilter;

      // ---- VOICE EFFECTS ROUTING ----
      const effectSplitter = ctx.createGain();
      prevNode.connect(effectSplitter);

      const dryEffectGain = ctx.createGain();
      dryEffectGain.gain.value = 1;
      effectSplitter.connect(dryEffectGain);

      // Robot (Ring Modulator using Oscillator)
      const robotOsc = ctx.createOscillator();
      robotOsc.type = "sawtooth";
      robotOsc.frequency.value = 50;
      robotOsc.start();
      const robotRingGain = ctx.createGain();
      robotRingGain.gain.value = 0;
      robotOsc.connect(robotRingGain.gain);
      const robotGain = ctx.createGain();
      robotGain.gain.value = 0;
      effectSplitter.connect(robotRingGain).connect(robotGain);

      // Alien (Modulated Delay / Chorus)
      const alienDelay = ctx.createDelay();
      alienDelay.delayTime.value = 0.03;
      const alienOsc = ctx.createOscillator();
      alienOsc.type = "sine";
      alienOsc.frequency.value = 3;
      alienOsc.start();
      const alienOscGain = ctx.createGain();
      alienOscGain.gain.value = 0.005;
      alienOsc.connect(alienOscGain).connect(alienDelay.delayTime);
      const alienGain = ctx.createGain();
      alienGain.gain.value = 0;
      effectSplitter.connect(alienDelay).connect(alienGain);

      // Telephone (Bandpass Filter)
      const telephoneFilter1 = ctx.createBiquadFilter();
      telephoneFilter1.type = "highpass";
      telephoneFilter1.frequency.value = 400;
      const telephoneFilter2 = ctx.createBiquadFilter();
      telephoneFilter2.type = "lowpass";
      telephoneFilter2.frequency.value = 2000;
      const telephoneGain = ctx.createGain();
      telephoneGain.gain.value = 0;
      effectSplitter
        .connect(telephoneFilter1)
        .connect(telephoneFilter2)
        .connect(telephoneGain);

      // Muffled (Lowpass Filter)
      const muffledFilter = ctx.createBiquadFilter();
      muffledFilter.type = "lowpass";
      muffledFilter.frequency.value = 400;
      const muffledGain = ctx.createGain();
      muffledGain.gain.value = 0;
      effectSplitter.connect(muffledFilter).connect(muffledGain);

      // Echo (Feedback Delay)
      const echoDelay = ctx.createDelay();
      echoDelay.delayTime.value = 0.3;
      const echoFeedback = ctx.createGain();
      echoFeedback.gain.value = 0.4;
      effectSplitter.connect(echoDelay);
      echoDelay.connect(echoFeedback).connect(echoDelay);
      const echoGain = ctx.createGain();
      echoGain.gain.value = 0;
      echoDelay.connect(echoGain);

      // Megaphone (Bandpass + Distortion)
      const megaphoneFilter = ctx.createBiquadFilter();
      megaphoneFilter.type = "bandpass";
      megaphoneFilter.frequency.value = 1500;
      const megaphoneShaper = ctx.createWaveShaper();
      megaphoneShaper.curve = makeDistortionCurve(50);
      const megaphoneGain = ctx.createGain();
      megaphoneGain.gain.value = 0;
      effectSplitter
        .connect(megaphoneFilter)
        .connect(megaphoneShaper)
        .connect(megaphoneGain);

      // Underwater (Lowpass)
      const underwaterFilter = ctx.createBiquadFilter();
      underwaterFilter.type = "lowpass";
      underwaterFilter.frequency.value = 300;
      const underwaterGain = ctx.createGain();
      underwaterGain.gain.value = 0;
      effectSplitter.connect(underwaterFilter).connect(underwaterGain);

      // Cave (Large Reverb via Multi-Delay)
      const caveDelay1 = ctx.createDelay();
      caveDelay1.delayTime.value = 0.15;
      const caveDelay2 = ctx.createDelay();
      caveDelay2.delayTime.value = 0.25;
      const caveFeedback = ctx.createGain();
      caveFeedback.gain.value = 0.4;
      const caveFilter = ctx.createBiquadFilter();
      caveFilter.type = "lowpass";
      caveFilter.frequency.value = 800;
      effectSplitter
        .connect(caveDelay1)
        .connect(caveFilter)
        .connect(caveDelay2)
        .connect(caveFeedback)
        .connect(caveDelay1);
      const caveGain = ctx.createGain();
      caveGain.gain.value = 0;
      effectSplitter.connect(caveDelay1);
      caveDelay1.connect(caveGain);
      caveDelay2.connect(caveGain);

      const effectMerger = ctx.createGain();
      dryEffectGain.connect(effectMerger);
      robotGain.connect(effectMerger);
      alienGain.connect(effectMerger);
      telephoneGain.connect(effectMerger);
      muffledGain.connect(effectMerger);
      echoGain.connect(effectMerger);
      megaphoneGain.connect(effectMerger);
      underwaterGain.connect(effectMerger);
      caveGain.connect(effectMerger);

      voiceEffectGainsRef.current = {
        dry: dryEffectGain,
        robot: robotGain,
        alien: alienGain,
        telephone: telephoneGain,
        muffled: muffledGain,
        echo: echoGain,
        megaphone: megaphoneGain,
        underwater: underwaterGain,
        cave: caveGain,
      };

      prevNode = effectMerger;
      // -------------------------------

      // ---- DOLBY ATMOS SPATIAL ROUTING ----
      const atmosDelay = ctx.createDelay();
      atmosDelay.delayTime.value = 0.025; // 25ms Haas delay for spatial surround width
      const atmosFilter = ctx.createBiquadFilter();
      atmosFilter.type = "peaking";
      atmosFilter.frequency.value = 1000;
      atmosFilter.Q.value = 0.5;
      atmosFilter.gain.value = 5; // Mid-range presence boost
      const lfeFilter = ctx.createBiquadFilter();
      lfeFilter.type = "lowpass";
      lfeFilter.frequency.value = 80; // Sub-bass LFE Channel

      const aWet = ctx.createGain();
      aWet.gain.value = isAtmosOn ? 0.7 : 0;
      const aDry = ctx.createGain();
      aDry.gain.value = isAtmosOn ? 0.6 : 1;
      atmosWetGainRef.current = aWet;
      atmosDryGainRef.current = aDry;

      prevNode.connect(atmosDelay).connect(atmosFilter).connect(aWet);
      prevNode.connect(lfeFilter).connect(aWet);
      prevNode.connect(aDry);
      const atmosMergerGain = ctx.createGain();
      aWet.connect(atmosMergerGain);
      aDry.connect(atmosMergerGain);
      prevNode = atmosMergerGain;

      // Reverb Nodes
      const convolver = ctx.createConvolver();
      convolver.buffer = buildImpulse(ctx);
      convolverNodeRef.current = convolver;
      const wetGain = ctx.createGain();
      wetGain.gain.value = isReverbOn ? 0.7 : 0;
      reverbWetGainRef.current = wetGain;

      const dryGain = ctx.createGain();
      dryGain.gain.value = isReverbOn ? 0.3 : 1;
      reverbDryGainRef.current = dryGain;

      // Panner Node for Left/Right Balance
      const panner = ctx.createStereoPanner();
      panner.pan.value = balance;
      pannerNodeRef.current = panner;

      // Final merger before output
      const finalMerger = ctx.createGain();
      finalMerger.connect(panner).connect(ctx.destination);

      // Route both wet (reverb) and dry signals through the final merger
      prevNode.connect(dryGain).connect(finalMerger);
      prevNode.connect(convolver).connect(wetGain).connect(finalMerger);
    } catch (e) {
      console.error("Audio routing failed.", e);
    }
  };

  // Auto-detect backend extracted multi-track subtitles & audio
  useEffect(() => {
    if (media?.type === "video" && safeUrl && !isEmbed) {
      const defaultAudio = [{ url: null, label: "Original Video Audio" }];
      const manifestUrl = safeUrl.replace(/\.[^/.]+$/, "_manifest.json");
      fetchJsonResource(manifestUrl)
        .then((data) => {
          setIsNativeDolbyVision(!!data.isDolbyVision);
          if (data.subtitles?.length > 0) {
            setTextTracks(
              data.subtitles.map((s) => ({
                ...s,
                url:
                  s.url.startsWith("http") || s.url.startsWith("blob:")
                    ? s.url
                    : new URL(
                      s.url,
                      safeUrl.startsWith("http")
                        ? safeUrl
                        : window.location.origin,
                    ).href,
              })),
            );
            window.dispatchEvent(
              new CustomEvent("showToast", {
                detail: "Multiple subtitles loaded! 💬",
              }),
            );
          }
          if (data.audioTracks?.length > 0) {
            const mappedTracks = data.audioTracks.map((t) => ({
              ...t,
              url:
                t.url.startsWith("http") || t.url.startsWith("blob:")
                  ? t.url
                  : new URL(
                    t.url,
                    safeUrl.startsWith("http")
                      ? safeUrl
                      : window.location.origin,
                  ).href,
            }));
            setAudioTracks([
              { url: null, label: "Original Video Audio" },
              ...mappedTracks,
            ]);
            setActiveAudioTrack(0);
            window.dispatchEvent(
              new CustomEvent("showToast", {
                detail: "Multiple audio tracks loaded! 🎵",
              }),
            );
          } else {
            setAudioTracks(defaultAudio);
            setActiveAudioTrack(0);
          }

          if (data.resolutions?.length > 0) {
            const mappedRes = data.resolutions.map((r) => ({
              ...r,
              url:
                r.url.startsWith("http") || r.url.startsWith("blob:")
                  ? r.url
                  : new URL(
                    r.url,
                    safeUrl.startsWith("http")
                      ? safeUrl
                      : window.location.origin,
                  ).href,
            }));
            setResolutions(mappedRes);
          }
        })
        .catch(() => {
          // Fallback to old single extraction guess
          const guessedUrl = safeUrl.replace(/\.[^/.]+$/, ".vtt");
          fetchResource(guessedUrl, { method: "HEAD" })
            .then((res) => {
              if (res.ok) {
                setTextTracks([
                  { url: guessedUrl, label: "Extracted Subtitle" },
                ]);
              }
            })
            .catch(() => { });

          setAudioTracks(defaultAudio);
          setActiveAudioTrack(0);
        });
    }
  }, [safeUrl, media, isEmbed]);

  // Sync custom audio strictly to video playback
  useEffect(() => {
    const video = videoRef.current;
    const customAudio = customAudioRef.current;
    if (!video || !customAudio) return;

    const syncState = () => {
      if (activeAudioTrack > 0) {
        if (Math.abs(customAudio.currentTime - video.currentTime) > 0.2) {
          customAudio.currentTime = video.currentTime;
        }
        customAudio.playbackRate = video.playbackRate;
      }
    };

    const handlePlay = () => {
      if (activeAudioTrack > 0) customAudio.play().catch(() => { });
    };
    const handlePause = () => {
      if (activeAudioTrack > 0) customAudio.pause();
    };
    const handleSeek = () => {
      if (activeAudioTrack > 0) customAudio.currentTime = video.currentTime;
    };
    const handleVolume = () => {
      customAudio.volume = video.volume;
    };
    const handleTimeUpdate = () => {
      if (
        activeAudioTrack > 0 &&
        Math.abs(customAudio.currentTime - video.currentTime) > 0.3
      ) {
        customAudio.currentTime = video.currentTime;
      }
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeking", handleSeek);
    video.addEventListener("seeked", handleSeek);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ratechange", syncState);
    video.addEventListener("volumechange", handleVolume);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeking", handleSeek);
      video.removeEventListener("seeked", handleSeek);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ratechange", syncState);
      video.removeEventListener("volumechange", handleVolume);
    };
  }, [activeAudioTrack]);

  // Background Play & MediaSession integration
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Force playback when tab goes to background if enabled
      if (
        document.hidden &&
        isBackgroundPlayEnabled &&
        videoRef.current &&
        isPlaying
      ) {
        setTimeout(() => videoRef.current?.play().catch(() => { }), 50);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isBackgroundPlayEnabled, isPlaying]);

  useEffect(() => {
    if ("mediaSession" in navigator && media?.type === "video") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "SocioFest Media",
        artist: "Playing in Background",
      });
      navigator.mediaSession.setActionHandler("play", () => {
        videoRef.current?.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        videoRef.current?.pause();
        setIsPlaying(false);
      });

      return () => {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
      };
    }
  }, [media]);

  // Dynamic 3D Reverb Adjustments
  useEffect(() => {
    if (
      reverbWetGainRef.current &&
      reverbDryGainRef.current &&
      audioCtxRef.current
    ) {
      reverbWetGainRef.current.gain.setTargetAtTime(
        isReverbOn ? 0.7 : 0,
        audioCtxRef.current.currentTime,
        0.1,
      );
      reverbDryGainRef.current.gain.setTargetAtTime(
        isReverbOn ? 0.3 : 1,
        audioCtxRef.current.currentTime,
        0.1,
      );
    }
  }, [isReverbOn]);

  // Dynamic Dolby Atmos Adjustments
  useEffect(() => {
    if (
      atmosWetGainRef.current &&
      atmosDryGainRef.current &&
      audioCtxRef.current
    ) {
      atmosWetGainRef.current.gain.setTargetAtTime(
        isAtmosOn ? 0.7 : 0,
        audioCtxRef.current.currentTime,
        0.1,
      );
      atmosDryGainRef.current.gain.setTargetAtTime(
        isAtmosOn ? 0.6 : 1,
        audioCtxRef.current.currentTime,
        0.1,
      );
    }
  }, [isAtmosOn]);

  // Dynamic Voice Effect Adjustments
  useEffect(() => {
    if (voiceEffectGainsRef.current && audioCtxRef.current) {
      const gains = voiceEffectGainsRef.current;
      const t = audioCtxRef.current.currentTime;
      const intensity = voiceEffectIntensity / 100;

      // Reset all to 0 smoothly
      gains.robot.gain.setTargetAtTime(0, t, 0.1);
      gains.alien.gain.setTargetAtTime(0, t, 0.1);
      gains.telephone.gain.setTargetAtTime(0, t, 0.1);
      gains.muffled.gain.setTargetAtTime(0, t, 0.1);
      if (gains.megaphone) gains.megaphone.gain.setTargetAtTime(0, t, 0.1);
      if (gains.underwater) gains.underwater.gain.setTargetAtTime(0, t, 0.1);
      if (gains.cave) gains.cave.gain.setTargetAtTime(0, t, 0.1);

      if (activeVoiceEffect === "none") {
        gains.dry.gain.setTargetAtTime(1, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "robot") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        gains.robot.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "alien") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        gains.alien.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "telephone") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        gains.telephone.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "muffled") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        gains.muffled.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "echo") {
        gains.dry.gain.setTargetAtTime(1, t, 0.1);
        gains.echo.gain.setTargetAtTime(0.6 * intensity, t, 0.1);
      } else if (activeVoiceEffect === "megaphone") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        if (gains.megaphone)
          gains.megaphone.gain.setTargetAtTime(1.2 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "underwater") {
        gains.dry.gain.setTargetAtTime(1 - intensity, t, 0.1);
        if (gains.underwater)
          gains.underwater.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      } else if (activeVoiceEffect === "cave") {
        gains.dry.gain.setTargetAtTime(1 - intensity * 0.5, t, 0.1); // Keep some dry signal
        if (gains.cave)
          gains.cave.gain.setTargetAtTime(1.5 * intensity, t, 0.1);
        gains.echo.gain.setTargetAtTime(0, t, 0.1);
      }
    }
  }, [activeVoiceEffect, voiceEffectIntensity]);

  // Dynamic HLS Streaming Engine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || media?.type !== "video" || isEmbed || !safeUrl) return;

    const isLocalUpload = safeUrl.includes("/uploads/");
    const cleanUrl = safeUrl.split("?")[0];

    let optUrl = safeUrl;
    let hlsUrl = null;

    if (cleanUrl.startsWith("blob:")) {
      if (video.__hlsInstance) {
        video.__hlsInstance.destroy();
        video.__hlsInstance = null;
      }
      video.src = cleanUrl;
      return;
    } else if (isLocalUpload) {
      optUrl = cleanUrl;
      hlsUrl = cleanUrl.replace(/\.[^/.]+$/, "_hls/master.m3u8");
    } else if (cleanUrl.endsWith(".m3u8") || cleanUrl.endsWith(".m3u")) {
      hlsUrl = safeUrl;
    }

    const errorListener = () => {
    };
    video.addEventListener("error", errorListener);
    video.src = optUrl; // Set initial fallback imperatively

    let hlsInstance = null;

    const initHls = async () => {
      if (!hlsUrl) return;
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hlsUrl;
        video.addEventListener(
          "error",
          () => {
            if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)
              video.src = optUrl;
          },
          { once: true },
        );
      } else {
        try {
          const Hls = await (async () => {
            if (window.Hls) return window.Hls;
            return new Promise((res) => {
              const s = document.createElement("script");
              s.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
              s.onload = () => res(window.Hls);
              document.head.appendChild(s);
            });
          })();

          if (Hls.isSupported()) {
            hlsInstance = new Hls({ maxMaxBufferLength: 60 });
            hlsInstance.loadSource(hlsUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                hlsInstance.destroy();
                hlsInstance = null;
                video.__hlsInstance = null;
                video.src = optUrl;
              }
            });
            video.__hlsInstance = hlsInstance;
          }
        } catch (e) {
          video.src = optUrl;
        }
      }
    };
    initHls();

    const handleTimeUpdate = () => {
      if (video.currentTime > 0.2 && !video.paused) {
        const quality = video.getVideoPlaybackQuality
          ? video.getVideoPlaybackQuality()
          : null;
        if (quality && quality.totalVideoFrames === 0) {
          if (!video.__fallbackTriggered) {
            video.__fallbackTriggered = true;
            window.dispatchEvent(
              new CustomEvent("showToast", {
                detail:
                  "Video is optimizing in the background. Audio only for now! ⏳",
              }),
            );
          } else {
            video.removeEventListener("timeupdate", handleTimeUpdate);
          }
          video.removeEventListener("timeupdate", handleTimeUpdate);
        } else if (quality && quality.totalVideoFrames > 0) {
          video.removeEventListener("timeupdate", handleTimeUpdate);
        }
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      if (hlsInstance) hlsInstance.destroy();
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("error", errorListener);
      if (video.__hlsInstance) video.__hlsInstance = null;
    };
  }, [safeUrl, media, isEmbed]);

  if (!media) return null;

  let activeFilter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) sepia(${filters.sepia}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) grayscale(${filters.grayscale || 0}%) invert(${filters.invert || 0}%)`;
  if (useWebSafe) {
    activeFilter =
      `hue-rotate(285deg) saturate(1.8) contrast(1.2) brightness(1.1) ` +
      activeFilter;
  } else if (isVisionOn) {
    activeFilter = `brightness(${filters.brightness * 1.15}%) contrast(${filters.contrast * 1.15}%) saturate(${filters.saturate * 1.25}%) sepia(${filters.sepia}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) grayscale(${filters.grayscale || 0}%) invert(${filters.invert || 0}%)`;
  }

  const handleDownload = async (e) => {
    e.stopPropagation();

    // If it's an image and has visual changes, bake them into the downloaded file by treating it like a screenshot!
    if (
      media.type === "image" &&
      (filters.brightness !== 100 ||
        filters.contrast !== 100 ||
        filters.saturate !== 100 ||
        filters.sepia !== 0 ||
        filters.hueRotate !== 0 ||
        filters.blur !== 0 ||
        filters.grayscale !== 0 ||
        filters.invert !== 0 ||
        isVisionOn ||
        rotation !== 0 ||
        flip.x !== 1 ||
        flip.y !== 1)
    ) {
      handleScreenshot(e);
      return;
    }

    await downloadMedia(safeUrl, media.title || "media", media.type);
  };

  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    // Detect trackpad pinch vs standard scroll wheel
    const zoomSensitivity = e.ctrlKey ? 0.015 : 0.005;
    const newScale = scale - e.deltaY * zoomSensitivity;
    setScale(Math.max(0.1, Math.min(newScale, 50))); // Clamp scale between 0.5x and 10x
  };

  // Button handlers
  const handleZoom = (direction) => {
    const newScale = scale + direction * 0.5;
    setScale(Math.max(0.5, Math.min(newScale, 10)));
  };

  const handleRotate = (direction) => {
    setRotation((prev) => prev + direction * 90);
  };

  const handleFlip = (axis) => {
    setFlip((prev) => ({ ...prev, [axis]: prev[axis] * -1 }));
  };

  // Video Handlers
  const handleSpeedChange = (delta) => {
    if (!videoRef.current) return;
    const currentSpeed = videoRef.current.playbackRate;
    const newSpeed = Math.max(0.1, Math.min(currentSpeed + delta, 4));
    setPlaybackRate(newSpeed);
    videoRef.current.playbackRate = newSpeed;
  };

  const handleSpeedSliderChange = (e) => {
    if (!videoRef.current) return;
    const newSpeed = parseFloat(e.target.value);
    setPlaybackRate(newSpeed);
    videoRef.current.playbackRate = newSpeed;
  };

  const handlePiP = async () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await videoRef.current.requestPictureInPicture();
    }
  };

  const handleAspectRatioCycle = (e) => {
    e.stopPropagation();
    const aspectRatios = ["auto", "16/9", "4/3", "21/9", "1/1", "9/16"];
    const nextIndex =
      (aspectRatios.indexOf(aspectRatio) + 1) % aspectRatios.length;
    setAspectRatio(aspectRatios[nextIndex]);
    if (window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: `Aspect Ratio: ${aspectRatios[nextIndex]}`,
        }),
      );
    }
  };

  const handleObjectFitCycle = (e) => {
    e.stopPropagation();
    const objectFits = ["contain", "cover", "fill"];
    const nextIndex = (objectFits.indexOf(objectFit) + 1) % objectFits.length;
    setObjectFit(objectFits[nextIndex]);
    if (window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: `Video Fit: ${objectFits[nextIndex]}`,
        }),
      );
    }
  };

  const resetAll = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlip({ x: 1, y: 1 });
    setFilters(FILTER_PRESETS["none"].values);
    setActivePreset("none");
    setShowCustomFilters(false);
    setAspectRatio("auto");
    setObjectFit("contain");
    setIsPanModeActive(false);
  };

  // Universal Pointer Engine (Handles Multi-Touch Zoom, Pan, & Video Scrubbing)
  const handleMediaPointerDown = (e) => {
    if (isLocked) return;
    try {
      if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
    } catch (err) { }
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      initialPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      touchState.current.type = "pinch";
      touchState.current.pinchCenter = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      touchState.current.startPan = { ...position };
      if (longPressSpeedTimer.current)
        clearTimeout(longPressSpeedTimer.current);
    } else if (activePointers.current.size === 1) {
      touchState.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        downTime: Date.now(),
        startVol: videoRef.current?.volume || 1,
        startBright: filters.brightness,
        startTime: videoRef.current?.currentTime || 0,
        type: null,
        pointerType: e.pointerType || "mouse",
      };
      startPanRef.current = { x: position.x, y: position.y };

      if (media.type === "video" && videoRef.current) {
        longPressSpeedTimer.current = setTimeout(() => {
          if (
            touchState.current.type === null &&
            videoRef.current &&
            activePointers.current.size === 1
          ) {
            videoRef.current.playbackRate = 2.0;
            setGesture({ active: true, type: "speed", text: "2x" });
            touchState.current.type = "speed-hold";
          }
        }, 500);
      }
    }
  };

  const handleMediaPointerMove = (e) => {
    if (isLocked || !activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (initialPinchDistance.current) {
        const zoomSensitivity = 0.01;
        setScale(
          Math.max(
            0.5,
            Math.min(
              scale + (dist - initialPinchDistance.current) * zoomSensitivity,
              50,
            ),
          ),
        );
        initialPinchDistance.current = dist;
      }
      if (touchState.current.pinchCenter) {
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        setPosition({
          x:
            touchState.current.startPan.x +
            (cx - touchState.current.pinchCenter.x),
          y:
            touchState.current.startPan.y +
            (cy - touchState.current.pinchCenter.y),
        });
      }
      return;
    }

    if (activePointers.current.size === 1 && touchState.current.active) {
      if (longPressSpeedTimer.current)
        clearTimeout(longPressSpeedTimer.current);
      const deltaX = e.clientX - touchState.current.startX;
      const deltaY = e.clientY - touchState.current.startY;

      if (!touchState.current.type) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          if (scale > 1 || media.type === "image" || isPanModeActive) {
            touchState.current.type = "pan";
            setIsPanning(true);
          } else if (media.type === "video" && videoRef.current) {
            if (Math.abs(deltaX) > 30) touchState.current.type = "seek";
            else if (Math.abs(deltaY) > 30) {
              const rect = videoRef.current.getBoundingClientRect();
              touchState.current.type =
                touchState.current.startX - rect.left < rect.width / 2
                  ? "brightness"
                  : "volume";
            }
          }
        }
      }

      if (touchState.current.type === "pan") {
        setPosition({
          x: startPanRef.current.x + deltaX,
          y: startPanRef.current.y + deltaY,
        });
      } else if (touchState.current.type === "seek" && videoRef.current) {
        const newTime = Math.max(
          0,
          Math.min(duration, touchState.current.startTime + deltaX * 0.15),
        );
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        setGesture({
          active: true,
          type: "seek",
          text: `${formatTime(newTime)}`,
        });
      } else if (touchState.current.type === "volume" && videoRef.current) {
        const newVol = Math.max(
          0,
          Math.min(1, touchState.current.startVol - deltaY * 0.005),
        );
        videoRef.current.volume = newVol;
        setGesture({
          active: true,
          type: "volume",
          text: `Volume: ${Math.round(newVol * 100)}%`,
        });
      } else if (touchState.current.type === "brightness") {
        const newBright = Math.max(
          20,
          Math.min(200, Number(touchState.current.startBright) - deltaY * 0.5),
        );
        setFilters((prev) => ({ ...prev, brightness: newBright }));
        setGesture({
          active: true,
          type: "brightness",
          text: `Brightness: ${Math.round(newBright)}%`,
        });
      }
    }
  };

  const handleMediaPointerUp = (e) => {
    const wasPinching = touchState.current.type === "pinch";
    if (activePointers.current.has(e.pointerId))
      activePointers.current.delete(e.pointerId);

    if (activePointers.current.size === 0) {
      initialPinchDistance.current = null;
      touchState.current.pinchCenter = null;
    }

    if (!touchState.current.active && activePointers.current.size === 0) return;
    if (longPressSpeedTimer.current) clearTimeout(longPressSpeedTimer.current);

    if (touchState.current.type === "speed-hold" && videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }

    const clientX = e?.clientX ?? touchState.current.startX;
    const clientY = e?.clientY ?? touchState.current.startY;
    const deltaX = Math.abs(clientX - touchState.current.startX);
    const deltaY = Math.abs(clientY - touchState.current.startY);
    const timeSinceDown = Date.now() - touchState.current.downTime;

    // Universal Tap Logic (Video & Image)
    // Only trigger tap when the LAST finger is lifted, we were NOT pinching, and parameters match
    if (
      activePointers.current.size === 0 &&
      !wasPinching &&
      touchState.current.type !== "speed-hold" &&
      deltaX < 20 &&
      deltaY < 20 &&
      timeSinceDown < 400
    ) {
      const now = Date.now();
      if (now - lastTapTime.current < 400) {
        clearTimeout(tapTimeoutRef.current);
        lastTapTime.current = 0;

        if (media.type === "video" && videoRef.current) {
          const rect = videoRef.current.getBoundingClientRect();
          const x = clientX - rect.left;
          const width = rect.width;

          if (x < width * 0.33) {
            videoRef.current.currentTime = Math.max(
              0,
              videoRef.current.currentTime - 10,
            );
            setCurrentTime(videoRef.current.currentTime);
            setGesture({ active: true, type: "rewind", text: "-10s" });
          } else if (x > width * 0.66) {
            videoRef.current.currentTime = Math.min(
              duration,
              videoRef.current.currentTime + 10,
            );
            setCurrentTime(videoRef.current.currentTime);
            setGesture({ active: true, type: "forward", text: "+10s" });
          } else {
            if (!videoRef.current.paused) {
              videoRef.current.pause();
              setGesture({ active: true, type: "pause", text: "Pause" });
            } else {
              videoRef.current.play();
              setGesture({ active: true, type: "play", text: "Play" });
            }
          }
          setTimeout(
            () => setGesture((prev) => ({ ...prev, active: false })),
            800,
          );

          setShowControls(true);
          if (controlsTimeoutRef.current)
            clearTimeout(controlsTimeoutRef.current);
          if (!videoRef.current.paused) {
            controlsTimeoutRef.current = setTimeout(
              () => setShowControls(false),
              8000,
            );
          }
        } else if (media.type === "image") {
          setScale((prev) => {
            if (prev > 1) {
              setPosition({ x: 0, y: 0 });
              return 1;
            }
            return 2;
          });
        }
      } else {
        lastTapTime.current = now;
        tapTimeoutRef.current = setTimeout(() => {
          setShowControls((prev) => {
            const next = !prev;
            if (controlsTimeoutRef.current)
              clearTimeout(controlsTimeoutRef.current);
            if (next && videoRef.current && !videoRef.current.paused) {
              controlsTimeoutRef.current = setTimeout(
                () => setShowControls(false),
                8000,
              );
            }
            return next;
          });
          lastTapTime.current = 0;
        }, 400); // Match double tap window
      }
    }

    if (activePointers.current.size === 0) {
      touchState.current.active = false;
      if (touchState.current.type === "pan") setIsPanning(false);
      touchState.current.type = null;
      if (deltaX >= 20 || deltaY >= 20)
        setTimeout(
          () => setGesture((prev) => ({ ...prev, active: false })),
          800,
        );
    }
  };

  const handleScreenshot = (e) => {
    e.stopPropagation();
    const sourceElement = media.type === "image" ? imgRef.current : videoRef.current;
    if (!sourceElement) return;
    try {
      const canvas = document.createElement("canvas");
      const rawWidth = sourceElement.videoWidth || sourceElement.naturalWidth || 1280;
      const rawHeight = sourceElement.videoHeight || sourceElement.naturalHeight || 720;

      canvas.width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1;
      canvas.height = rawHeight % 2 === 0 ? rawHeight : rawHeight + 1;

      // Force DOM rendering context for stable snapshot
      canvas.style.position = "fixed";
      canvas.style.top = "-10000px";
      canvas.style.opacity = "0";
      document.body.appendChild(canvas);

      const ctx = canvas.getContext("2d", { willReadFrequently: !hwDecode });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const b = isVisionOn ? filters.brightness * 1.15 : filters.brightness;
      const c = isVisionOn ? filters.contrast * 1.15 : filters.contrast;
      const s = isVisionOn ? filters.saturate * 1.25 : filters.saturate;
      ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${filters.sepia}%) hue-rotate(${filters.hueRotate}deg) blur(${filters.blur}px) grayscale(${filters.grayscale || 0}%) invert(${filters.invert || 0}%)`;

      // Apply flips
      if (flip.x === -1 || flip.y === -1) {
        ctx.translate(flip.x === -1 ? canvas.width : 0, flip.y === -1 ? canvas.height : 0);
        ctx.scale(flip.x, flip.y);
      }

      ctx.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas); // Cleanup
          if (!blob) return;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `SocioFest_Screenshot_${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          if (window.dispatchEvent) {
            window.dispatchEvent(
              new CustomEvent("showToast", { detail: "Screenshot saved! 📸" }),
            );
          }
        },
        "image/png",
        1.0,
      );
    } catch (err) {
      console.error("Screenshot failed (CORS issue):", err);
      if (window.dispatchEvent) {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Screenshot failed due to strict media origin. ❌",
          }),
        );
      }
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const applyPreset = (presetKey) => {
    if (FILTER_PRESETS[presetKey]) {
      setFilters(FILTER_PRESETS[presetKey].values);
      setActivePreset(presetKey);
      setShowCustomFilters(false);
    }
  };

  const handleSubtitleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target.result;
      // Convert basic SRT to VTT on the fly for HTML5 video support
      if (file.name.endsWith(".srt")) {
        text =
          "WEBVTT\n\n" + text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
      }

      const blob = new Blob([text], { type: "text/vtt" });
      const url = URL.createObjectURL(blob);
      setTextTracks((prev) => {
        const next = [...prev, { url, label: file.name }];
        setActiveTextTrack(next.length - 1);
        setSubtitleUrl(url);
        return next;
      });
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Subtitles loaded! 💬" }),
      );
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };


  const handleMirror = (e) => {
    e.stopPropagation();
    handleFlip("x");
  };

  const handleTextTrackChange = (index) => {
    setActiveTextTrack(index);
    if (index === -1) {
      setSubtitleUrl(null);
    } else {
      setSubtitleUrl(textTracks[index].url);
    }
  };

  const handleAudioTrackChange = (index, forceUrl = null) => {
    initAudioEngine();
    setActiveAudioTrack(index);
    if (!videoRef.current || !customAudioRef.current) return;

    const targetUrl = forceUrl !== null ? forceUrl : audioTracks[index]?.url;

    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume().catch(() => { });
    }

    if (index === 0 || !targetUrl) {
      if (videoGainRef.current && audioCtxRef.current)
        videoGainRef.current.gain.setTargetAtTime(
          1,
          audioCtxRef.current.currentTime,
          0.1,
        );
      if (customGainRef.current && audioCtxRef.current)
        customGainRef.current.gain.setTargetAtTime(
          0,
          audioCtxRef.current.currentTime,
          0.1,
        );
      videoRef.current.muted = false; // Restore native audio if AudioContext failed

      customAudioRef.current.pause();
    } else {
      if (videoGainRef.current && audioCtxRef.current)
        videoGainRef.current.gain.setTargetAtTime(
          0,
          audioCtxRef.current.currentTime,
          0.1,
        );
      if (customGainRef.current && audioCtxRef.current)
        customGainRef.current.gain.setTargetAtTime(
          1,
          audioCtxRef.current.currentTime,
          0.1,
        );
      videoRef.current.muted = true; // Hard-mute native video track so original language stops playing

      if (!customAudioRef.current.src.endsWith(targetUrl)) {
        customAudioRef.current.src = targetUrl;
      }
      customAudioRef.current.currentTime = videoRef.current.currentTime;
      customAudioRef.current.playbackRate = videoRef.current.playbackRate;
      if (!videoRef.current.paused) {
        customAudioRef.current.play().catch(() => { });
      }
    }
  };

  const handleResolutionChange = (index) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;

    setActiveResolution(index);

    // If index is -1, it means we switch back to the main URL (which might be HLS)
    const targetUrl = index === -1 ? safeUrl : resolutions[index].url;

    // Destroy HLS instance if we are forcing a static resolution MP4
    if (index !== -1 && video.__hlsInstance) {
      video.__hlsInstance.destroy();
      video.__hlsInstance = null;
    }

    video.src = targetUrl;
    video.load();

    // Resume at the same time
    const onLoaded = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.currentTime = currentTime;
      if (wasPlaying) video.play().catch(() => { });

      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: `Quality switched to ${index === -1 ? "Auto / Original" : resolutions[index].label} 🎥`,
        }),
      );
    };
    video.addEventListener("loadedmetadata", onLoaded);
  };

  const handleSubtitleToggle = (e) => {
    e.stopPropagation();
    setShowTrackMenu((prev) => !prev);
    setShowEqualizer(false);
    setShowFilters(false);
  };
  const handleEqualizerToggle = (e) => {
    e.stopPropagation();
    initAudioEngine();
    setShowEqualizer((prev) => !prev);
    setShowTrackMenu(false);
    setShowFilters(false);
  };
  const handleReverbToggle = (e) => {
    e.stopPropagation();
    initAudioEngine();
    setIsReverbOn((prev) => !prev);
  };
  const handleEqChange = (freq, value) => {
    const num = Number(value);
    setEqValues((prev) => ({ ...prev, [freq]: num }));
    setActiveEqPreset("custom");
    if (eqBandsRef.current[freq] && audioCtxRef.current) {
      // Smoothly slide EQ value to prevent audio clipping/popping
      eqBandsRef.current[freq].gain.setTargetAtTime(
        num,
        audioCtxRef.current.currentTime,
        0.1,
      );
    }
  };
  const handleBackgroundPlay = (e) => {
    e.stopPropagation();
    setIsBackgroundPlayEnabled((prev) => {
      const next = !prev;
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: next
            ? "Background play enabled. 🎧"
            : "Background play disabled.",
        }),
      );
      return next;
    });
  };
  const handleAITranslate = async () => {
    // Legacy instant mode: Translate + Dub in one go
    const script = await handleTranslateOnly();
    if (script) {
      // Wait for script to be available and dub it
      handleDubOnly(script);
    }
  };

  const handleTranslateOnly = async () => {
    if (!videoRef.current) return;
    setIsTranslating(true);
    try {
      // 1. Get original text (transcription)
      let sourceText = "";
      if (activeTextTrack !== -1) {
        const track = textTracks[activeTextTrack];
        const res = await fetch(track.url);
        sourceText = await res.text();
      } else {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "No subtitles selected. Using auto-transcription... 🎙️",
          }),
        );
        // If no track is selected, we try to fetch the first one or default manifest
        if (textTracks.length > 0) {
          const res = await fetch(textTracks[0].url);
          sourceText = await res.text();
        } else {
          window.dispatchEvent(
            new CustomEvent("showToast", {
              detail: "Auto-transcribing video... this may take a moment ⏳",
            })
          );

          const transcribeRes = await fetch("/api/ai/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ sourceAudioUrl: safeUrl })
          });

          if (!transcribeRes.ok) throw new Error("Auto-transcription failed.");
          const transcribeData = await transcribeRes.json();
          sourceText = transcribeData.vtt || transcribeData.text;

          if (!sourceText) {
            throw new Error("No speech detected in video.");
          }
        }
      }

      // 2. Call Translation API
      const result = await translateMedia({
        text: sourceText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });

      setTranslatedScript(result.translatedVtt || result.translatedText);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Script translated! You can now edit it before dubbing. 📝",
        }),
      );
      return result.translatedVtt || result.translatedText;
    } catch (err) {
      console.error("Translation failed", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Translation failed. ❌",
        }),
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDubOnly = async (scriptOverride) => {
    if (!videoRef.current) return;
    const scriptToUse = (typeof scriptOverride === 'string') ? scriptOverride : translatedScript;

    if (!scriptToUse) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Please translate a script first! 📝",
        }),
      );
      return;
    }

    setIsTranslating(true);
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Dubbing audio... This may take a moment. 🎧",
        }),
      );

      // Call the TTS API with background merging choice
      const response = await fetch("/api/ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          text: scriptToUse,
          language: targetLang,
          voice: targetVoice,
          provider: "local",
          mergeBackground: mergeBackground,
          sourceAudioUrl: safeUrl,
        })
      });

      if (!response.ok) throw new Error("Dubbing failed at server");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const newTrack = {
        url: audioUrl,
        label: `AI Dub (${targetLang}) ${mergeBackground ? "+ Surround" : ""}`,
      };

      setAudioTracks((prev) => {
        const next = [...prev, newTrack];
        setTimeout(() => setActiveAudioTrack(next.length - 1), 100);
        return next;
      });

      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "AI Dubbing complete! Audio track added. 🎵",
        }),
      );
    } catch (err) {
      console.error("Dubbing failed", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Dubbing failed. ❌",
        }),
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleBassChange = (e) => {
    const value = Number(e.target.value);
    setBassBoost(value);
    setActiveEqPreset("custom");
    if (bassFilterRef.current && audioCtxRef.current) {
      try {
        bassFilterRef.current.gain.setTargetAtTime(
          value,
          audioCtxRef.current.currentTime,
          0.1,
        );
      } catch (err) {
        console.error("Bass boost gain setting failed:", err);
      }
    }
  };

  // --- WebRTC Live Dubbing Engine ---
  const toggleLiveDubbing = async () => {
    if (isLiveDubbing) {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (rtcPeerRef.current) rtcPeerRef.current.close();
      setIsLiveDubbing(false);
      // Restore original volume
      if (videoRef.current) videoRef.current.volume = 1;
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Live WebRTC Dubbing stopped. 🛑" }));
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        localStreamRef.current = stream;
        // Route Microphone through WebAudio API for Real-Time Voice Effects
        if (!audioCtxRef.current) initAudioEngine();
        const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        if (!audioCtxRef.current) audioCtxRef.current = ctx;

        const micSource = ctx.createMediaStreamSource(stream);
        const destNode = ctx.createMediaStreamDestination();

        // Apply selected Voice Effect to the Broadcast Stream
        if (activeVoiceEffect === 'robot') {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = 50;
          const ring = ctx.createGain();
          ring.gain.value = 0;
          osc.connect(ring.gain);
          osc.start();
          micSource.connect(ring).connect(destNode);
        } else if (activeVoiceEffect === 'alien') {
          const delay = ctx.createDelay();
          delay.delayTime.value = 0.05;
          micSource.connect(delay).connect(destNode);
          micSource.connect(destNode); // Mix wet and dry
        } else if (activeVoiceEffect === 'echo' || activeVoiceEffect === 'cave') {
          const delay = ctx.createDelay();
          delay.delayTime.value = activeVoiceEffect === 'cave' ? 0.15 : 0.3;
          const feedback = ctx.createGain();
          feedback.gain.value = activeVoiceEffect === 'cave' ? 0.6 : 0.4;
          micSource.connect(delay).connect(feedback).connect(delay);
          delay.connect(destNode);
          micSource.connect(destNode); // Mix wet and dry
        } else {
          // Dry Signal (Normal Voice)
          micSource.connect(destNode);
        }

        const trackToBroadcast = destNode.stream.getAudioTracks()[0];


        // Initialize WebRTC Peer Connection (Requires Signaling Server to exchange SDP)
        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        rtcPeerRef.current = pc;

        // Emit local ICE candidates to the global bus so the socket can broadcast them to viewers
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            window.dispatchEvent(new CustomEvent("webrtc-ice-candidate-emitted", {
              detail: { candidate: event.candidate, mediaId: media.url, to: "viewers" }
            }));
          }
        };

        pc.addTrack(trackToBroadcast, destNode.stream);

        // Generate the SDP offer to send to the signaling server (e.g., Socket.io)
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // Emit the WebRTC offer through global event bus to be picked up by the Socket Context
        window.dispatchEvent(new CustomEvent("webrtc-offer-created", {
          detail: { sdp: pc.localDescription, type: "dubbing", mediaId: media.url }
        }));

        // Duck the video volume so the mic doesn't catch heavy echo
        if (videoRef.current) videoRef.current.volume = 0.15;

        setIsLiveDubbing(true);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "WebRTC Live Dubbing started! Broadcasting... 🎙️" }));
      } catch (err) {
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Microphone access denied. ❌" }));
      }
    }
  };

  const handleTrebleChange = (e) => {
    const value = Number(e.target.value);
    setTrebleBoost(value);
    setActiveEqPreset("custom");
    if (trebleFilterRef.current && audioCtxRef.current) {
      trebleFilterRef.current.gain.setTargetAtTime(
        value,
        audioCtxRef.current.currentTime,
        0.1,
      );
    }
  };

  const applyEqPreset = (presetKey) => {
    if (EQ_PRESETS[presetKey]) {
      const preset = EQ_PRESETS[presetKey];
      setEqValues(preset.values);
      setBassBoost(preset.bass);
      setTrebleBoost(preset.treble);
      setActiveEqPreset(presetKey);
      if (audioCtxRef.current) {
        const t = audioCtxRef.current.currentTime;
        [60, 230, 910, 3600, 14000].forEach((freq) => {
          if (eqBandsRef.current[freq]) {
            eqBandsRef.current[freq].gain.setTargetAtTime(
              preset.values[freq],
              t,
              0.1,
            );
          }
        });
        if (bassFilterRef.current) {
          bassFilterRef.current.gain.setTargetAtTime(preset.bass, t, 0.1);
        }
        if (trebleFilterRef.current) {
          trebleFilterRef.current.gain.setTargetAtTime(preset.treble, t, 0.1);
        }
      }
    }
  };

  const handleVideoMetadata = (e) => {
    setDuration(e.target.duration);
    // If a start time was passed from the card, seek to it.
    if (startTime > 0) {
      e.target.currentTime = startTime;
    } else {
      try {
        const savedProgress = JSON.parse(localStorage.getItem("sociofest_video_progress")) || {};
        if (safeUrl && savedProgress[safeUrl] && savedProgress[safeUrl] < e.target.duration - 2) {
          e.target.currentTime = savedProgress[safeUrl];
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Resumed from checkpoint ⏯️" }));
        }
      } catch (err) { }
    }
  };

  const isRotated = Math.abs(rotation % 180) === 90;

  const getToolbarContainerClass = () => {
    const base = `transition-all duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`;
    if (uiPrefs.toolbarPosition === "bottom")
      return `${base} absolute bottom-[120px] left-4 right-16 md:right-24 z-[60]`;
    return `${base} absolute top-4 left-4 right-16 md:right-24 z-[60]`;
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-200"
      onWheel={handleWheel}
    >
      {/* Dynamic Subtitle Styles Injection */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-cue-video::cue {
          font-size: ${sanitizeCSS(subStyle.fontSize || 100)}%;
          color: ${sanitizeCSS(subStyle.color || "#ffffff")};
          background-color: ${sanitizeCSS(hexToRgba(subStyle.bgColor, subStyle.bgOpacity))};
          text-shadow: ${sanitizeCSS(getShadowCss(subStyle.textShadow))};
          font-family: ${sanitizeCSS(subStyle.fontFamily || "sans-serif")};
        }
        video::cue {
          font-size: ${sanitizeCSS(subStyle.fontSize || 100)}%;
          color: ${sanitizeCSS(subStyle.color || "#ffffff")};
          background-color: ${sanitizeCSS(hexToRgba(subStyle.bgColor, subStyle.bgOpacity))};
          text-shadow: ${sanitizeCSS(getShadowCss(subStyle.textShadow))};
          font-family: ${sanitizeCSS(subStyle.fontFamily || "sans-serif")};
        }
        video::-webkit-media-text-track-display {
          transform: translateY(-${sanitizeCSS(subStyle.positionY || 0)}px);
          transition: transform 0.2s ease-out;
        }
        video::-webkit-media-text-track-display-backdrop {
          background-color: ${sanitizeCSS(hexToRgba(subStyle.bgColor, subStyle.bgOpacity))};
        }
      `,
        }}
      />

      {/* Hidden Subtitle Input */}
      <input
        type="file"
        accept=".srt,.vtt"
        ref={subtitleInputRef}
        onChange={handleSubtitleUpload}
        className="hidden"
      />

      {/* Lock Screen UI */}
      {isLocked && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsLocked(false);
          }}
          className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 border border-white/30 text-white p-2 rounded-full transition-all shadow-2xl z-[10000]"
        >
          <Unlock className="w-5 h-5" />
        </button>
      )}

      {/* Dynamic Content Title Display */}
      {!hideTitle && media.title && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md pl-4 pr-1.5 py-1.5 rounded-full text-white/90 text-sm font-bold shadow-lg z-[80] flex items-center gap-3 max-w-[80vw] sm:max-w-[50vw] transition-opacity duration-300 ${showControls && !isLocked ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          {isNativeDolbyVision && (
            <div
              className="flex items-center gap-1.5 bg-purple-900/80 text-purple-200 px-2.5 py-0.5 rounded-full border border-purple-500/50 text-xs"
              title="Native Dolby Vision Stream"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>DV</span>
            </div>
          )}
          <span className="truncate">{media.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHideTitle(true);
            }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0 cursor-pointer"
            title="Hide Title"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Toolbar Mode (Independent XYZ relocation) */}
      {!isLocked && uiPrefs.toolbarPosition === "floating" && (
        <div
          className={`absolute inset-0 z-[60] pointer-events-none transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          {[...uiPrefs.toolbarOrder, "help", "stats", "settings"].map(
            (tool, index) => {
              const isCore = ["help", "stats", "settings"].includes(tool);
              let renderedTool = null;

              if (!isCore) renderedTool = renderTool(tool);
              else {
                if (tool === "help")
                  renderedTool = (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHelp(!showHelp);
                        setShowStats(false);
                        setShowUiSettings(false);
                        setShowFilters(false);
                        setShowEqualizer(false);
                        setShowTrackMenu(false);
                        setShowThumbnails(false);
                        setShowChapters(false);
                      }}
                      className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showHelp ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                      title="Player Documentation"
                    >
                      <HelpCircle className="w-5 h-5" />
                    </button>
                  );
                else if (tool === "stats")
                  renderedTool = (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStats(!showStats);
                        setShowHelp(false);
                        setShowUiSettings(false);
                        setShowFilters(false);
                        setShowEqualizer(false);
                        setShowTrackMenu(false);
                        setShowThumbnails(false);
                        setShowChapters(false);
                      }}
                      className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showStats ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                      title="Stats for Nerds (Codec Info)"
                    >
                      <Activity className="w-5 h-5" />
                    </button>
                  );
                else if (tool === "settings")
                  renderedTool = (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUiSettings(!showUiSettings);
                        setShowHelp(false);
                        setShowStats(false);
                        setShowFilters(false);
                        setShowEqualizer(false);
                        setShowTrackMenu(false);
                        setShowThumbnails(false);
                        setShowChapters(false);
                      }}
                      className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showUiSettings ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                      title="Customize Toolbar"
                    >
                      <LayoutTemplate className="w-5 h-5" />
                    </button>
                  );
              }

              if (!renderedTool) return null;

              const defaultX = 20 + (index % 8) * 55;
              const defaultY = 80 + Math.floor(index / 8) * 55;
              const pos = toolPositions[tool] || { x: defaultX, y: defaultY };

              return (
                <div
                  key={tool}
                  className="absolute flex items-center justify-center pointer-events-auto"
                  style={{ left: pos.x, top: pos.y }}
                >
                  <div className="relative group/floattool flex items-center justify-center">
                    {renderedTool}
                    <div
                      className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center cursor-move text-white shadow-md opacity-0 group-hover/floattool:opacity-100 transition-opacity z-10"
                      onMouseDown={(e) => handleIndividualToolDrag(e, tool)}
                      onTouchStart={(e) => handleIndividualToolDrag(e, tool)}
                      title="Drag to relocate"
                    >
                      <Move className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Top/Bottom Controls Row */}
      {!isLocked && uiPrefs.toolbarPosition !== "floating" && (
        <div
          className={getToolbarContainerClass()}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (controlsTimeoutRef.current)
              clearTimeout(controlsTimeoutRef.current);
          }}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (isPlaying) {
              if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(
                () => setShowControls(false),
                8000,
              );
            }
          }}
          onPointerLeave={(e) => {
            if (isPlaying) {
              if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(
                () => setShowControls(false),
                8000,
              );
            }
          }}
        >

          <div className="w-full py-1">
            <div
              className="flex flex-wrap items-center justify-start gap-2 sm:gap-3 px-2"
              onDragOver={handleDragOver}
              onDrop={(e) =>
                handleDrop(e, "active", uiPrefs.toolbarOrder.length)
              }
            >
              {uiPrefs.toolbarOrder.map((tool, index) => (
                <div
                  key={tool}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tool, "active")}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, "active", index)}
                  className="shrink-0 flex items-center cursor-grab active:cursor-grabbing rounded-full transition-colors group/draggable"
                  title={`Drag to move ${UI_LABELS[tool]}`}
                >
                  <GripVertical className="w-4 h-4 text-white/30 group-hover/draggable:text-white/80 hidden sm:block -ml-1 transition-colors" />
                  {renderTool(tool)}
                </div>
              ))}

              <div className="w-px h-6 bg-white/20 mx-1 shrink-0 my-auto"></div>

              {/* ALWAYS ACCESSIBLE TOOLS */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHelp(!showHelp);
                  setShowStats(false);
                  setShowUiSettings(false);
                  setShowFilters(false);
                  setShowEqualizer(false);
                  setShowTrackMenu(false);
                  setShowChapters(false);
                  setShowThumbnails(false);
                }}
                className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showHelp ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                title="Player Documentation"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStats(!showStats);
                  setShowHelp(false);
                  setShowUiSettings(false);
                  setShowFilters(false);
                  setShowEqualizer(false);
                  setShowTrackMenu(false);
                  setShowChapters(false);
                  setShowThumbnails(false);
                }}
                className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showStats ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                title="Stats for Nerds (Codec Info)"
              >
                <Activity className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUiSettings(!showUiSettings);
                  setShowHelp(false);
                  setShowStats(false);
                  setShowFilters(false);
                  setShowEqualizer(false);
                  setShowTrackMenu(false);
                  setShowChapters(false);
                  setShowThumbnails(false);
                }}
                className={`p-2 backdrop-blur-md rounded-full transition-colors shrink-0 border border-white/20 flex items-center gap-1 ${showUiSettings ? "bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "bg-black/60 text-white/70 hover:bg-white/20 hover:text-white"}`}
                title="Customize Toolbar"
              >
                <LayoutTemplate className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Right Controls */}
      {!isLocked && (
        <div
          className={`absolute top-4 right-4 flex flex-col gap-3 z-[1000] transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (controlsTimeoutRef.current)
              clearTimeout(controlsTimeoutRef.current);
          }}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (isPlaying) {
              if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(
                () => setShowControls(false),
                8000,
              );
            }
          }}
          onPointerLeave={(e) => {
            if (isPlaying) {
              if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(
                () => setShowControls(false),
                8000,
              );
            }
          }}
        >
          <button
            className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-red-500/80 hover:bg-red-500 backdrop-blur-xl border border-white/20 text-white rounded-full transition-all shadow-2xl group"
            onClick={handleClose}
            title="Close (Esc)"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
          </button>
          {!isEmbed &&
            safeUrl &&
            canDownload &&
            (media.type === "image" || media.type === "video") && (
              <>
                {subtitleUrl && currentUser?.role === "Admin" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement("a");
                      link.href = subtitleUrl;
                      link.setAttribute(
                        "download",
                        `subtitles-${Date.now()}.vtt`,
                      );
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}
                    className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white/80 hover:text-white rounded-full transition-all shadow-2xl group"
                    title="Download Subtitles (Admin)"
                  >
                    <Subtitles className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white/80 hover:text-white rounded-full transition-all shadow-2xl group"
                  title="Download media"
                >
                  <Download className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                </button>
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-white/80 hover:text-white rounded-full transition-all shadow-2xl group"
                  title="Open original media in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
                </a>
              </>
            )}
        </div>
      )}

      {/* Image Filters Panel */}
      {showFilters &&
        !isLocked &&
        (media.type === "image" || media.type === "video" || isEmbed) && (
          <MediaFiltersMenu
            filters={filters}
            setFilters={setFilters}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
            showCustomFilters={showCustomFilters}
            setShowCustomFilters={setShowCustomFilters}
            onClose={() => setShowFilters(false)}
            resetAll={resetAll}
          />
        )}

      {/* Help / Documentation Panel */}
      {showHelp && !isLocked && (
        <div
          className={`absolute top-20 left-1/2 -translate-x-1/2 backdrop-blur-xl p-6 rounded-2xl shadow-2xl z-[20000] w-[90vw] max-w-2xl max-h-[70vh] overflow-y-auto animate-in zoom-in-95 border ${getPanelTheme(appTheme)}`}
          onWheel={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-3">
            <h3 className="font-bold text-lg flex items-center gap-2 text-inherit">
              <HelpCircle className="w-5 h-5" /> Player Documentation
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="opacity-50 hover:opacity-100 p-1 bg-black/10 dark:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-6 text-sm opacity-90 leading-relaxed text-inherit">
            <div>
              <h4 className="font-bold opacity-100 mb-2 border-b border-inherit/10 pb-1 text-base">
                Keyboard Shortcuts
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 opacity-80">
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    Space
                  </kbd>{" "}
                  : Play / Pause
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    F
                  </kbd>{" "}
                  : Toggle Fullscreen
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    M
                  </kbd>{" "}
                  : Mute / Unmute
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    ←
                  </kbd>{" "}
                  /{" "}
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    →
                  </kbd>{" "}
                  : Seek backward / forward 10s
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    ↑
                  </kbd>{" "}
                  /{" "}
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    ↓
                  </kbd>{" "}
                  : Increase / Decrease volume
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    &lt;
                  </kbd>{" "}
                  /{" "}
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    &gt;
                  </kbd>{" "}
                  : Decrease / Increase speed
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    [
                  </kbd>{" "}
                  /{" "}
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    ]
                  </kbd>{" "}
                  : Set A-B Loop Start / End points
                </li>
                <li>
                  <kbd className="bg-black/20 dark:bg-white/20 px-1.5 py-0.5 rounded font-mono text-xs border border-inherit/20">
                    \
                  </kbd>{" "}
                  : Clear A-B Loop
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold opacity-100 mb-2 border-b border-inherit/10 pb-1 text-base">
                Advanced Features
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 opacity-80">
                <li>
                  <b>A-B Loop Trim:</b> Loop specific parts of a video, and
                  download just that trimmed segment.
                </li>
                <li>
                  <b>Dolby Atmos & Vision:</b> Emulate spatial 3D surround sound
                  and High Dynamic Range colors.
                </li>
                <li>
                  <b>AI Translate & Dub:</b> Instantly translate video audio to
                  other languages with an AI voiceover.
                </li>
                <li>
                  <b>HW/SW Decode:</b> Toggle between Hardware GPU processing
                  (faster) or Software CPU processing (more stable).
                </li>
                <li>
                  <b>Free Pan & Zoom:</b> Zoom into the video and freely drag it
                  around to focus on specific details.
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold opacity-100 mb-2 border-b border-inherit/10 pb-1 text-base">
                Customization
              </h4>
              <p className="opacity-80">
                Click the <b>Customize UI</b> (Layout) button on the toolbar to
                drag, drop, and rearrange the buttons exactly how you want them.
                You can also move the entire toolbar to the Top, Bottom, or make
                it Free-Floating.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Equalizer Panel */}
      {showEqualizer && !isLocked && media.type === "video" && !isEmbed && (
        <EqualizerMenu
          onClose={() => setShowEqualizer(false)}
          activeEqPreset={activeEqPreset}
          applyEqPreset={applyEqPreset}
          setActiveEqPreset={setActiveEqPreset}
          eqValues={eqValues}
          handleEqChange={handleEqChange}
          bassBoost={bassBoost}
          handleBassChange={handleBassChange}
          trebleBoost={trebleBoost}
          handleTrebleChange={handleTrebleChange}
          activeVoiceEffect={activeVoiceEffect}
          setActiveVoiceEffect={setActiveVoiceEffect}
          voiceEffectIntensity={voiceEffectIntensity}
          setVoiceEffectIntensity={setVoiceEffectIntensity}
          balance={balance}
          handleBalanceChange={handleBalanceChange}
        />
      )}

      {/* UI Settings Panel */}
      {showUiSettings && !isLocked && media.type === "video" && !isEmbed && (
        <CustomizeUIMenu
          uiPrefs={uiPrefs}
          setUiPrefs={setUiPrefs}
          UI_LABELS={UI_LABELS}
          onClose={() => setShowUiSettings(false)}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          moveTool={moveTool}
        />
      )}

      {/* Smart Chapters Panel */}
      {showChapters && !isLocked && media.type === "video" && (
        <SmartChaptersMenu
          onClose={() => setShowChapters(false)}
          videoRef={videoRef}
          duration={duration}
        />
      )}

      {/* Thumbnails Panel */}
      {showThumbnails && !isLocked && media.type === "video" && (
        <ThumbnailsMenu
          onClose={() => setShowThumbnails(false)}
          videoRef={videoRef}
          handleScreenshot={handleScreenshot}
        />
      )}

      {/* Codec & Performance Stats Panel */}
      {showStats && !isLocked && media.type === "video" && !isEmbed && (
        <MediaStatsMenu videoStats={videoStats} />
      )}

      {/* Track Selection Menu */}
      {showTrackMenu && !isLocked && media.type === "video" && !isEmbed && (
        <TrackSelectionMenu
          onClose={() => setShowTrackMenu(false)}
          audioTracks={audioTracks}
          activeAudioTrack={activeAudioTrack}
          handleAudioTrackChange={handleAudioTrackChange}
          textTracks={textTracks}
          activeTextTrack={activeTextTrack}
          handleTextTrackChange={handleTextTrackChange}
          subtitleInputRef={subtitleInputRef}
          showSubSettings={showSubSettings}
          setShowSubSettings={setShowSubSettings}
          subStyle={subStyle}
          setSubStyle={setSubStyle}
          defaultSubtitleStyle={defaultSubtitleStyle}
          sourceLang={sourceLang}
          setSourceLang={setSourceLang}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          targetVoice={targetVoice}
          setTargetVoice={setTargetVoice}
          isTranslating={isTranslating}
          handleAITranslate={handleAITranslate}
          resolutions={resolutions}
          activeResolution={activeResolution}
          handleResolutionChange={handleResolutionChange}
          translatedScript={translatedScript}
          setTranslatedScript={setTranslatedScript}
          handleTranslateOnly={handleTranslateOnly}
          handleDubOnly={handleDubOnly}
          mergeBackground={mergeBackground}
          setMergeBackground={setMergeBackground}
        />
      )}

      {/* Custom Video Controls Overlay */}
      {media.type === "video" && !isEmbed && (
        <>
          {/* Gesture Toast */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 text-white px-6 py-4 rounded-2xl backdrop-blur-md font-bold text-xl flex flex-col items-center justify-center gap-3 z-[10000] pointer-events-none transition-all duration-300 shadow-2xl ${gesture.active ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
          >
            {gesture.type === "volume" && <Volume2 className="w-10 h-10" />}
            {gesture.type === "brightness" && <Sun className="w-10 h-10" />}
            {gesture.type === "seek" && <FastForward className="w-10 h-10" />}
            {gesture.type === "forward" && (
              <FastForward className="w-10 h-10" />
            )}
            {gesture.type === "rewind" && <Rewind className="w-10 h-10" />}
            {gesture.type === "speed" && <FastForward className="w-10 h-10" />}
            {gesture.type === "play" && <Play className="w-10 h-10 ml-2" />}
            {gesture.type === "pause" && <Pause className="w-10 h-10" />}
            {gesture.text && <span>{gesture.text}</span>}
          </div>

          {/* Brightness Slider (Left Edge) */}
          <div
            className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 h-32 md:h-48 w-2 md:w-3 bg-black/40 backdrop-blur-md rounded-full overflow-hidden border border-white/20 z-[10000] flex flex-col justify-end transition-all duration-300 shadow-xl pointer-events-none ${(gesture.active && gesture.type) === "brightness" ? "opacity-100 -translate-x-0" : "opacity-0 -translate-x-6"}`}
          >
            <div
              className="bg-yellow-400 w-full transition-all duration-75"
              style={{ height: `${((filters.brightness - 20) / 180) * 100}%` }}
            />
          </div>

          {/* Volume Slider (Right Edge) */}
          <div
            className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 h-32 md:h-48 w-2 md:w-3 bg-black/40 backdrop-blur-md rounded-full overflow-hidden border border-white/20 z-[10000] flex flex-col justify-end transition-all duration-300 shadow-xl pointer-events-none ${gesture.active && gesture.type === "volume" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}
          >
            <div
              className="bg-white w-full transition-all duration-75"
              style={{ height: `${(videoRef.current?.volume || 0) * 100}%` }}
            />
          </div>

          {/* Controls Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 z-50 ${showControls && !isLocked ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (controlsTimeoutRef.current)
                clearTimeout(controlsTimeoutRef.current);
            }}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (isPlaying) {
                if (controlsTimeoutRef.current)
                  clearTimeout(controlsTimeoutRef.current);
                controlsTimeoutRef.current = setTimeout(
                  () => setShowControls(false),
                  8000,
                );
              }
            }}
            onPointerLeave={(e) => {
              if (isPlaying) {
                if (controlsTimeoutRef.current)
                  clearTimeout(controlsTimeoutRef.current);
                controlsTimeoutRef.current = setTimeout(
                  () => setShowControls(false),
                  8000,
                );
              }
            }}
          >
            <div className="max-w-5xl mx-auto flex flex-col gap-3">
              {/* Scrubber */}
              <div className="flex items-center gap-3 sm:gap-4 text-white drop-shadow-md">
                <span className="text-xs sm:text-sm font-mono font-bold w-10 sm:w-12 text-right">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    videoRef.current.currentTime = t;
                    setCurrentTime(t);
                  }}
                  className="flex-1 h-1.5 sm:h-2 bg-white/30 rounded-full appearance-none accent-indigo-500 cursor-pointer shadow-sm hover:h-2 sm:hover:h-3 transition-all"
                />
                <span className="text-xs sm:text-sm font-mono font-bold w-10 sm:w-12">
                  {formatTime(duration)}
                </span>
              </div>
              {/* Action Bar */}
              <div className="flex flex-col w-full mt-2 gap-3">
                {/* Primary Row: Playback & Essential */}
                <div className="flex items-center justify-between w-full">
                  {/* Left Controls */}
                  <div className="flex flex-1 items-center justify-start gap-2 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLocked(true);
                      }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors text-white shrink-0"
                      title="Lock Screen"
                    >
                      <Lock className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 group shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current)
                            videoRef.current.muted = !videoRef.current.muted;
                        }}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                      >
                        {videoRef.current?.muted ||
                          videoRef.current?.volume === 0 ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={videoRef.current?.volume || 1}
                        onChange={(e) => {
                          if (videoRef.current)
                            videoRef.current.volume = Number(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 sm:w-20 h-1.5 accent-white hidden sm:block transition-all"
                      />
                    </div>
                  </div>

                  {/* Center Controls */}
                  <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-6">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current)
                          videoRef.current.currentTime -= 10;
                      }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                      title="Rewind 10s"
                    >
                      <Rewind className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        initAudioEngine();
                        if (videoRef.current?.paused) videoRef.current.play();
                        else videoRef.current?.pause();
                      }}
                      className="p-3 sm:p-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white shadow-sm"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current pl-1" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current)
                          videoRef.current.currentTime += 10;
                      }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                      title="Forward 10s"
                    >
                      <FastForward className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                  </div>

                  {/* Right Controls */}
                  <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePiP();
                      }}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors text-white shrink-0 hidden sm:block"
                      title="Picture in Picture"
                    >
                      <PictureInPicture className="w-5 h-5" />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 hover:bg-white/20 rounded-full transition-colors text-white shrink-0"
                      title="Toggle Fullscreen"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Video controls hint toast */}
      {media.type === "video" && !isEmbed && !isLocked && (
        <div
          className={`absolute top-6 left-6 z-50 hidden md:flex flex-col gap-1 text-white/50 text-xs font-mono bg-black/40 p-3 rounded-lg border border-white/10 backdrop-blur-sm pointer-events-none transition-opacity duration-500 ${showKeymapHint ? "opacity-100" : "opacity-0"}`}
        >
          <p className="text-white/80 font-bold mb-1 border-b border-white/20 pb-1">
            Keyboard Controls
          </p>
          <p>Space : Play/Pause</p>
          <p>← / → : Seek 10s</p>
          <p>↑ / ↓ : Volume</p>
          <p>F : Fullscreen</p>
          <p>M : Mute</p>
          <p>&lt; / &gt; : Speed</p>
        </div>
      )}

      <div
        className="w-full h-full flex items-center justify-center"
        onClick={(e) => {
          if (!isPanning) e.stopPropagation();
        }}
      >
        {isEmbed ? (
          <div
            className="relative flex items-center justify-center w-full h-full touch-none select-none"
            onPointerDown={handleMediaPointerDown}
            onPointerMove={handleMediaPointerMove}
            onPointerUp={handleMediaPointerUp}
            onPointerCancel={handleMediaPointerUp}
            onPointerLeave={handleMediaPointerUp}
          >
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) scaleX(${flip.x}) scaleY(${flip.y}) rotate(${rotation}deg)`,
                filter: activeFilter,
                transition: isPanning
                  ? "none"
                  : "filter 0.2s ease-out, transform 0.2s ease-out",
                width: isRotated ? "95dvh" : "95dvw",
                height: isRotated ? "95dvw" : "95dvh",
                aspectRatio:
                  aspectRatio !== "auto"
                    ? aspectRatio.replace("/", " / ")
                    : "16 / 9",
              }}
              className="relative shrink-0 flex items-center justify-center shadow-2xl bg-black overflow-hidden rounded-xl"
            >
              <YouTubePlayer
                url={safeUrl}
                className="w-full h-full border-0 pointer-events-auto"
              />
            </div>
          </div>
        ) : media.type === "video" ? (
          <div
            key={safeUrl}
            className="relative w-full h-full flex items-center justify-center touch-none select-none"
            onPointerDown={handleMediaPointerDown}
            onPointerMove={handleMediaPointerMove}
            onPointerUp={handleMediaPointerUp}
            onPointerCancel={handleMediaPointerUp}
            onPointerLeave={handleMediaPointerUp}
          >
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) scaleX(${flip.x}) scaleY(${flip.y}) rotate(${rotation}deg)`,
                filter: activeFilter,
                boxShadow: isVisionOn
                  ? "0 0 50px rgba(255, 255, 255, 0.15)"
                  : "none",
                transition: isPanning
                  ? "none"
                  : "filter 0.2s ease-out, transform 0.2s ease-out",
                aspectRatio:
                  aspectRatio !== "auto"
                    ? aspectRatio.replace("/", " / ")
                    : undefined,
                width: isRotated ? "100dvh" : "100%",
                height: isRotated ? "100dvw" : "100%",
              }}
              className={`relative shrink-0 flex items-center justify-center shadow-2xl bg-black overflow-hidden ${isLocked ? "pointer-events-none" : ""}`}
            >
              <video
                ref={videoRef}
                poster={
                  safeUrl &&
                    !safeUrl.startsWith("blob:") &&
                    /\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(safeUrl)
                    ? safeUrl.replace(/\.[^/.]+$/, "_thumb.jpg")
                    : undefined
                }
                crossOrigin={
                  safeUrl?.startsWith("data:") || safeUrl?.startsWith("blob:")
                    ? undefined
                    : "anonymous"
                }
                draggable="false"
                autoPlay={media?.isPlaying !== false}
                onTimeUpdate={(e) => {
                  const t = e.target.currentTime;
                  setCurrentTime(t);
                  lastTimeRef.current = t;

                  if (!e.target._lastSaveTime || Math.abs(t - e.target._lastSaveTime) > 5) {
                    e.target._lastSaveTime = t;
                    try {
                      const savedProgress = JSON.parse(localStorage.getItem("sociofest_video_progress")) || {};
                      if (t > 2 && e.target.duration && t < e.target.duration - 2) {
                        savedProgress[safeUrl] = t;
                      } else if (e.target.duration && t >= e.target.duration - 2) {
                        delete savedProgress[safeUrl];
                      }
                      const keys = Object.keys(savedProgress);
                      if (keys.length > 50) delete savedProgress[keys[0]];
                      localStorage.setItem("sociofest_video_progress", JSON.stringify(savedProgress));
                    } catch (err) { }
                  }

                  if (!duration || isNaN(duration) || duration === 0) {
                    if (
                      e.target.duration &&
                      !isNaN(e.target.duration) &&
                      e.target.duration !== Infinity
                    ) {
                      setDuration(e.target.duration);
                    }
                  }

                  if (loopB !== null && e.target.currentTime >= loopB) {
                    if (isRecordingLoopRef.current) {
                      if (mediaRecorderRef.current?.state === "recording") {
                        mediaRecorderRef.current.stop();
                      }
                      setIsRecordingLoop(false);
                      e.target.pause();
                    } else if (loopA !== null) {
                      e.target.currentTime = loopA;
                    }
                  }
                }}
                onLoadedMetadata={handleVideoMetadata}
                onDurationChange={(e) => {
                  if (
                    e.target.duration &&
                    !isNaN(e.target.duration) &&
                    e.target.duration !== Infinity
                  ) {
                    setDuration(e.target.duration);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={(e) => {
                  if (isBackgroundPlayEnabled && document.hidden) {
                    e.target.play().catch(() => setIsPlaying(false));
                  } else {
                    setIsPlaying(false);
                  }
                }}
                style={{ objectFit: objectFit }}
                className="custom-cue-video w-full h-full outline-none"
              >
                {subtitleUrl && (
                  <track
                    key={subtitleUrl}
                    kind="subtitles"
                    src={subtitleUrl}
                    srcLang="en"
                    label="Local Subtitles"
                    default
                  />
                )}
              </video>

              {/* Custom Subtitle Overlay Engine */}
              {subStyle.useCustomEngine && activeCues.length > 0 && (
                <div
                  className="absolute pointer-events-none flex flex-col items-center w-full left-0 right-0 z-40 transition-transform duration-200"
                  style={{ bottom: `calc(5% + ${subStyle.positionY || 0}px)` }}
                >
                  {activeCues.map((cue, idx) => (
                    <span
                      key={idx}
                      className="text-center px-4 py-1 max-w-[90%] break-words mt-1 inline-block rounded-md"
                      style={{
                        fontSize: `calc(${(subStyle.fontSize || 100) / 100} * 3vmin)`,
                        color: subStyle.color || "#ffffff",
                        backgroundColor: hexToRgba(
                          subStyle.bgColor,
                          subStyle.bgOpacity,
                        ),
                        textShadow: getShadowCss(subStyle.textShadow),
                        fontFamily: subStyle.fontFamily || "sans-serif",
                        lineHeight: "1.4",
                      }}
                    >
                      {cue.split("\n").map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i !== cue.split("\n").length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <audio
              ref={customAudioRef}
              crossOrigin="anonymous"
              preload="auto"
              className="hidden"
            />
          </div>
        ) : media.type === "audio" ? (
          <div
            key={safeUrl}
            className="relative flex flex-col items-center justify-center w-full h-full touch-none select-none bg-black/50"
            onPointerDown={handleMediaPointerDown}
            onPointerMove={handleMediaPointerMove}
            onPointerUp={handleMediaPointerUp}
            onPointerCancel={handleMediaPointerUp}
            onPointerLeave={handleMediaPointerUp}
          >
            <div className="flex flex-col items-center justify-center gap-6 p-12 bg-[#1e1e1e] rounded-3xl shadow-2xl border border-white/10">
              <Headphones className="w-32 h-32 text-blue-500 opacity-80" />
              <h3 className="text-white text-xl font-bold">{media.title || "Audio Playback"}</h3>
              <audio controls src={safeUrl} className="w-full min-w-[300px]" autoPlay />
            </div>
          </div>
        ) : (
          <div
            key={safeUrl}
            className="relative flex items-center justify-center w-full h-full touch-none select-none"
            style={{
              cursor: isLocked ? "default" : isPanning ? "grabbing" : "grab",
            }}
            onPointerDown={handleMediaPointerDown}
            onPointerMove={handleMediaPointerMove}
            onPointerUp={handleMediaPointerUp}
            onPointerCancel={handleMediaPointerUp}
            onPointerLeave={handleMediaPointerUp}
          >
            <img
              ref={imgRef}
              crossOrigin={
                safeUrl?.startsWith("data:") || safeUrl?.startsWith("blob:")
                  ? undefined
                  : "anonymous"
              }
              referrerPolicy="no-referrer"
              src={safeUrl}
              alt="Fullscreen"
              onError={(e) => {
                if (e.target.crossOrigin) {
                  e.target.crossOrigin = null;
                  e.target.src = safeUrl; // Trigger reload without CORS
                }
              }}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${flip.x}) scaleY(${flip.y})`,
                filter: activeFilter,
                transition: isPanning
                  ? "none"
                  : "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                transformOrigin: "center center",
                maxWidth: isRotated ? "95dvh" : "95dvw",
                maxHeight: isRotated ? "95dvw" : "95dvh",
              }}
              className="object-contain select-none drop-shadow-2xl shrink-0"
              draggable="false"
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default FullscreenMediaModal;
