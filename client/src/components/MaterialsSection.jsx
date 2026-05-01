import React, { useState, useCallback } from 'react';
import { FileText, Upload, Plus, Trash2 } from 'lucide-react';
import PostCard from './ui/PostCard';
import PostComposer from './ui/PostComposer';
import UploadProgress from './ui/UploadProgress';
import EmptyState from './ui/EmptyState';
import { getCardThemeClasses, getPrimaryButtonClasses } from '../utils/themeUtils';
import { 
  createContent, 
  updateContentWithMedia, 
  deleteContent,
  toggleLike,
  addComment 
} from '../services/contentService';

const MaterialsSection = ({
  subject,
  materials,
  activeSubjectId,
  user,
  appTheme,
  canManageContent,
  selectedMaterials,
  setSelectedMaterials,
  setViewerFile,
  uploadData,
  setUploadData,
  composerText,
  setComposerText,
  attachments,
  setAttachments,
  isPublishing,
  setIsPublishing,
  uploadProgress,
  setUploadProgress,
  isEditingId,
  setIsEditingId,
  onShareClick
}) => {
  const handlePublishMaterial = useCallback(async () => {
    if (!uploadData.title) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Title is required. ❌" }));
      return;
    }
    setIsPublishing(true);
    try {
      const sanitizeMeta = (str) => String(str ?? "").replace(/\|/g, "").replace(/\n/g, " ").trim();
      const contentStr = [
        "[LECTURE]",
        sanitizeMeta(uploadData.title), "|",
        sanitizeMeta(subject?.name || "General"), "|",
        uploadData.views || 0, "|",
        sanitizeMeta(uploadData.englishAttachmentUrl) || "none", "|",
        sanitizeMeta(uploadData.hindiAttachmentUrl) || "none", "|",
        uploadData.isDownloadable,
        "\n\n",
        composerText
      ].join("");

      let extraPayload = { subjectId: activeSubjectId };

      const actualFiles = attachments.filter((a) => a.file);
      const linkAttachments = attachments.filter((a) => !a.file && a.previewUrl && !a._id);

      let finalTitles = [];
      let finalDescs = [];
      let finalDl = [];
      let finalUrls = [];
      let finalTypes = [];

      actualFiles.forEach((a) => {
        finalTitles.push(a.title?.trim() || " ");
        finalDescs.push(a.description?.trim() || " ");
        finalDl.push(a.isDownloadable ?? false);
      });

      if (uploadData.mediaUrl) {
        finalUrls.push(uploadData.mediaUrl);
        finalTypes.push(/youtube\.com|youtu\.be/i.test(uploadData.mediaUrl) ? "youtube" : /\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(uploadData.mediaUrl) ? "video" : /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(uploadData.mediaUrl) ? "image" : /\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(uploadData.mediaUrl) ? "audio" : "document");
        finalTitles.push(uploadData.title || "Linked Media");
        finalDescs.push(" ");
        finalDl.push(uploadData.isDownloadable ?? true);
      }

      linkAttachments.forEach((a) => {
        finalUrls.push(a.previewUrl);
        finalTypes.push(a.type || "image");
        finalTitles.push(a.title?.trim() || " ");
        finalDescs.push(a.description?.trim() || " ");
        finalDl.push(a.isDownloadable ?? false);
      });

      if (finalTitles.length > 0) {
        extraPayload.mediaTitles = finalTitles;
        extraPayload.mediaDescriptions = finalDescs;
        extraPayload.mediaDownloadable = finalDl;
      }

      if (finalUrls.length > 0) {
        if (isEditingId) {
          extraPayload.newMediaUrls = finalUrls;
          extraPayload.newMediaTypes = finalTypes;
        } else {
          extraPayload.mediaUrls = finalUrls;
          extraPayload.mediaTypes = finalTypes;
        }
      }

      if (isEditingId) {
        const retainedIds = attachments.filter((a) => a._id).map((a) => a._id);
        extraPayload.retainedMediaIds = retainedIds;
        extraPayload.existingMediaDownloadable = attachments.filter((a) => a._id).map((a) => a.isDownloadable ?? false);
      }

      if (isEditingId) {
        await updateContentWithMedia(isEditingId, contentStr, attachments, (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }, extraPayload);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Updated successfully! 🚀" }));
      } else {
        await createContent(contentStr, attachments, (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }, extraPayload);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Published successfully! 🚀" }));
      }
      setIsEditingId(null);
      setUploadData({ title: "", views: 0, englishAttachmentUrl: "", hindiAttachmentUrl: "", mediaUrl: "", isDownloadable: true });
      setComposerText("");
      setAttachments([]);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to publish. ❌" }));
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
    }
  }, [uploadData, composerText, attachments, activeSubjectId, subject, isEditingId]);

  const toggleMaterialSelect = (id) => {
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id],
    );
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Are you sure you want to delete this material?"))
      return;
    try {
      await deleteContent(id);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Material deleted 🗑️" }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to delete. ❌" }));
    }
  };

  const handleBulkDeleteMaterials = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedMaterials.length} materials?`,
      )
    )
      return;
    try {
      await Promise.all(selectedMaterials.map((id) => deleteContent(id)));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Materials deleted 🗑️" }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Bulk delete failed. ❌" }));
    }
  };

  const handleLike = async (lectureId) => {
    // Optimistic update
    setMaterials((prev) => prev.map((l) => {
      if (l._id === lectureId) {
        const isLiked = l.reactions?.some((r) => r.user?.toString() === user?._id?.toString());
        let newReactions = l.reactions ? [...l.reactions] : [];
        if (isLiked) {
          newReactions = newReactions.filter((r) => r.user?.toString() !== user?._id?.toString());
        } else {
          newReactions.push({ user: user?._id, type: "👍" });
        }
        return { ...l, reactions: newReactions, likes: newReactions.length };
      }
      return l;
    }));
    try {
      await toggleLike(lectureId, "👍");
    } catch (err) {
      // Revert on error (simplified)
      window.location.reload();
    }
  };

  const handleComment = async (lectureId, text) => {
    if (!text.trim()) return;
    try {
      const res = await addComment(lectureId, text);
      setMaterials((prev) => prev.map((l) => (l._id === lectureId ? { ...l, comments: res.comments } : l)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="opacity-80" /> Materials
        </h2>
        {canManageContent && selectedMaterials.length > 0 && (
          <button
            onClick={handleBulkDeleteMaterials}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 font-bold rounded-lg border border-red-500/20 transition-all text-sm"
          >
            <Trash2 className="w-4 h-4" /> Delete ({selectedMaterials.length})
          </button>
        )}
      </div>

      {/* Upload Form */}
      {canManageContent && (
        <div className={`p-6 rounded-2xl shadow-sm border ${getCardThemeClasses(appTheme)}`}>
          <h3 className="font-bold mb-4 text-lg">📤 Upload New Material</h3>
          
          {/* External Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
            <div>
              <label className="block text-sm font-semibold mb-1 opacity-90">
                🎥 Main Video/Document
              </label>
              <input
                type="url"
                value={uploadData.mediaUrl}
                onChange={(e) => setUploadData({ ...uploadData, mediaUrl: e.target.value })}
                placeholder="YouTube/Google Drive/etc."
                className="w-full p-3 rounded-xl border border-inherit/30 focus:ring-2 focus:ring-current bg-white/50 dark:bg-black/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 opacity-90">
                📚 Title *
              </label>
              <input
                type="text"
                value={uploadData.title}
                onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                placeholder="Lecture Topic"
                className="w-full p-3 rounded-xl border border-inherit/30 focus:ring-2 focus:ring-current bg-white/50 dark:bg-black/20 transition-all"
              />
            </div>
          </div>

          <PostComposer
            value={composerText}
            onChange={setComposerText}
            onSend={handlePublishMaterial}
            isSending={isPublishing}
            placeholder="Lecture description / notes..."
            attachments={attachments}
            onAddFiles={(incoming) => {/* handled by parent */}}
            onRemoveFile={(idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
            isDownloadable={uploadData.isDownloadable}
            onIsDownloadableChange={(e) => setUploadData({ ...uploadData, isDownloadable: e.target.checked })}
            setFullscreenMedia={setViewerFile}
          />

          {uploadProgress > 0 && uploadProgress < 100 && (
            <UploadProgress progress={uploadProgress} />
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={handlePublishMaterial}
              disabled={isPublishing || !uploadData.title}
              className={`px-8 py-3 font-bold rounded-2xl shadow-lg transition-all flex items-center gap-2 ${getPrimaryButtonClasses(appTheme)} disabled:opacity-50`}
            >
              {isPublishing ? (
                <>
                  <div className="loader" style={{ "--s": "12px", "--g": "2px" }} />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  {isEditingId ? 'Update' : 'Publish'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Materials Grid */}
      <div className="space-y-4">
        {materials.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Materials"
            description="Be the first to upload lecture notes or videos!"
            className="my-8"
          />
        ) : (
          <div className={`grid gap-4 ${materials.length > 1 ? 'grid-cols-1 md:grid-cols-2' : ''}`}>
            {materials.map((material, idx) => (
              <div key={material._id || idx} className="relative">
                {canManageContent && (
                  <input
                    type="checkbox"
                    checked={selectedMaterials.includes(material._id)}
                    onChange={() => toggleMaterialSelect(material._id)}
                    className="absolute top-3 right-3 z-20 w-5 h-5 rounded border-2 border-white bg-white shadow-lg"
                  />
                )}
                <PostCard
                  post={material}
                  currentUser={user}
                  onLike={handleLike}
                  onDelete={canManageContent ? () => handleDeleteMaterial(material._id) : undefined}
                  onComment={handleComment}
                  onShare={onShareClick}
                  setFullscreenMedia={setViewerFile}
                  hideHeader={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MaterialsSection;

