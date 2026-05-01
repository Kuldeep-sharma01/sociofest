import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  PlayCircle,
  Globe,
  Download,
  Users,
  BarChart3,
  Plus,
  Video,
  X,
  Link as LinkIcon,
  ThumbsUp,
  Filter,
  Bookmark,
  BookmarkCheck,
  FileText,
  Folder,
  ArrowLeft,
  Search,
  Library
} from "lucide-react";
import { isFacultyRole, getRoleSubjects } from "@/utils/roleUtils";
import {
  getAllContent,
  createContent,
  updateContentWithMedia,
  toggleLike,
  updateContent,
  deleteContent,
  addComment,
} from "@/services/contentService";
import { updateUserProfile } from "@/services/userService";
import EmptyState from "@/components/ui/EmptyState";
import PostCard from "@/components/ui/PostCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { updateUser } from "@/redux/authSlice";
import PostComposer from "@/components/ui/PostComposer";
import { detectMediaInText } from "@/utils/textUtils.jsx";
import UploadProgress from "@/components/ui/UploadProgress";
import { useTheme } from "@/context/ThemeContext";
import DocumentViewer from "@/components/ui/DocumentViewer";
import ShareModal from "@/components/ui/ShareModal";
import {
  getBannerThemeClasses,
  getCardThemeClasses,
  getOptionClasses,
  getPrimaryButtonClasses,
  getThemeSoftBg,
} from "@/utils/themeUtils";

