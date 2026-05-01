'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Camera, RotateCcw, Upload } from 'lucide-react';
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
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const { appTheme } = useTheme();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to access camera. Please check permissions.';
      setError(message);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${message} ⚠️` }));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
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

      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 flex shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden aspect-video w-full">
        {cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400">Camera not started</p>
            </div>
          </div>
        )}

        {/* Face detection outline */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-80 border-2 border-blue-400 rounded-lg opacity-50" />
        </div>
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
