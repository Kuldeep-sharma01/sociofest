import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { ShieldAlert, ShieldCheck, CameraOff } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const AntiCheatMonitor = ({ onViolation, isStrict = true }) => {
  const videoRef = useRef(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [status, setStatus] = useState("Initializing Proctor AI...");
  const [isViolating, setIsViolating] = useState(false);
  const violationTimerRef = useRef(null);
  const streamRef = useRef(null);
  const { appTheme } = useTheme();

  // 1. Load the lightweight face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models"; // Ensure you place the face-api models in your public/models folder
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
        setStatus("Models loaded. Starting camera...");
      } catch (error) {
        console.error("Failed to load face-api models", error);
        setStatus("Error loading Proctor AI.");
      }
    };
    loadModels();
  }, []);

  // 2. Start the user's camera securely
  useEffect(() => {
    if (!isModelLoaded) return;

    const startCamera = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
      } catch (err) {
        console.error("Camera access denied", err);
        setStatus("Camera access denied! Required for this quiz.");
        if (onViolation) onViolation("camera_denied");
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isModelLoaded, onViolation]);

  // 3. Tab/Window Focus Monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStatus("Warning: Tab switched!");
        handleViolation("tab_switch");
      } else {
        setStatus("Monitoring active.");
        clearViolationTimer();
      }
    };

    const handleBlur = () => {
      setStatus("Warning: Window lost focus!");
      handleViolation("window_blur");
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onViolation]);

  // 4. The Detection Loop
  useEffect(() => {
    if (!isModelLoaded) return;
    let interval;

    const handlePlay = () => {
      if (interval) clearInterval(interval); // Prevent overlapping intervals on re-play
      // Run the detection check every 1.5 seconds
      interval = setInterval(async () => {
        if (
          !videoRef.current ||
          videoRef.current.paused ||
          videoRef.current.ended
        )
          return;

        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 160,
            scoreThreshold: 0.5,
          }),
        );

        if (detections.length === 0) {
          setStatus("Warning: Face not visible!");
          handleViolation("no_face");
        } else if (detections.length > 1) {
          setStatus("Warning: Multiple people detected!");
          handleViolation("multiple_faces");
        } else {
          // Exact 1 face is looking at the screen
          setStatus("Monitoring active.");
          clearViolationTimer();
        }
      }, 1500);
    };

    if (videoRef.current) videoRef.current.addEventListener("play", handlePlay);

    return () => {
      clearInterval(interval);
      clearViolationTimer();
      if (videoRef.current)
        videoRef.current.removeEventListener("play", handlePlay);
    };
  }, [isModelLoaded]);

  const handleViolation = (type) => {
    setIsViolating(true);
    // Give the student a 5-second grace period before officially logging a cheat attempt
    if (!violationTimerRef.current) {
      violationTimerRef.current = setTimeout(() => {
        if (onViolation) onViolation(type);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "⚠️ Focus Violation Logged!",
          }),
        );
        violationTimerRef.current = null;
      }, 5000);
    }
  };

  const clearViolationTimer = () => {
    setIsViolating(false);
    if (violationTimerRef.current) {
      clearTimeout(violationTimerRef.current);
      violationTimerRef.current = null;
    }
  };

  return (
    <div
      className={`fixed bottom-6 right-6 w-48 p-3 rounded-2xl shadow-2xl backdrop-blur-md border z-[100] transition-colors duration-300 ${isViolating ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] bg-red-500/10 text-red-500" : `${getCardThemeClasses(appTheme)} border-inherit/30`}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider opacity-90 flex items-center gap-1.5">
            {isViolating ? (
              <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            )}{" "}
            Proctor AI
          </span>
          <div
            className={`w-2 h-2 rounded-full ${isViolating ? "bg-red-500 animate-ping" : status.includes("Monitoring") ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"}`}
          />
        </div>
        {status.includes("denied") ? (
          <div className="w-full aspect-video bg-red-900/50 rounded-lg flex flex-col items-center justify-center text-red-200">
            <CameraOff className="w-6 h-6 mb-1 opacity-80" />
            <span className="text-[10px] font-bold">Camera Blocked</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full aspect-video bg-black/50 rounded-lg object-cover ${!isStrict ? "hidden" : ""}`}
          />
        )}
        {!isModelLoaded && (
          <div className="absolute inset-0 flex items-center justify-center top-8">
            <div
              className="loader"
              style={{ "--s": "15px", "--g": "3px" }}
            ></div>
          </div>
        )}
        <p
          className={`text-[10px] leading-tight font-semibold text-center ${isViolating ? "text-red-400" : "opacity-80"}`}
        >
          {status}
        </p>
      </div>
    </div>
  );
};

export default AntiCheatMonitor;
