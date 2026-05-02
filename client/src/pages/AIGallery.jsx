import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";
import { useTheme } from "@/context/ThemeContext";
import {
  Grid,
  List as ListIcon,
  Trash2,
  Download,
  Search,
  CheckSquare,
  Image as ImageIcon,
  Video,
  FileText,
  Calendar,
  CheckCircle,
  X,
  Maximize2
} from "lucide-react";
import FullscreenMediaModal from "@/components/ui/FullscreenMediaModal";
import DocumentViewer from "@/components/ui/DocumentViewer";
import EmptyState from "@/components/ui/EmptyState";
import { getCardThemeClasses, getPrimaryButtonClasses, getBannerThemeClasses } from "@/utils/themeUtils";

const AIGallery = () => {
  const user = useSelector((state) => state.auth.user);
  const { appTheme, isDark } = useTheme();

  const [images, setImages] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);

  useEffect(() => {
    const loadGallery = () => {
      try {
        const history = JSON.parse(localStorage.getItem("ai_image_gallery") || "[]");
        // Ensure every item has an ID and a parsed date
        const formattedHistory = history.map(item => ({
          ...item,
          id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
          date: item.date || new Date().toISOString(),
          type: item.type || (item.url?.startsWith("data:video") ? "video" : "image")
        }));
        setImages(formattedHistory);
      } catch (e) {
        console.error("Failed to load gallery", e);
        setImages([]);
      }
    };
    loadGallery();
    
    window.addEventListener("storage", loadGallery);
    return () => window.removeEventListener("storage", loadGallery);
  }, []);

  const filteredImages = useMemo(() => {
    return images.filter(img =>
      (img.prompt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (img.provider || "").toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [images, searchQuery]);

  const toggleSelection = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this media?")) return;
    const updatedImages = images.filter((img) => img.id !== id);
    setImages(updatedImages);
    setSelectedItems(prev => prev.filter(item => item !== id));
    localStorage.setItem("ai_image_gallery", JSON.stringify(updatedImages));
    window.dispatchEvent(new CustomEvent("showToast", { detail: "Item deleted! 🗑️" }));
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Delete ${selectedItems.length} selected items?`)) return;
    const updatedImages = images.filter((img) => !selectedItems.includes(img.id));
    setImages(updatedImages);
    setSelectedItems([]);
    setIsSelectionMode(false);
    localStorage.setItem("ai_image_gallery", JSON.stringify(updatedImages));
    window.dispatchEvent(new CustomEvent("showToast", { detail: `${selectedItems.length} items deleted! 🗑️` }));
  };

  const handleDownload = async (url, prompt, type, e) => {
    if (e) e.stopPropagation();
    try {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Preparing download... ⏳" }));
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `AI_${(prompt || "Media").substring(0, 20).replace(/[^a-z0-9]/gi, '_')}.${type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Downloaded successfully! 📥" }));
    } catch (err) {
      // Fallback for strict CORS environments
      const a = document.createElement("a");
      a.href = url;
      a.download = `AI_${(prompt || "Media").substring(0, 20).replace(/[^a-z0-9]/gi, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const openMedia = (img) => {
    if (img.type === "document" || img.url.endsWith(".pdf") || img.url.endsWith(".txt")) {
      setViewerFile({ 
        url: img.url, 
        title: img.prompt || "Document", 
        authorId: user?._id, 
        isDownloadable: true 
      });
    } else {
      setFullscreenMedia({
        url: img.url,
        type: img.type || (img.url.startsWith("data:video") ? "video" : "image"),
        title: img.prompt || "AI Generated Media",
        authorId: user?._id,
        isDownloadable: true
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-[calc(100vh-64px)] flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-indigo-500 to-purple-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <ImageIcon className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
              AI Media Gallery
            </h1>
            <p className="opacity-90 mt-2 text-base md:text-lg font-medium max-w-xl">
              Manage your locally saved AI generated images and videos securely.
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl font-bold border border-white/30 shadow-sm flex items-center gap-2 shrink-0">
            <CheckCircle className="w-5 h-5"/> {images.length} Items Saved
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 text-inherit" />
          <input
            type="text"
            placeholder="Search by prompt or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-sm text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="bg-black/5 dark:bg-white/5 p-1 rounded-xl flex shadow-inner border border-inherit/30 w-full sm:w-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "grid" ? "bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${viewMode === "list" ? "bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) setSelectedItems([]);
            }}
            className={`px-4 py-1.5 rounded-xl font-bold text-sm transition-all border flex items-center gap-2 ${isSelectionMode ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" : "bg-transparent text-inherit border-inherit/30 opacity-70 hover:opacity-100"}`}
          >
            <CheckSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{isSelectionMode ? "Cancel Select" : "Select"}</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 dark:bg-white/10 backdrop-blur-xl text-white dark:text-inherit px-6 py-3 rounded-full flex items-center gap-4 z-[100] shadow-2xl border border-inherit/20 animate-in slide-in-from-bottom-4">
          <span className="font-bold text-sm">{selectedItems.length} Selected</span>
          <div className="w-px h-4 bg-inherit/30"></div>
          <button onClick={handleBulkDelete} className="flex items-center gap-1.5 text-sm font-bold hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button onClick={() => { setSelectedItems([]); setIsSelectionMode(false); }} className="flex items-center gap-1.5 text-sm font-bold opacity-70 hover:opacity-100 transition-colors">
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      )}

      {/* Media Gallery */}
      {images.length === 0 ? (
        <EmptyState 
          icon={ImageIcon} 
          title="Your gallery is empty" 
          description="Start generating images and videos in the AI Hub to see them here!" 
        />
      ) : filteredImages.length === 0 ? (
        <EmptyState 
          icon={Search} 
          title="No results found" 
          description={`No media matches your search for "${searchQuery}"`} 
        />
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" : "flex flex-col gap-3"}>
          {filteredImages.map((img) => {
            const isSelected = selectedItems.includes(img.id);
            
            if (viewMode === "list") {
              return (
                <div 
                  key={img.id} 
                  className={`${getCardThemeClasses(appTheme)} p-3 rounded-xl shadow-sm border hover:shadow-md transition-all flex items-center gap-4 ${isSelectionMode ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-500/5" : "border-inherit/30"}`}
                  onClick={() => isSelectionMode ? toggleSelection(img.id) : openMedia(img)}
                >
                  {(isSelectionMode || isSelected) && (
                    <div className="shrink-0 flex items-center justify-center pl-2">
                      <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded text-indigo-600 cursor-pointer pointer-events-none" />
                    </div>
                  )}
                  <div className="w-16 h-16 rounded-lg bg-black/10 dark:bg-white/10 shrink-0 overflow-hidden relative cursor-pointer" onClick={(e) => { e.stopPropagation(); openMedia(img); }}>
                    {img.type === "video" ? (
                      <video src={img.url} aria-label={`AI Generated Video Thumbnail: ${img.prompt}`} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <img src={img.url} className="w-full h-full object-cover" alt={`AI Generated Image Thumbnail: ${img.prompt}`} />
                    )}
                    {img.type === "video" && <Video className="absolute inset-0 m-auto w-6 h-6 text-white drop-shadow-md" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-inherit truncate text-sm">{img.prompt || "AI Generated Media"}</p>
                    <div className="flex items-center gap-3 mt-1 opacity-70 text-[10px] font-medium text-inherit uppercase tracking-wider">
                      <span>{img.provider}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(img.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => handleDownload(img.url, img.prompt, img.type, e)} className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-inherit" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            }

            // Grid View
            return (
            <div 
              key={img.id} 
              className={`group relative rounded-xl overflow-hidden shadow-sm border transition-all duration-300 bg-black/5 dark:bg-white/5 ${isSelectionMode ? "cursor-pointer" : ""} ${isSelected ? "ring-2 ring-indigo-500 border-indigo-500 scale-95" : "border-inherit/30 hover:shadow-xl hover:-translate-y-1"}`}
              onClick={() => isSelectionMode ? toggleSelection(img.id) : openMedia(img)}
            >
              {(isSelectionMode || isSelected) && (
                <div className="absolute top-2 left-2 z-20">
                  <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded text-indigo-600 shadow-sm cursor-pointer pointer-events-none" />
                </div>
              )}
              
              {img.type === "video" ? (
                <div className="w-full aspect-square relative">
                  <video src={img.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <img 
                  src={img.url} 
                  alt={img.prompt} 
                  className="w-full h-auto object-cover aspect-square transition-transform duration-500 group-hover:scale-105"
                  style={{ aspectRatio: img.aspectRatio && img.aspectRatio.replace(':', '/') }}
                />
              )}
              
              {/* Hover Overlay Actions */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3 transition-opacity duration-300 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <p className="text-white text-xs font-medium line-clamp-2 mb-2 text-shadow">{img.prompt}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded">{img.provider}</span>
                  <div className="flex space-x-2">
                    <button onClick={(e) => { e.stopPropagation(); openMedia(img); }} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors text-white" title="Maximize">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => handleDownload(img.url, img.prompt, img.type, e)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm transition-colors text-white" title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }} className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full backdrop-blur-sm transition-colors text-white" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Universal Media Launcher Portal */}
      {fullscreenMedia && createPortal(
        <div className="absolute z-[10000]">
          <FullscreenMediaModal
            media={fullscreenMedia}
            onClose={() => setFullscreenMedia(null)}
            currentUser={user}
          />
        </div>,
        document.body
      )}

      {viewerFile && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <DocumentViewer
            url={viewerFile.url}
            title={viewerFile.title || "Document"}
            media={viewerFile}
            currentUser={user}
            onClose={() => setViewerFile(null)}
            canEdit={false}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default AIGallery;