const StudyHub = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const { appTheme, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState("Lectures");
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditingId, setIsEditingId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [mySubjects, setMySubjects] = useState([]);

  const [uploadData, setUploadData] = useState({
    title: "",
    subjectLabel: "",
    subjectId: "",
    subjectLabelRequired: false,
    views: 0,
    englishAttachmentUrl: "",
    hindiAttachmentUrl: "",
    mediaUrl: "",
    isDownloadable: true,
  });
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(12);
  
  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);

  const isFaculty = isFacultyRole(user?.role);

  // Fetch all posts and filter out the "Lectures"
  const fetchLectures = useCallback(async (signal) => {
    setLoading(true);
    try {
      // Optimized Query: Tell the backend to only send [LECTURE] posts
      const data = await getAllContent({ limit: 100, type: "lecture" }, signal);
      if (signal?.aborted) return;

      const rawPosts = Array.isArray(data?.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : [];

      // Parse our hidden metadata flag from the content string
      const parsedLectures = rawPosts
        .filter((p) => p.material?.description && p.material.description.startsWith("[LECTURE]"))
        .map((p) => {
          const contentParts = p.material.description.split("\n\n");
          const metaString = contentParts[0].replace("[LECTURE]", "");
          const description = contentParts.slice(1).join("\n\n");

          const parts = metaString.split("|");
          let title = "Untitled";
          let subjectLabel = "General";
          let views = 0;
          let englishAttachmentUrl = "";
          let hindiAttachmentUrl = "";
          let isDownloadable = true; // Default to downloadable

          if (parts.length >= 6) {
            title = parts[0];
            subjectLabel = parts[1];
            views = parseInt(parts[2]) || 0;
            englishAttachmentUrl = parts[3] !== "none" ? parts[3] : "";
            hindiAttachmentUrl = parts[4] !== "none" ? parts[4] : "";
            isDownloadable = parts[5] === "true";
          } else if (parts.length >= 5) {
            // Backwards compatibility
            title = parts[0];
            subjectLabel = parts[1];
            views = parseInt(parts[2]) || 0;
            englishAttachmentUrl = parts[3] !== "none" ? parts[3] : "";
            hindiAttachmentUrl = parts[4] !== "none" ? parts[4] : "";
          } else if (parts.length >= 4) {
            title = parts[0];
            subjectLabel = parts[1];
            views = parseInt(parts[2]) || 0;
          } else if (parts.length >= 3) {
            title = parts[0];
            subjectLabel = parts[1];
            views = parseInt(parts[2]) || 0;
          } else if (parts.length === 2) {
            title = parts[0];
            subjectLabel = parts[1];
          }

          if (title === "English" || title === "Hindi") {
            title = "Legacy Material";
          }

          return {
            ...p,
            title,
            subjectLabel,
            description,
            likes: p.reactions?.length || 0,
            views,
            englishAttachmentUrl,
            hindiAttachmentUrl,
            isDownloadable,
            mediaUrl:
              p.material?.media?.length > 0
                ? (() => {
                    const m = p.material.media[0];
                    const mPath = typeof m === "string" ? m : m.path;
                    return mPath?.startsWith("http") ? mPath : `/${mPath}`;
                  })()
                : null,
            mediaType:
              p.material?.media?.length > 0
                ? (() => {
                    const m = p.material.media[0];
                    const mMime = typeof m === "string" ? "" : m.mimetype || "";
                    const mPath = typeof m === "string" ? m : m.path || "";
                    if (mMime === "youtube" || /youtube\.com|youtu\.be/i.test(mPath)) return "youtube";
                    if (mMime.startsWith("video")) return "video";
                    if (mMime.startsWith("image")) return "image";
                    if (mMime.startsWith("audio")) return "audio";
                    return "document";
                  })()
                : null,
          };
        });

      setLectures(parsedLectures);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to load lectures:", error);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to load Study Hub content. ❌" }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isFaculty) {
      getRoleSubjects(user.role, user).then(res => {
        setMySubjects(Array.isArray(res) ? res : res?.subjects || []);
      }).catch(e => console.error(e));
    }
  }, [user, isFaculty]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLectures(controller.signal);
    return () => controller.abort();
  }, [fetchLectures]);

  const handleShareClick = async (post) => {
    setPostToShare(post);
    setShareModalOpen(true);
    try {
      const { getConversations } = await import("@/services/chatService");
      const users = await getConversations();
      setShareUsers(users);
    } catch (err) {
      console.error("Failed to load conversations for sharing", err);
    }
  };

  const handleSendShare = async (targetUserId) => {
    if (!postToShare) return;
    try {
      const { sendMessage } = await import("@/services/chatService");
      
      const rawContent = postToShare.material?.description || postToShare.content || "";
      const displayContent = rawContent.startsWith("[LECTURE]")
        ? rawContent.split("\n\n").slice(1).join("\n\n").trim() || "Shared a lecture"
        : rawContent.substring(0, 200) || "Shared a post";

      const payload = {
        content: displayContent,
        replyToMessage: {
          _id: postToShare._id,
          senderName: postToShare.author?.name || "A User",
          content: displayContent.substring(0, 50) || "Forwarded Post",
        }
      };

      if (postToShare.mediaUrl || (postToShare.material?.media && postToShare.material.media.length > 0)) {
        payload.mediaUrls = [];
        payload.mediaTypes = [];
        payload.mediaTitles = [];
        payload.mediaDescriptions = [];
        payload.mediaDownloadable = [];
        
        const mediaList = postToShare.material?.media || [];
        if (mediaList.length > 0) {
          mediaList.forEach((m) => {
            const mPath = typeof m === "string" ? m : m.path;
            payload.mediaUrls.push(mPath?.startsWith("http") ? mPath : `/${mPath}`);
            payload.mediaTypes.push(
              m.mimetype === "youtube" || /youtube\.com|youtu\.be/i.test(mPath)
                ? "youtube"
                : m.mimetype?.startsWith("video") ? "video" 
                : m.mimetype?.startsWith("audio") ? "audio" 
                : m.mimetype?.startsWith("image") ? "image"
                : "document"
            );
            payload.mediaTitles.push(m.title || " ");
            payload.mediaDescriptions.push(m.description || " ");
            payload.mediaDownloadable.push(m.isDownloadable ?? false);
          });
        } else if (postToShare.mediaUrl) {
           payload.mediaUrls.push(postToShare.mediaUrl);
           payload.mediaTypes.push(postToShare.mediaType || "video");
           payload.mediaTitles.push("Shared Media");
           payload.mediaDescriptions.push(" ");
           payload.mediaDownloadable.push(postToShare.isDownloadable ?? true);
        }
      }

      await sendMessage(targetUserId, payload);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Lecture shared successfully! 🚀" }));
      setShareModalOpen(false);
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to share. ❌" }));
    }
  };

  useEffect(() => {
    setSelectedFolder(null);
    setSearchQuery("");
    setSortBy("newest");
  }, [activeTab, showBookmarksOnly]);

  // Reset visible items when search or folder changes
  useEffect(() => {
    setVisibleCount(12);
  }, [selectedFolder, searchQuery, sortBy]);

  // Advanced Analytics: Updates view count in MongoDB natively
  const handleViewLecture = useCallback((lectureId) => {
    setLectures((prev) => {
      const lecture = prev.find((l) => l._id === lectureId);
      if (!lecture) return prev;

      const newViews = (lecture.views || 0) + 1;

      // Fire & forget background request (schedule outside the updater via microtask)
      Promise.resolve().then(() =>
        updateContent(lectureId, {
          content: `[LECTURE]${lecture.title}|${lecture.subjectLabel}|${newViews}|${lecture.englishAttachmentUrl || "none"}|${lecture.hindiAttachmentUrl || "none"}|${lecture.isDownloadable ?? false}\n\n${lecture.description || ""}`,
        }).catch((err) => console.error("Failed to update view", err))
      );

      return prev.map((l) =>
        l._id === lectureId ? { ...l, views: newViews } : l,
      );
    });
  }, []);

  const handleAddFiles = async (newAttachments) => {
    let incoming = newAttachments;
    if (newAttachments.target) {
      incoming = Array.from(newAttachments.target.files).map((f) => ({
        file: f,
        title: f.name,
        description: "",
        isDownloadable: uploadData.isDownloadable,
      }));
      newAttachments.target.value = null;
    }

    for (const att of incoming) {
      let finalFile = att.file;
      let file = att.file;

      // Auto-watermark PDFs to prevent theft
      if (file.type === "application/pdf") {
        const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
        if (file.size > MAX_PDF_BYTES) {
          window.dispatchEvent(new CustomEvent("showToast", {
            detail: `PDF too large (max 50 MB). Please compress before uploading. ❌`,
          }));
          continue;
        }

        try {
          window.dispatchEvent(
            new CustomEvent("showToast", { detail: "Watermarking PDF... ⏳" }),
          );
          const { PDFDocument, rgb, degrees } = await import("pdf-lib");
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPages();

          for (const page of pages) {
            const { width, height } = page.getSize();
            page.drawText(`SocioFest Secure - ${user?.name || "Faculty"}`, {
              x: width / 2 - 150,
              y: height / 2,
              size: 30,
              color: rgb(0.8, 0.8, 0.8),
              opacity: 0.5,
              rotate: degrees(-45),
            });
          }

          const pdfBytes = await pdfDoc.save();
          finalFile = new File([pdfBytes], file.name, {
            type: "application/pdf",
          });
          window.dispatchEvent(
            new CustomEvent("showToast", { detail: "Watermark applied! ✅" }),
          );
        } catch (err) {
          console.error("Watermark failed", err);
          window.dispatchEvent(
            new CustomEvent("showToast", {
              detail:
                "Cannot upload encrypted/protected PDFs. Security watermark failed. ❌",
            }),
          );
          continue; // Block the upload queue
        }
      }

      setAttachments((prev) => [
        ...prev,
        {
          file: finalFile,
          previewUrl: URL.createObjectURL(finalFile),
          type: finalFile.type.startsWith("video")
            ? "video"
            : finalFile.type.startsWith("image")
              ? "image"
              : "document",
          title: att.title,
          description: att.description,
          isDownloadable: att.isDownloadable ?? true,
        },
      ]);
    }
  };

  const handleRemoveFile = (idx) => {
    setAttachments((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const closeModal = () => {
    attachments.forEach((a) => {
      if (a.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
    });
    setIsUploadModalOpen(false);
    setIsEditingId(null);
    setUploadData({
      title: "",
      subjectLabel: "",
      subjectId: "",
      views: 0,
      englishAttachmentUrl: "",
      hindiAttachmentUrl: "",
      mediaUrl: "",
      isDownloadable: true,
    });
    setComposerText("");
    setAttachments([]);
  };

  const handlePublish = async () => {
    if (!uploadData.title.trim()) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Title is required. ❌" }),
      );
      return;
    }

    setIsPublishing(true);
    try {
      const sanitizeMeta = (str) => String(str ?? "").replace(/\|/g, "").replace(/\n/g, " ").trim();
      
      const contentStr = [
        "[LECTURE]",
        sanitizeMeta(uploadData.title), "|",
        sanitizeMeta(uploadData.subjectLabel), "|",
        uploadData.views || 0, "|",
        sanitizeMeta(uploadData.englishAttachmentUrl) || "none", "|",
        sanitizeMeta(uploadData.hindiAttachmentUrl) || "none", "|",
        uploadData.isDownloadable,
        "\n\n",
        composerText
      ].join("");

      let extraPayload = {};
      if (uploadData.subjectId) {
        extraPayload.subjectId = uploadData.subjectId;
      }

      const actualFiles = attachments.filter((a) => a.file);
      const linkAttachments = attachments.filter((a) => !a.file && a.previewUrl && !a._id);

      let finalTitles = [];
      let finalDescs = [];
      let finalDl = [];
      let finalUrls = [];
      let finalTypes = [];

      // 1. Physical Files
      actualFiles.forEach((a) => {
        finalTitles.push(a.title?.trim() || " ");
        finalDescs.push(a.description?.trim() || " ");
        finalDl.push(a.isDownloadable ?? false);
      });

      // 2. Explicit Main Media Link
      if (uploadData.mediaUrl) {
        finalUrls.push(uploadData.mediaUrl);
        finalTypes.push(/youtube\.com|youtu\.be/i.test(uploadData.mediaUrl) ? "youtube" : /\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(uploadData.mediaUrl) ? "video" : /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(uploadData.mediaUrl) ? "image" : /\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(uploadData.mediaUrl) ? "audio" : "document");
        finalTitles.push(uploadData.title || "Linked Media");
        finalDescs.push(" ");
        finalDl.push(uploadData.isDownloadable ?? true);
      }

      // 3. Auto-detected Link Attachments
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
        await updateContentWithMedia(
          isEditingId,
          contentStr,
          attachments,
          (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(percentCompleted);
          },
          extraPayload,
        );
        window.dispatchEvent(
          new CustomEvent("showToast", { detail: "Updated successfully! 🚀" }),
        );
      } else {
        console.log("content str", contentStr, attachments, extraPayload);
        await createContent(
          contentStr,
          attachments,
          (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgress(percentCompleted);
          },
          extraPayload,
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Published successfully! 🚀",
          }),
        );
      }

      closeModal();
      fetchLectures();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to publish. ❌" }),
      );
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  const handleLike = async (lectureId) => {
    // Optimistic UI update
    setLectures((prev) =>
      prev.map((l) => {
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
      }),
    );

    try {
      await toggleLike(lectureId, "👍");
    } catch (err) {
      console.error("Failed to like lecture:", err);
      fetchLectures(); // Rollback on error
    }
  };

  const handleBookmark = async (lectureId) => {
    const savedLectures = user?.savedLectures || [];
    const isSaved = savedLectures.includes(lectureId);
    let newSavedLectures;

    if (isSaved) {
      newSavedLectures = savedLectures.filter((id) => id !== lectureId);
    } else {
      newSavedLectures = [...savedLectures, lectureId];
    }

    // Optimistic UI update
    dispatch(updateUser({ ...user, savedLectures: newSavedLectures }));

    try {
      await updateUserProfile(user._id, { savedLectures: newSavedLectures });
    } catch (err) {
      console.error("Failed to bookmark lecture:", err);
      dispatch(updateUser({ ...user, savedLectures })); // Rollback on error
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to save bookmark. ❌" }),
      );
    }
  };

  const handleDeleteLecture = async (lectureId) => {
    if (!window.confirm("Delete this lecture/material?")) return;
    try {
      await deleteContent(lectureId);
      setLectures((prev) => prev.filter((l) => l._id !== lectureId));
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Deleted successfully." }),
      );
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to delete." }),
      );
    }
  };

  const handleComment = async (lectureId, text) => {
    if (!text.trim()) return;
    try {
      const res = await addComment(lectureId, text);
      setLectures((prev) =>
        prev.map((l) => (l._id === lectureId ? { ...l, comments: res.comments } : l))
      );
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Review added! 💬" })
      );
    } catch (err) {
      console.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to post review. ❌" })
      );
    }
  };

  const handleUpvoteComment = async (lectureId, commentId) => {
    // Optimistic local update for comment upvotes
    setLectures((prev) => prev.map((l) => {
      if (l._id !== lectureId) return l;
      return {
        ...l,
        comments: (l.comments || []).map((c) => {
          if (c._id !== commentId) return c;
          const isUpvoted = c.upvotes?.includes(user?._id);
          const newUpvotes = isUpvoted
            ? c.upvotes.filter((id) => id !== user?._id)
            : [...(c.upvotes || []), user?._id];
          return { ...c, upvotes: newUpvotes };
        })
      };
    }));
    // Note: You will need to wire this to a `toggleCommentUpvote` backend API endpoint in contentService.js.
  };

  const handleEditClick = (lecture) => {
    setUploadData({
      title: lecture.title,
      subjectLabel: lecture.subjectLabel,
      subjectId: lecture.subject || "",
      views: lecture.views || 0,
      englishAttachmentUrl: lecture.englishAttachmentUrl || "",
      hindiAttachmentUrl: lecture.hindiAttachmentUrl || "",
      mediaUrl:
        lecture.mediaUrl && !lecture.mediaUrl.startsWith("blob:")
          ? lecture.mediaUrl
          : "",
      isDownloadable: lecture.isDownloadable || false,
    });
    setComposerText(lecture.description || "");

    if (lecture.media && lecture.media.length > 0) {
      setAttachments(
        lecture.media.map((m) => {
          const mPath = typeof m === "string" ? m : m.path;
          return {
            previewUrl:
              mPath?.startsWith("http") || mPath?.startsWith("blob:")
                ? mPath
                : `/${mPath}`,
            type:
              m.mimetype?.startsWith("video") || m.mimetype === "youtube"
                ? "video"
                : "image",
            file: null,
            title: m.title || "",
            description: m.description || "",
            isDownloadable: m.isDownloadable,
            _id: typeof m === "string" ? m : m._id,
          };
        }),
      );
    } else if (lecture.mediaUrl) {
      setAttachments([
        { previewUrl: lecture.mediaUrl, type: lecture.mediaType, file: null },
      ]);
    }
    setIsEditingId(lecture._id);
    setIsUploadModalOpen(true);
  };

  const uniqueSubjects = [
    ...new Set(lectures.map((l) => l.subjectLabel).filter(Boolean)),
  ];

  const baseContent = useMemo(() => {
    let content = lectures.filter((l) => {
      if (showBookmarksOnly && !(user?.savedLectures || []).includes(l._id))
        return false;
      return true;
    });

    if (activeTab === "Lectures") {
      return content.filter((l) => {
        const isVideo = l.mediaType === "video" || l.mediaUrl?.includes("youtube") || l.mediaUrl?.includes("youtu.be");
        return isVideo;
      });
    }

    // For Materials tab: main non-video + all attachments
    const materials = [];
    
    content.forEach((l) => {
      // Main media if not video
      const isVideo = l.mediaType === "video" || l.mediaUrl?.includes("youtube") || l.mediaUrl?.includes("youtu.be");
      if (!isVideo && l.mediaUrl) {
        materials.push({
          ...l,
          _isAttachment: false,
          attachmentType: null,
        });
      }

      // English notes
      if (l.englishAttachmentUrl && l.englishAttachmentUrl !== "none") {
        materials.push({
          ...l,
          title: `${l.title} - English Notes`,
          mediaUrl: l.englishAttachmentUrl,
          mediaType: "document",
          _isAttachment: true,
          attachmentType: "english",
        });
      }

      // Hindi notes
      if (l.hindiAttachmentUrl && l.hindiAttachmentUrl !== "none") {
        materials.push({
          ...l,
          title: `${l.title} - Hindi Notes`,
          mediaUrl: l.hindiAttachmentUrl,
          mediaType: "document",
          _isAttachment: true,
          attachmentType: "hindi",
        });
      }

      // Additional media files (media[1+])
      if (l.material?.media && l.material.media.length > 1) {
        l.material.media.slice(1).forEach((m, idx) => {
          const mPath = typeof m === "string" ? m : m.path || m;
          const mType = typeof m === "string" ? "document" : (m.mimetype || "document");
          materials.push({
            ...l,
            title: `${l.title} - Attachment ${idx + 1}`,
            mediaUrl: mPath?.startsWith("http") ? mPath : `/${mPath}`,
            mediaType: mType,
            _isAttachment: true,
            attachmentType: "file",
            originalMediaIndex: idx + 1,
          });
        });
      }
    });

    return materials;
  }, [lectures, activeTab, showBookmarksOnly, user?.savedLectures]);

  const subjectFolders = useMemo(() => {
    const map = {};
    baseContent.forEach(l => {
      const subj = l.subjectLabel || "General";
      if (!map[subj]) map[subj] = { name: subj, count: 0, views: 0, items: [] };
      map[subj].count++;
      map[subj].views += (l.views || 0);
      map[subj].items.push(l);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [baseContent]);

  const displayedContent = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const filtered = baseContent.filter(item => 
        item.title?.toLowerCase().includes(q) || 
        item.description?.toLowerCase().includes(q) ||
        item.subjectLabel?.toLowerCase().includes(q)
      );
      return filtered.sort((a, b) => {
        if (sortBy === "newest") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        if (sortBy === "mostViewed") return (b.views || 0) - (a.views || 0);
        if (sortBy === "mostLiked") return (b.likes || 0) - (a.likes || 0);
        return 0;
      });
    }

    if (!selectedFolder) return [];
    const folderItems = subjectFolders.find(f => f.name === selectedFolder)?.items || [];
    
    return [...folderItems].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === "mostViewed") return (b.views || 0) - (a.views || 0);
      if (sortBy === "mostLiked") return (b.likes || 0) - (a.likes || 0);
      return 0;
    });
  }, [selectedFolder, subjectFolders, searchQuery, sortBy]);

  const paginatedContent = useMemo(() => displayedContent.slice(0, visibleCount), [displayedContent, visibleCount]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
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

      {/* Header */}
      <div
        className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-teal-600 to-emerald-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}
      >
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <PlayCircle className="w-64 h-64" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
              Open Study Hub
            </h1>
            <p className="text-inherit opacity-90 mt-2 text-base md:text-lg font-medium max-w-xl">
              Free access to video lectures, materials, and faculty insights.
            </p>
          </div>
          {isFaculty && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 bg-black/10 dark:bg-white/10 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black/20 dark:hover:bg-white/20 border border-white/30 backdrop-blur-sm transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-5 h-5" /> Upload Resource
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div
        className={`flex flex-col lg:flex-row justify-between items-center gap-4 p-4 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <div className="bg-black/5 dark:bg-white/5 p-1 gap-2 rounded-xl flex shadow-inner border border-inherit/30 w-full lg:w-auto">
          <button
            onClick={() => setActiveTab("Lectures")}
            className={`flex p-2 items-center xt-sm font-medium rounded-md transition-all relative ${activeTab === "Lectures" ? `bg-white/50 ${getThemeSoftBg(appTheme)} shadow-sm text-inherit font-bold` : `text-inherit opacity-70 hover:opacity-100`}`}
          >
            <Video className="w-4 h-4" /> Video Lectures
          </button>
          <button
            onClick={() => setActiveTab("Materials")}
            className={`flex p-2 items-center text-sm font-medium rounded-md transition-all relative ${activeTab === "Materials" ? `bg-white/50 ${getThemeSoftBg(appTheme)} shadow-sm text-inherit font-bold` : `text-inherit opacity-70 hover:opacity-100`}`}
          >
            <FileText className="w-4 h-4" /> Study Materials
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-stretch lg:items-center flex-1 lg:max-w-2xl lg:flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab.toLowerCase()} or subjects...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-inherit/30 focus:ring-2 focus:ring-current outline-none text-sm shadow-inner"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:flex-nowrap items-stretch">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 min-w-[140px] bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-current text-inherit font-bold shadow-sm"
            >
              <option value="newest">Newest</option>
              <option value="mostViewed">Most Viewed</option>
              <option value="mostLiked">Most Liked</option>
            </select>
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border shadow-sm whitespace-nowrap ${
                showBookmarksOnly
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-black/10 dark:bg-white/10 border-inherit/30 hover:bg-black/20 dark:hover:bg-white/20 text-inherit"
              }`}
            >
              {showBookmarksOnly ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              Saved
            </button>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <LoadingSkeleton count={2} />
      ) : baseContent.length === 0 ? (
        <EmptyState
          icon={activeTab === "Lectures" ? Video : FileText}
          title={`No ${activeTab.toLowerCase()} available yet.`}
          description="Check back later or switch tabs."
        />
      ) : !selectedFolder && !searchQuery ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {subjectFolders.map((folder) => (
            <div
              key={folder.name}
              onClick={() => setSelectedFolder(folder.name)}
              className={`p-6 rounded-2xl shadow-sm hover:shadow-md border cursor-pointer hover:-translate-y-1 transition-all group flex flex-col items-center text-center ${getCardThemeClasses(appTheme)}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-sm ${activeTab === 'Lectures' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-orange-500/10 text-orange-500 border border-orange-500/20'}`}>
                <Library className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-inherit line-clamp-2">{folder.name}</h3>
              <div className="mt-3 flex items-center gap-3 text-xs opacity-70 font-semibold uppercase tracking-wider">
                <span>{folder.count} Items</span>
                <span>•</span>
                <span>{folder.views} Views</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            {selectedFolder && !searchQuery ? (
              <button onClick={() => { setSelectedFolder(null); setSearchQuery(""); }} className="flex items-center gap-2 opacity-70 hover:opacity-100 font-bold transition-opacity shrink-0 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-xl border border-inherit/30 shadow-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Subjects
              </button>
            ) : (
               <h2 className="text-xl font-bold flex items-center gap-2 text-inherit">
                 <Search className="w-5 h-5 opacity-70"/> Search Results
               </h2>
            )}
          </div>
          
          {displayedContent.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches found."
              description={`No results for "${searchQuery}"${selectedFolder ? ` in ${selectedFolder}` : ""}.`}
            />
          ) : (
            <div className="flex flex-col gap-6">
            <div className="columns-1 md:columns-2 gap-4 w-full">
              {paginatedContent.map((lecture) => {
            const isLiked = lecture.reactions?.some(
              (r) => r.user === user?._id,
            );
            const isSaved = (user?.savedLectures || []).includes(lecture._id);
            return (
              <PostCard
                key={lecture._id}
                post={lecture}
                currentUser={user}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onEdit={handleEditClick}
                onDelete={handleDeleteLecture}
                onComment={handleComment}
                onShare={handleShareClick}
                setFullscreenMedia={setViewerFile}
              />
            );
          })}
        </div>
            {visibleCount < displayedContent.length && (
              <div className="flex justify-center mt-4 pb-6">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 12)}
                  className={`px-6 py-2.5 rounded-full font-bold shadow-sm transition-all active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
                >
                  Load More Lectures
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Upload Lecture Modal */}
      {isUploadModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div
              className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-xl w-full max-w-md overflow-hidden border animate-in zoom-in-95 duration-200`}
            >
              <div className="p-4 border-b flex justify-between items-center bg-black/5 dark:bg-white/5">
                <h3 className="font-bold text-lg text-inherit flex items-center gap-2">
                  <Video className="w-5 h-5 text-current opacity-80" /> Share Resource
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-inherit opacity-70 hover:opacity-100" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-4">
                
                {/* Basic Info */}
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/10 flex flex-col gap-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2"><FileText className="w-3.5 h-3.5"/> Resource Details</h4>
                  <div>
                  <label htmlFor="upload-title" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                    Title *
                  </label>
                  <input
                    id="upload-title"
                    type="text"
                    value={uploadData.title}
                    onChange={(e) =>
                      setUploadData({ ...uploadData, title: e.target.value })
                    }
                    placeholder="e.g. Introduction to React / Unit 1 Notes"
                    className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                  />
                </div>

                <div>
                  <label htmlFor="upload-subject" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                    Subject *
                  </label>
                  <select
                    id="upload-subject"
                    value={uploadData.subjectId || ""}
                    onChange={(e) => {
                      const selectedSub = mySubjects.find(s => s._id === e.target.value);
                      setUploadData({
                        ...uploadData,
                        subjectId: e.target.value,
                        subjectLabel: selectedSub?.name || selectedSub?.subject || e.target.value
                      });
                    }}
                    className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                  >
                    <option value="" disabled className={getOptionClasses(appTheme, isDark)}>Select a Subject</option>
                    {mySubjects.map(sub => (
                      <option key={sub._id} value={sub._id} className={getOptionClasses(appTheme, isDark)}>
                        {sub.name || sub.subject}
                      </option>
                    ))}
                  </select>
                  </div>
                </div>

                {/* External Links */}
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/10 flex flex-col gap-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2"><LinkIcon className="w-3.5 h-3.5"/> External Links (Optional)</h4>
                  
                  <div>
                  <label htmlFor="upload-media" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                    Main Video / Document Link
                  </label>
                  <input
                    id="upload-media"
                    type="url"
                    value={uploadData.mediaUrl}
                    onChange={(e) =>
                      setUploadData({ ...uploadData, mediaUrl: e.target.value })
                    }
                    placeholder="e.g. YouTube video or Google Drive link"
                    className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                  />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="upload-english" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                        English Notes Link
                    </label>
                    <input
                        id="upload-english"
                        type="url"
                      value={uploadData.englishAttachmentUrl}
                      onChange={(e) =>
                        setUploadData({
                          ...uploadData,
                          englishAttachmentUrl: e.target.value,
                        })
                      }
                      placeholder="e.g. Drive link for English notes"
                        className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                    />
                  </div>
                  <div>
                    <label htmlFor="upload-hindi" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                        Hindi Notes Link
                    </label>
                    <input
                        id="upload-hindi"
                        type="url"
                      value={uploadData.hindiAttachmentUrl}
                      onChange={(e) =>
                        setUploadData({
                          ...uploadData,
                          hindiAttachmentUrl: e.target.value,
                        })
                      }
                      placeholder="e.g. Drive link for Hindi notes"
                        className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                    />
                  </div>
                  </div>
                </div>

                <div>
                  <label id="upload-composer-label" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                    Description & Local File Upload
                  </label>

                  <PostComposer
                    value={composerText}
                    onChange={(val) => {
                      setComposerText(val);
                      // Only auto-detect if no manual files are attached
                      const hasManualFile = attachments.some((a) => a.file !== null);
                      if (!hasManualFile) {
                        const detected = detectMediaInText(val);
                        if (detected) {
                          let dUrl = detected.url;
                          if (
                            dUrl.includes("img.youtube.com") ||
                            dUrl.includes("i.ytimg.com")
                          ) {
                            dUrl = `https://wsrv.nl/?url=${dUrl.replace(/^https?:\/\//, "")}&q=100`;
                          }
                          setAttachments([
                            {
                              previewUrl: dUrl,
                              type: detected.type,
                              file: null,
                            },
                          ]);
                        } else {
                          // Clear auto-detected attachment if URL is gone from text
                          setAttachments((prev) => prev.filter((a) => a.file !== null));
                        }
                      }
                    }}
                    onSend={handlePublish}
                    isSending={isPublishing}
                    placeholder="Paste a link or add a description..."
                    user={user}
                    attachments={attachments}
                    onAddFiles={handleAddFiles}
                    onRemoveFile={handleRemoveFile}
                    setFullscreenMedia={setViewerFile}
                    isDownloadable={uploadData.isDownloadable}
                    onIsDownloadableChange={(e) => {
                      const checked = e.target.checked;

                      setUploadData({
                        ...uploadData,
                        isDownloadable: checked,
                      });
                      setAttachments((prev) =>
                        prev.map((a) => ({ ...a, isDownloadable: checked })),
                      );
                    }}
                    hideInternalPreview={false}
                  />

                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <UploadProgress
                        progress={uploadProgress}
                        fileName={attachments[0]?.file?.name || "Uploading..."}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-inherit/30 bg-black/5 dark:bg-white/5 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-inherit opacity-70 font-bold hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className={`px-5 py-2 rounded-lg font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 ${getPrimaryButtonClasses(appTheme)}`}
                >
                  {isPublishing ? (
                    <div
                      className="loader"
                      style={{ "--s": "10px", "--g": "2px" }}
                    ></div>
                  ) : null}
                  {isPublishing
                    ? "Saving..."
                    : isEditingId
                      ? "Update Lecture"
                      : "Publish Lecture"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        users={shareUsers}
        onShare={handleSendShare}
      />
    </div>
  );
};

export default StudyHub;
