
import React, { useState, useRef } from "react";
import { Mic, Volume2, Trash2, CheckCircle2, AlertCircle, Upload, Play, Square } from "lucide-react";
import { apiClient } from "@/services/apiClient";

const VoiceSettings = ({ user }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(true); // Placeholder for status check
  const [status, setStatus] = useState("idle"); // idle, recording, preview, uploading, success, error
  const [errorMessage, setErrorMessage] = useState("");
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setStatus("preview");
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatus("recording");
    } catch (err) {
      console.error("Microphone access denied:", err);
      setErrorMessage("Microphone access denied. Please check your browser permissions.");
      setStatus("error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    
    setStatus("uploading");
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice_profile.wav");
    
    try {
      await apiClient.post("/ai/upload-voice", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setStatus("success");
      window.dispatchEvent(new CustomEvent("showToast", { 
        detail: "Voice profile cloned successfully! 🎙️" 
      }));
    } catch (err) {
      console.error("Voice upload failed:", err);
      setErrorMessage(err.response?.data?.message || "Failed to upload voice profile.");
      setStatus("error");
    }
  };

  const reset = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setStatus("idle");
    setErrorMessage("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-2">
          <Volume2 className="w-5 h-5" />
          AI Voice Cloning
        </h3>
        <p className="text-sm text-indigo-600/80 dark:text-indigo-400/80 leading-relaxed">
          Record a 5-10 second clip of your voice. Our AI will analyze your unique tone and cadence to generate high-fidelity speech that sounds exactly like you.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-inherit/20 rounded-3xl bg-black/5 dark:bg-white/5 space-y-6">
        {status === "idle" && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Mic className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-lg">Ready to Record</p>
              <p className="text-sm opacity-60">"The quick brown fox jumps over the lazy dog."</p>
            </div>
            <button
              onClick={startRecording}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              <Mic className="w-5 h-5" /> Start Recording
            </button>
          </div>
        )}

        {status === "recording" && (
          <div className="text-center space-y-4 w-full">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping"></div>
              <div className="absolute inset-0 bg-red-500/40 rounded-full animate-pulse"></div>
              <div className="relative z-10 w-full h-full bg-red-500 rounded-full flex items-center justify-center">
                <Square className="w-8 h-8 text-white fill-current" />
              </div>
            </div>
            <p className="font-bold text-red-500 animate-pulse uppercase tracking-widest">Recording...</p>
            <button
              onClick={stopRecording}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              Stop & Preview
            </button>
          </div>
        )}

        {status === "preview" && (
          <div className="text-center space-y-6 w-full max-w-md">
            <div className="p-4 bg-black/10 dark:bg-white/10 rounded-2xl border border-inherit/10">
              <audio src={audioUrl} controls className="w-full h-10 accent-indigo-500" />
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-6 py-2 border border-inherit/30 hover:bg-red-500/10 hover:text-red-500 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Re-record
              </button>
              <button
                onClick={handleUpload}
                className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Clone My Voice
              </button>
            </div>
          </div>
        )}

        {status === "uploading" && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-bold text-indigo-500">Analyzing voice profile...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-emerald-500 text-lg">Voice Cloned!</p>
              <p className="text-sm opacity-60">Your AI will now sound exactly like you.</p>
            </div>
            <button
              onClick={reset}
              className="px-8 py-3 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              Update Profile
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-red-500 text-lg">Oops!</p>
              <p className="text-sm text-red-500/80">{errorMessage}</p>
            </div>
            <button
              onClick={reset}
              className="px-8 py-3 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 mx-auto"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-inherit/10 flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
            <Play className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-bold">Try Sample Text</p>
            <p className="text-xs opacity-60 mt-0.5">Test your cloned voice after upload.</p>
          </div>
        </div>
        <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-inherit/10 flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold">Privacy Note</p>
            <p className="text-xs opacity-60 mt-0.5">Your voice data is encrypted and only used for your account.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;
