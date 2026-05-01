import React, { useEffect, useState, useRef } from "react";
import {
  MessageCircle,
  Heart,
  Send,
  ThumbsUp,
  ThumbsDown,
  Image as ImageIcon,
  Smile,
  X,
  Video,
  MoreVertical,
  Trash2,
  Edit2,
  Check,
  UserPlus,
  Share2,
  MessageSquare,
  Maximize2,
  Copy,
  CheckSquare,
  Users,
} from "lucide-react";
import PostComposer from "@/components/ui/PostComposer";

import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "@/redux/authSlice";
import Welcome from "@/components/ui/Welcome";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAllContent,
  createContent,
  toggleLike,
  deleteContent,
  updateContent,
  addComment,
  deleteComment,
  editComment,
} from "@/services/contentService";
import { getConversations, sendMessage } from "@/services/chatService";
import { updateUserProfile } from "@/services/userService";
import { subscribeToPush } from "@/services/pushService";
import { sendConnectionRequest } from "@/services/connectionService";
import {
  detectMediaInText,
} from "@/utils/textUtils.jsx";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import PostCard from "@/components/ui/PostCard";
import ShareModal from "@/components/ui/ShareModal";
import InfiniteScrollWrapper from "@/components/ui/InfiniteScrollWrapper";
import UploadProgress from "@/components/ui/UploadProgress";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useSocket } from "@/context/SocketContext";
import DocumentViewer from "@/components/ui/DocumentViewer";
import { useTheme } from "@/context/ThemeContext";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
  getBannerThemeClasses,
} from "@/utils/themeUtils";

/*
  ===============================
  Future-Ready Social Feed
  • Window scrolling
  • Infinite scroll
  • Optimistic likes
  • Fixed composer
  • Mobile-first UX
  ===============================
*/

const PAGE_SIZE = 10;

