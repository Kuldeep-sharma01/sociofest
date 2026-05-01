import React, { useState, useRef } from "react";
import { X, Image, Sparkles, Camera, Download, Upload } from "lucide-react";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { generateContent } from "@/services/aiService";
import { useTheme } from "@/context/ThemeContext";
import { getPanelTheme, getPrimaryButtonClasses } from "@/utils/themeUtils";

const ThumbnailsMenu = ({ onClose, videoRef, handleScreenshot }) => {
  const [aiThumbnail, setAiThumbnail] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);

  // Cropping State
  const [uploadedImage, setUploadedImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const { appTheme } = useTheme();

  // Helper to center the initial crop selection
  function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
      mediaWidth,
      mediaHeight
    );
  }

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 16 / 9));
  };

  const generateAiThumbnail = async () => {
    setIsGenerating(true);
    try {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Generating AI Thumbnail... ⏳" }));
      const response = await generateContent({ prompt: "Generate a captivating YouTube thumbnail background.", contentType: "image_generation" });
      setAiThumbnail(response.generated_content || response.imageUrl || "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&q=80"); 
      window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Thumbnail ready! ✨" }));
    } catch(e) {
      console.error("AI Thumbnail Gen Error:", e);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Generation failed. ❌" }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAiThumbnail(null); // Clear any previous thumbnail
      const url = URL.createObjectURL(file);
      setUploadedImage(url); // Set the image for cropping
    }
  };

  const handleApplyCrop = () => {
    if (!completedCrop || !imgRef.current) {
      console.error("Crop or image ref not available.");
      return;
    }
    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = Math.floor(completedCrop.width * scaleX);
    canvas.height = Math.floor(completedCrop.height * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (aiThumbnail) URL.revokeObjectURL(aiThumbnail);

      const newUrl = URL.createObjectURL(blob);
      setAiThumbnail(newUrl);
      setUploadedImage(null); // Hide cropper
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Thumbnail cropped and applied! ✨",
        }),
      );
    }, "image/jpeg");
  };

  return (
    <div className={`fixed sm:absolute top-1/2 sm:top-20 left-1/2 sm:left-4 -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[100] w-[90vw] sm:w-72 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 sm:slide-in-from-left-4 border ${getPanelTheme(appTheme)}`}>
      <div className="flex justify-between items-center mb-4 border-b border-inherit/20 pb-2">
        <h3 className="font-bold text-sm text-inherit flex items-center gap-2"><Image className="w-4 h-4"/> Custom Thumbnail</h3>
        <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4 text-inherit"/></button>
      </div>

      <div className="flex flex-col gap-3">
        {uploadedImage ? (
          <div className="flex flex-col gap-3 animate-in fade-in">
            <div className="bg-black/20 p-2 rounded-lg border border-inherit/20">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={16 / 9}
                className="max-h-[300px]"
              >
                <img ref={imgRef} alt="Crop preview" src={uploadedImage} onLoad={onImageLoad} className="w-full" />
              </ReactCrop>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setUploadedImage(null); if (fileInputRef.current) fileInputRef.current.value = null; }} className="flex-1 bg-black/20 hover:bg-white/10 text-inherit text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-inherit/20">Cancel</button>
              <button onClick={handleApplyCrop} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">Apply Crop</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={handleScreenshot} className="w-full bg-black/20 hover:bg-white/10 text-inherit text-xs font-bold px-3 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border border-inherit/20 shadow-sm">
              <Camera className="w-4 h-4"/> Capture Current Frame
            </button>

            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-black/20 hover:bg-white/10 text-inherit text-xs font-bold px-3 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 border border-inherit/20 shadow-sm">
              <Upload className="w-4 h-4"/> Upload Custom Thumbnail
            </button>

            <div className="relative border-t border-inherit/20 pt-3 mt-1">
              {aiThumbnail ? (
                <div className="flex flex-col gap-2">
                  <img src={aiThumbnail} className="w-full aspect-video object-cover rounded-lg border border-inherit/30 shadow-md" alt="AI Thumbnail" />
                  <div className="flex gap-2">
                    <button onClick={() => { const a = document.createElement('a'); a.href = aiThumbnail; a.download = `SocioFest_Thumbnail_${Date.now()}.jpg`; a.click(); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
                      <Download className="w-3 h-3"/> Download
                    </button>
                    <button onClick={() => setAiThumbnail(null)} className="px-2 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors text-xs font-bold"><X className="w-3 h-3"/></button>
                  </div>
                </div>
              ) : (
            <button onClick={generateAiThumbnail} disabled={isGenerating} className={`w-full disabled:opacity-50 text-xs font-bold px-3 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md ${getPrimaryButtonClasses(appTheme)}`}>
                  {isGenerating ? <div className="loader" style={{'--s': '12px', '--g': '3px'}}/> : <><Sparkles className="w-4 h-4"/> Generate with AI</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default ThumbnailsMenu;
