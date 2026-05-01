// /client/src/utils/downloadUtils.js
export const downloadMedia = async (url, title, typeFallback = "file") => {
  try {
    window.dispatchEvent(new CustomEvent("showToast", { detail: "Preparing download... ⏳" }));
    
    let ext = url.split(".").pop().split("?")[0];
    if (url.startsWith("blob:") || !ext || ext.length > 5 || ext === url) {
      if (title && title.includes(".")) {
        ext = title.split(".").pop();
      } else {
        ext = typeFallback === "video" ? "mp4" : typeFallback === "image" ? "png" : typeFallback === "pdf" ? "pdf" : typeFallback === "audio" ? "mp3" : "txt";
      }
    }
    
    const titleWithoutExt = title.includes(".") ? title.split(".").slice(0, -1).join(".") : title;
    const filename = `${titleWithoutExt.replace(/\s+/g, "_")}.${ext}`;
    
    const isCrossOrigin = new URL(url, window.location.href).origin !== window.location.origin;
    
    if (isCrossOrigin && !url.startsWith("blob:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      downloadBlob(blob, filename);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    window.dispatchEvent(new CustomEvent("showToast", { detail: "Downloaded successfully! 📥" }));
  } catch (error) {
    console.error("Download failed, falling back to open:", error);
    window.open(url, "_blank");
  }
};

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