const HomeFeed = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { appTheme } = useTheme();

  const feedContainerRef = useRef(null); // Ref for the scrollable feed container
  const longPressTimerRef = useRef(null); // Ref for long press timer
  const [isAnimating, setIsAnimating] = useState(false);

  // Composer State
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [isDownloadable, setIsDownloadable] = useState(false);

  // Multi-Select State
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Local state to track connection requests sent during this session
  const [requestedUsers, setRequestedUsers] = useState(new Set());

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [contentToShare, setContentToShare] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.previewUrl?.startsWith("blob:"))
          URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const homeFeedRef = useRef(null);
  const socket = useSocket();

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  /* =========================
     Push Notification Setup
  ========================= */
  useEffect(() => {
    const setupPushNotifications = async () => {
      if ("serviceWorker" in navigator && "PushManager" in window && user) {
        try {
          if (import.meta.env.PROD) {
            const register = await navigator.serviceWorker.register("/sw.js");
            await navigator.serviceWorker.ready;

            // IMPORTANT: Replace this with the VAPID_PUBLIC_KEY generated on your server!
            const publicVapidKey =
              "BCkW5vQACi2AyjLWOTL9SZIju4PVWAzPT6gM6iOk6rxxSuSZwrYgrJQYda5RLZ477p8tEMpCHug_pg_3hYLkIso";

            if (
              publicVapidKey !==
              "BCkW5vQACi2AyjLWOTL9SZIju4PVWAzPT6gM6iOk6rxxSuSZwrYgrJQYda5RLZ477p8tEMpCHug_pg_3hYLkIso"
            ) {
              const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
              });

              // Send subscription configuration to backend
              await subscribeToPush(subscription);
            }
          }
        } catch (err) {
          console.error("Service Worker / Push setup failed:", err);
        }
      }
    };
    setupPushNotifications();
  }, [user]);

  /* =========================
     Infinite Feed Query
  ========================= */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["content"],
    queryFn: ({ pageParam = null }) =>
      getAllContent({ cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    enabled: !!user, // Only run this query if the user is logged in
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

  /* =========================
     Real-Time Post Updates
  ========================= */
  useEffect(() => {
    if (!user || !socket) return;

    const handleNewPost = () => {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    };

    socket.on("new post", handleNewPost);

    return () => socket.off("new post", handleNewPost);
  }, [user, queryClient, socket]);
  const contentItems =
    data?.pages
      .flatMap((p) => (Array.isArray(p?.content) ? p.content : []))
      .filter(
        (item, index, self) =>
          item?._id && 
        index === self.findIndex((p) => p?._id === item._id) &&
        !(item.material?.description || item.content || "")?.startsWith("[LECTURE]")
      ) ?? [];

  /* =========================
     Infinite Scroll Observer
  ========================= */

  // This ref helps distinguish between adding a new post and loading a page of older posts.
  const prevContentLength = useRef(contentItems.length);
  useEffect(() => {
    if (feedContainerRef.current) {
      // When a user creates content, it's added one at a time.
      const isNewContentAdded =
        contentItems.length === prevContentLength.current + 1;

      if (isNewContentAdded) {
        // Scroll to top to see the new post
        feedContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    prevContentLength.current = contentItems.length;
  }, [contentItems, isLoading]);

  const handleAddFiles = (newAttachments) => {
    let incoming = newAttachments;
    if (newAttachments.target) {
      incoming = Array.from(newAttachments.target.files).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith("video") ? "video" : "image",
        title: file.name,
        description: "",
        isDownloadable,
      }));
      newAttachments.target.value = null;
    }
    setAttachments((prev) => [...prev, ...incoming]);
  };

  const handleRemoveFile = (index) => {
    setAttachments((prev) => {
      const newAtts = prev.filter((att, i) => {
        if (i === index && att.previewUrl?.startsWith("blob:"))
          URL.revokeObjectURL(att.previewUrl);
        return i !== index;
      });
      if (newAtts.length === 0) {
        setIsDownloadable(false); // Reset when all files are removed
      }
      return newAtts;
    });
  };

  /* =========================
     Create Post
  ========================= */
  const handleCreateContent = async () => {
    const content = composerText;
    if (!content.trim() && attachments.length === 0) return;

    setIsAnimating(true); // Trigger animation
    try {
      const actualFiles = attachments.filter((a) => a.file);
      
      let extraPayload = {};
      if (attachments.length > 0) {
        extraPayload.mediaTitles = attachments.map((a) => a.title?.trim() || " ");
        extraPayload.mediaDescriptions = attachments.map((a) => a.description?.trim() || " ");
        extraPayload.mediaDownloadable = attachments.map((a) => a.isDownloadable ?? false);
      }

      if (actualFiles.length === 0 && attachments.length > 0 && attachments[0].previewUrl) {
        extraPayload.mediaUrls = attachments.map(a => a.previewUrl);
        extraPayload.mediaTypes = attachments.map(a => a.type || "image");
      } else if (attachments.length === 0) {
        const detected = detectMediaInText(content);
        if (detected) {
          extraPayload.mediaUrl = detected.url;
          extraPayload.mediaType = detected.type;
        }
      }
     
      const newPost = await createContent(
        content,
        attachments,
        (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setUploadProgress(percentCompleted);
        },
        extraPayload,
      );

      // Manually update the query cache with the new post.
      // This provides an instant "refresh" of the feed without a full page reload.
      queryClient.setQueryData(["content"], (oldData) => {
        // If we have a local preview, attach it to the optimistic post for immediate display
        // Note: The backend response 'newPost' should ideally return the cloud URL.
        // If the backend doesn't handle files yet, we rely on the returned data.
        if (attachments.length > 0 && (!newPost.material || !newPost.material.media?.length)) {
          newPost.material = newPost.material || {};
          newPost.material.media = attachments.map((a) => ({
            _id: "temp_" + Math.random().toString(36).substring(7),
            path: a.previewUrl,
            mimetype: a.type === "video" ? "video/mp4" : "image/jpeg",
            title: a.title?.trim() || "",
            description: a.description?.trim() || "",
            isDownloadable: a.isDownloadable ?? false,
            isExternal: true,
          }));
        }

        if (!oldData) {
          return {
            pages: [{ content: [newPost], nextCursor: null }],
            pageParams: [null],
          };
        }

        const newPages = [...oldData.pages];

        if (newPages.length > 0) {
          newPages[0] = {
            ...newPages[0],
            content: [newPost, ...newPages[0].content],
          };
        } else {
          newPages.push({ content: [newPost], nextCursor: null });
        }

        return {
          ...oldData,
          pages: newPages,
        };
      });

      queryClient.invalidateQueries({ queryKey: ["content"] });

      setComposerText("");
      setAttachments([]);
      setIsDownloadable(true);
    } catch (err) {
      console.error("Failed to create post:", err);
      // Optionally, show an error message to the user here.
    } finally {
      setUploadProgress(0);
      setIsAnimating(false); // End animation
    }
  };

  /* =========================
     Bookmark Post
  ========================= */
  const handleBookmark = async (postId) => {
    const savedPosts = user?.savedPosts || [];
    const isSaved = savedPosts.includes(postId);
    const newSavedPosts = isSaved
      ? savedPosts.filter((id) => id !== postId)
      : [...savedPosts, postId];

    // Optimistic update
    dispatch(updateUser({ ...user, savedPosts: newSavedPosts }));

    try {
      await updateUserProfile(user._id, { savedPosts: newSavedPosts });
    } catch (err) {
      console.error("Failed to bookmark post", err);
      dispatch(updateUser({ ...user, savedPosts })); // Rollback
    }
  };

  const handleConnect = async (authorId) => {
    if (!authorId) return;
    try {
      await sendConnectionRequest(authorId);
      setRequestedUsers((prev) => new Set(prev).add(authorId));
    } catch (error) {
      console.error("Connection request failed", error);
      const msg =
        error.response?.data?.message || "Failed to send connection request.";
      alert(msg);
    }
  };

  const handleComposerChange = (val) => {
    setComposerText(val);
    // Only auto-detect if no manual files are attached
    const hasManualFile = attachments.some((a) => a.file !== null);
    if (!hasManualFile) {
      const detected = detectMediaInText(val);
      if (detected) {
        let dUrl = detected.url;
        if (dUrl.includes("img.youtube.com") || dUrl.includes("i.ytimg.com")) {
          dUrl = `https://wsrv.nl/?url=${dUrl.replace(/^https?:\/\//, "")}&q=100`;
        }
        setAttachments([{ previewUrl: dUrl, type: detected.type, file: null }]);
      } else {
        // ✅ Clear auto-detected attachment if URL is gone from text
        setAttachments((prev) => prev.filter((a) => a.file !== null));
      }
    }
  };
  /* =========================
     Optimistic Like
  ========================= */
  const handleLike = async (postId, type = "👍") => {
    if (!user) return;

    // Perform an immutable optimistic update
    queryClient.setQueryData(["content"], (oldData) => {
      if (!oldData) return oldData;

      const newPages = oldData.pages.map((page) => ({
        ...page,
        content: page.content.map((post) => {
          if (post._id === postId) {
            const existingReaction = post.reactions?.find(
              (r) => r.user === user._id,
            );
            let newReactions = [...(post.reactions || [])];

            if (existingReaction) {
              if (existingReaction.type === type) {
                // Remove if clicking same
                newReactions = newReactions.filter((r) => r.user !== user._id);
              } else {
                // Update if different
                newReactions = newReactions.map((r) =>
                  r.user === user._id ? { ...r, type } : r,
                );
              }
            } else {
              newReactions.push({ user: user._id, type });
            }
            return { ...post, reactions: newReactions };
          }
          return post;
        }),
      }));

      return { ...oldData, pages: newPages };
    });

    try {
      await toggleLike(postId, type);
    } catch {
      // If the API call fails, invalidate the query to refetch from the server
      queryClient.invalidateQueries({ queryKey: ["content"] });
    }
  };

  /* =========================
     Delete & Update Logic
  ========================= */
  const handleDeleteContent = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    // Optimistic Update: Remove post immediately
    queryClient.setQueryData(["content"], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.filter((p) => p._id !== postId),
        })),
      };
    });

    try {
      await deleteContent(postId);
    } catch (error) {
      console.error("Failed to delete post", error);
      queryClient.invalidateQueries({ queryKey: ["content"] }); // Revert on failure
    }
  };

  const saveEdit = async (
    postId,
    payload,
    newAttachments = [],
    existingDownloadable = null,
  ) => {
    const content =
      payload instanceof FormData ? payload.get("content") : payload.content;

    // Optimistic Update
    queryClient.setQueryData(["content"], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.map((p) => {
            if (p._id === postId) {
              const newMediaDocs = newAttachments.map((a) => ({
                _id: "temp_" + Math.random().toString(36).substring(7),
                path: a.previewUrl,
                mimetype: a.type === "video" ? "video/mp4" : "image/jpeg",
                title: a.title || "",
                description: a.description || "",
                isDownloadable: a.isDownloadable ?? false,
              }));

              const updatedMedia = (p.material?.media || []).map((m, idx) => ({
                ...m,
                isDownloadable: existingDownloadable
                  ? existingDownloadable[idx]
                  : m.isDownloadable,
              }));

              return {
                ...p,
                isEdited: true,
                material: {
                  ...p.material,
                  description: content,
                  linkPreview: null,
                  media: [...updatedMedia, ...newMediaDocs],
                }
              };
            }
            return p;
          }),
        })),
      };
    });

    try {
      await updateContent(postId, payload);
      queryClient.invalidateQueries({ queryKey: ["content"] }); // Fetch in background to sync Link Previews instantly
    } catch (error) {
      console.error("Failed to update post", error);
      queryClient.invalidateQueries({ queryKey: ["content"] });
    }
  };

  /* =========================
     Comment Logic
  ========================= */
  const handlePostComment = async (postId, text) => {
    if (!text?.trim()) return;

    try {
      const { comments } = await addComment(postId, text);

      // Update query cache with new comments
      queryClient.setQueryData(["content"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            content: page.content.map((p) =>
              p._id === postId ? { ...p, comments } : p,
            ),
          })),
        };
      });
    } catch (error) {
      console.error("Failed to add comment", error);
    }
  };

  const handleDeleteComment = async (postId, commentIndex) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const resData = await deleteComment(postId, commentIndex);
      queryClient.setQueryData(["content"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            content: page.content.map((p) =>
              p._id === postId ? { ...p, comments: resData.comments } : p,
            ),
          })),
        };
      });
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  const handleEditComment = async (postId, commentIndex, newText) => {
    try {
      const resData = await editComment(postId, commentIndex, newText);
      queryClient.setQueryData(["content"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            content: page.content.map((p) =>
              p._id === postId ? { ...p, comments: resData.comments } : p,
            ),
          })),
        };
      });
    } catch (err) {
      console.error("Failed to edit comment", err);
    }
  };

  const handleRemoveAttachment = async (postId, attachmentIndex) => {
    if (!window.confirm("Remove this attachment?")) return;

    // Safely extract the target post from the complex Infinite Query cache structure
    const cache = queryClient.getQueryData(["content"]);
    let targetPost = null;
    cache?.pages?.forEach((page) => {
      const found = page.content.find((p) => p._id === postId);
      if (found) targetPost = found;
    });

    if (!targetPost) return;

    const newMedia = (targetPost.material?.media || []).filter(
      (_, i) => i !== attachmentIndex,
    );

    queryClient.setQueryData(["content"], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.map((p) =>
            p._id === postId
              ? {
                  ...p,
                  material: {
                    ...p.material,
                    media: newMedia,
                  }
                }
              : p,
          ),
        })),
      };
    });

    try {
      await updateContent(postId, {
        retainedMediaIds: newMedia.map((m) =>
          typeof m === "string" ? m : m._id,
        ),
      });
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Attachment removed! 🗑️" }),
      );
    } catch (error) {
      console.error("Failed to remove attachment", error);
      queryClient.invalidateQueries({ queryKey: ["content"] });
    }
  };

  /* =========================
     Bulk Actions
  ========================= */
  const handleMultiDelete = async () => {
    if (!window.confirm(`Delete ${selectedPosts.length} selected posts?`))
      return;

    const postsToDelete = contentItems.filter((p) =>
      selectedPosts.includes(p._id),
    );
    const canDeleteAll = postsToDelete.every(
      (p) =>
        p.author?._id === user._id ||
        user.role === "Admin" ||
        user.role === "HOD",
    );
    if (!canDeleteAll) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "You don't have permission to delete some of these posts. ❌",
        }),
      );
      return;
    }

    queryClient.setQueryData(["content"], (oldData) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          content: page.content.filter((p) => !selectedPosts.includes(p._id)),
        })),
      };
    });

    try {
      await Promise.all(selectedPosts.map((id) => deleteContent(id)));
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Posts deleted! 🗑️" }),
      );
    } catch (e) {
      queryClient.invalidateQueries({ queryKey: ["content"] });
    } finally {
      setIsMultiSelectMode(false);
      setSelectedPosts([]);
    }
  };

  const handleMultiForward = async () => {
    const postsToShare = contentItems.filter((p) =>
      selectedPosts.includes(p._id),
    );
    setContentToShare(postsToShare);
    setShareModalOpen(true);
    try {
      const users = await getConversations();
      setShareUsers(users);
    } catch (e) {}
  };

  const handleShareClick = async (post) => {
    setContentToShare([post]);
    setShareModalOpen(true);
    try {
      const users = await getConversations();
      setShareUsers(users);
    } catch (err) {
      console.error("Failed to load conversations for sharing", err);
    }
  };

  const handleSendShare = async (targetUserId) => {
    if (!contentToShare || contentToShare.length === 0) return;
    try {
      for (const post of contentToShare) {
        const formData = new FormData();
        if (post.material?.description) formData.append("content", post.material.description);
        else formData.append("content", "Shared a post");

        formData.append(
          "replyToMessageId",
          post._id
        );

        if (post.material?.media && post.material.media.length > 0) {
          const urls = [];
          const types = [];
          const titles = [];
          const descs = [];
          const downloadables = [];

          post.material.media.forEach((m) => {
            const mPath = typeof m === "string" ? m : m.path;
            const mMime = typeof m === "string" ? "" : m.mimetype;
            urls.push(mPath?.startsWith("http") ? mPath : `/${mPath}`);
            types.push(
              mMime === "youtube" || /youtube\.com|youtu\.be/i.test(mPath)
                ? "youtube"
                : mMime?.startsWith("video") ? "video" : "image"
            );
            titles.push((typeof m === "string" ? "" : m.title) || " ");
            descs.push((typeof m === "string" ? "" : m.description) || " ");
            downloadables.push((typeof m === "string" ? false : m.isDownloadable) ?? false);
          });
          formData.append("mediaUrls", JSON.stringify(urls));
          formData.append("mediaUrls__type", "json");
          formData.append("mediaTypes", JSON.stringify(types));
          formData.append("mediaTypes__type", "json");
          formData.append("mediaTitles", JSON.stringify(titles));
          formData.append("mediaTitles__type", "json");
          formData.append("mediaDescriptions", JSON.stringify(descs));
          formData.append("mediaDescriptions__type", "json");
          formData.append("mediaDownloadable", JSON.stringify(downloadables));
          formData.append("mediaDownloadable__type", "json");
        }
        await sendMessage(targetUserId, formData);
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Post(s) shared successfully! 🚀",
        }),
      );
      setShareModalOpen(false);
      setIsMultiSelectMode(false);
      setSelectedPosts([]);
    } catch (error) {
      console.error("Failed to share post", error);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to share post. ❌" }),
      );
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <>
      {!user && <Welcome />}
      <div
        ref={homeFeedRef}
        className="relative flex flex-col mx-auto bg-transparent w-full h-full transition-colors"
      >
        {user && (
          <>
            {/* Feed Container */}
            <div
              ref={feedContainerRef}
              className="flex-grow [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full overflow-y-auto scroll-smooth"
            >
              {/* Header Banner */}
              <div className="w-full max-w-5xl mx-auto pt-6 pb-2 px-4 sm:px-6">
                <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-indigo-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors`}>
                  <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
                    <Users className="w-64 h-64" />
                  </div>
                  <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
                      Campus Feed
                    </h1>
                    <p className="mt-2 text-base md:text-lg font-medium opacity-90 max-w-xl text-blue-100">
                      Stay connected with your campus community, share updates, and see what's happening.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsMultiSelectMode(!isMultiSelectMode);
                      setSelectedPosts([]);
                    }}
                    className={`relative z-10 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 active:scale-95 ${isMultiSelectMode ? "bg-white text-indigo-700" : "bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border border-white/30"}`}
                  >
                    <CheckSquare className="w-5 h-5" />
                    {isMultiSelectMode ? "Cancel Selection" : "Manage Feed"}
                  </button>
                </div>
              </div>
              <div className="w-full max-w-5xl mx-auto pb-4 px-2 sm:px-4">
                {/* Top Social Composer */}
                <div
                  className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-sm border p-4 mb-6 transition-colors`}
                >
                  {uploadProgress > 0 && (
                    <div className="mb-4">
                      <UploadProgress
                        progress={uploadProgress}
                        fileName={
                          attachments[0]?.file?.name || "Uploading media..."
                        }
                      />
                    </div>
                  )}
                  <PostComposer
                    value={composerText}
                    onChange={handleComposerChange}
                    onSend={handleCreateContent}
                    isSending={isAnimating}
                    placeholder="What's on your mind?"
                    user={user}
                    attachments={attachments}
                    onAddFiles={handleAddFiles}
                    onRemoveFile={handleRemoveFile}
                    isDownloadable={isDownloadable}
                    onIsDownloadableChange={(e) => {
                      setIsDownloadable(e.target.checked);
                      setAttachments((prev) =>
                        prev.map((a) => ({
                          ...a,
                          isDownloadable: e.target.checked,
                        })),
                      );
                    }}
                    showDownloadableToggle={true}
                    setFullscreenMedia={setFullscreenMedia}
                    hideInternalPreview={false}
                  />
                </div>

                {/* Posts List */}
                {isLoading && <LoadingSkeleton count={3} />}

                {isError && (
                  <p className="text-center text-red-500">
                    Failed to load feed
                  </p>
                )}
                <InfiniteScrollWrapper
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                >
                  <div className="columns-1 md:columns-2 gap-4 w-full">
                    {Array.isArray(contentItems) &&
                      contentItems.map((post) => {
                        const hasSentRequest = requestedUsers.has(
                          post.author?._id,
                        );

                        return (
                          <PostCard
                            key={post._id}
                            post={post}
                            currentUser={user}
                            onLike={handleLike}
                            onComment={handlePostComment}
                            onDeleteComment={handleDeleteComment}
                            onEditComment={handleEditComment}
                            onRemoveAttachment={handleRemoveAttachment}
                            onDelete={handleDeleteContent}
                            onEdit={saveEdit}
                            onShare={handleShareClick}
                            onBookmark={handleBookmark}
                            onConnect={handleConnect}
                            hasSentRequest={hasSentRequest}
                            setFullscreenMedia={setFullscreenMedia}
                            isMultiSelectMode={isMultiSelectMode}
                            isSelected={selectedPosts.includes(post._id)}
                            toggleSelection={() => {
                              if (selectedPosts.includes(post._id)) {
                                setSelectedPosts((prev) =>
                                  prev.filter((id) => id !== post._id),
                                );
                              } else {
                                setSelectedPosts((prev) => [...prev, post._id]);
                              }
                            }}
                          />
                        );
                      })}
                  </div>
                </InfiniteScrollWrapper>
                {isFetchingNextPage && (
                  <div className="mt-4">
                    <LoadingSkeleton count={2} />
                  </div>
                )}
              </div>
            </div>

            {/* Floating Multi-Select Action Bar */}
            {isMultiSelectMode && selectedPosts.length > 0 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black/80 dark:bg-white/10 backdrop-blur-xl text-white dark:text-inherit px-6 py-3 rounded-full flex items-center gap-4 z-[100] shadow-2xl border border-inherit/20 animate-in slide-in-from-bottom-4">
                <span className="font-bold text-sm">
                  {selectedPosts.length} Selected
                </span>
                <div className="w-px h-4 bg-inherit/30"></div>
                <button
                  onClick={handleMultiDelete}
                  className="flex items-center gap-1.5 text-sm font-bold hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={handleMultiForward}
                  className="flex items-center gap-1.5 text-sm font-bold hover:text-indigo-400 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Forward
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {fullscreenMedia && (
        <div className="absolute z-[9999]">
          <DocumentViewer
            url={fullscreenMedia.url}
            title={fullscreenMedia.title || "Media"}
            media={fullscreenMedia}
            currentUser={user}
            onClose={() => setFullscreenMedia(null)}
            canEdit={false}
          />
        </div>
      )}

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        users={shareUsers}
        onShare={handleSendShare}
      />
    </>
  );
};

export default HomeFeed;
