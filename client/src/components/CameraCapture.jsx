'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Camera, RotateCcw, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { assessFace } from '@/services/aiService';
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

export default function CameraCapture({
  onCapture,
  onCancel,
  title = 'Capture Image',
  description = 'Position your face in the center of the frame',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [assessment, setAssessment] = useState(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const assessmentTimerRef = useRef(null);
  const { appTheme } = useTheme();

  useEffect(() => {
    enumerateDevices();
    startCamera();
    return () => {
      stopCamera();
      if (assessmentTimerRef.current) clearInterval(assessmentTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cameraActive && !loading) {
      assessmentTimerRef.current = setInterval(runAssessment, 2000);
    } else {
      if (assessmentTimerRef.current) clearInterval(assessmentTimerRef.current);
    }
    return () => {
      if (assessmentTimerRef.current) clearInterval(assessmentTimerRef.current);
    };
  }, [cameraActive, loading]);

  const runAssessment = async () => {
    if (!videoRef.current || !canvasRef.current || isAssessing) return;

    try {
      setIsAssessing(true);
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const res = await assessFace(blob);
          if (res.success) {
            setAssessment(res.assessment);
          }
        } catch (err) {
          console.warn("Assessment failed:", err.message);
          // Don't show toast for periodic assessment failures to avoid spam
        } finally {
          setIsAssessing(false);
        }
      }, 'image/jpeg', 0.5); // Lower quality for assessment is fine
    } catch (err) {
      setIsAssessing(false);
    }
  };

  const enumerateDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  const startCamera = async (deviceId = selectedDeviceId) => {
    try {
      setLoading(true);
      setError('');
      stopCamera(); // Stop existing before starting new

      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: 'user' },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        // If we didn't have a deviceId yet, find it from the stream
        if (!deviceId) {
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          if (settings.deviceId) setSelectedDeviceId(settings.deviceId);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera. Please check permissions.';
      setError(message);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${message} ⚠️` }));
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleDeviceChange = (newDeviceId) => {
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    try {
      setLoading(true);
      setError('');

      const context = canvasRef.current.getContext('2d');
      if (!context) throw new Error('Canvas context not available');

      if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
        throw new Error('Video stream is not fully initialized yet. Please wait a moment.');
      }

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      context.drawImage(videoRef.current, 0, 0);

      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to capture image');
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to capture image ❌" }));
          setLoading(false);
          return;
        }

        try {
          await onCapture(blob);
          stopCamera();
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Image captured successfully! 📸" }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to process image';
          setError(msg);
          window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
        } finally {
          setLoading(false);
        }
      }, 'image/jpeg');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to capture image';
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      setError('');
      await onCapture(file);
      stopCamera();
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Photo uploaded successfully! 📸" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process uploaded image';
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-4 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
      <div>
        <h3 className="text-lg font-semibold mb-1 text-inherit">{title}</h3>
        <p className="text-sm opacity-70 text-inherit">{description}</p>
      </div>

      {devices.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
              <Camera className="w-3 h-3" /> 
              {devices.length > 1 ? "Switch Camera Source" : "Active Camera Device"}
            </label>
            {devices.length > 1 && <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">Multiple Detected</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {devices.map((device, index) => (
              <button
                key={device.deviceId}
                onClick={() => handleDeviceChange(device.deviceId)}
                className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all border-2 text-left flex items-center justify-between ${
                  selectedDeviceId === device.deviceId
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]"
                    : "bg-white/5 border-inherit/20 hover:bg-white/10 opacity-70"
                }`}
              >
                <span className="truncate pr-2">{device.label || `Camera ${index + 1}`}</span>
                {selectedDeviceId === device.deviceId && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      <div className="relative bg-black rounded-2xl overflow-hidden w-full min-h-[300px] sm:min-h-[400px] border-4 border-inherit/10 shadow-inner flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${(devices.find(d => d.deviceId === selectedDeviceId)?.label?.toLowerCase().includes('back') || devices.find(d => d.deviceId === selectedDeviceId)?.label?.toLowerCase().includes('environment')) ? "" : "scale-x-[-1]"} ${cameraActive ? "opacity-100" : "opacity-0"}`}
        />
        
        {!cameraActive && (
          <div className="flex items-center justify-center h-full z-0">
            <div className="text-center">
              <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2 animate-pulse" />
              <p className="text-gray-400 font-medium">Initializing Camera...</p>
            </div>
          </div>
        )}

        {/* Face detection outline and quality indicators */}
        {cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className={`w-48 h-64 sm:w-64 sm:h-80 border-4 rounded-[40px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center transition-all duration-500 ${assessment?.score >= 60 ? 'border-green-500 shadow-green-500/10' : 'border-blue-400/50'}`}>
               <div className={`w-full h-full border-4 rounded-[40px] animate-pulse opacity-50 ${assessment?.score >= 60 ? 'border-green-400' : 'border-blue-400'}`} />
               
               {assessment && (
                 <div className="absolute -bottom-12 flex gap-2">
                    <QualityIndicator label="Centered" active={assessment.is_centered} />
                    <QualityIndicator label="Straight" active={assessment.is_looking_straight} />
                    <QualityIndicator label="Sharp" active={assessment.is_sharp} />
                 </div>
               )}
            </div>
            
            {assessment && assessment.score < 60 && (
              <div className="mt-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <p className="text-white text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                  {assessment.score < 40 ? "Position your face clearly" : "Almost there, look straight"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex gap-3">
        <Button
          onClick={captureImage}
          disabled={!cameraActive || loading}
          className="flex-1"
          size="lg"
        >
          {loading ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Capture
            </>
          )}
        </Button>

        <Button
          onClick={startCamera}
          variant="outline"
          disabled={cameraActive || loading}
          size="lg"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>

        {!cameraActive && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            disabled={loading}
            size="lg"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Photo
          </Button>
        )}

        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={loading}
            size="lg"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

const QualityIndicator = ({ label, active }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${active ? 'bg-green-500 text-white' : 'bg-white/10 text-white/40'}`}>
    {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
    {label}
  </div>
);
