import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "@/redux/authSlice";
import {
  sendConnectionRequest,
  getConnectionStatus,
} from "@/services/connectionService";
import {
  deleteContent,
  updateContent,
  getContentByUser,
  getAllContent,
} from "@/services/contentService";
import { getUserById, updateUserProfile } from "@/services/userService";
import {
  getCertificatesByStudent,
  downloadCertificate,
} from "@/services/certificateService";
import { getConversations, sendMessage } from "@/services/chatService";
import {
  getRoleProfile,
  canViewDepartmentContent,
  isFacultyRole,
} from "@/utils/roleUtils";
import {
  UserPlus,
  MessageCircle,
  MapPin,
  Briefcase,
  Check,
  Edit,
  GraduationCap,
  Building2,
  Clock,
  Award,
  BookOpen,
  Camera,
  X,
  Phone,
  Calendar,
  MoreVertical,
  Trash2,
  Edit2,
  Maximize2,
  Copy,
  Share2,
  Send,
  FileQuestion,
  ClipboardList,
  FileText,
  CheckCircle2,
  Users,
  Download,
  Bookmark,
  Video,
  Globe,
} from "lucide-react";
import Network from "./Network";
import { renderContentWithLinks } from "@/utils/textUtils";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import ShareModal from "@/components/ui/ShareModal";
import CertificateCard from "@/components/ui/CertificateCard";
import PostCard from "@/components/ui/PostCard";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import UserInfo from "@/components/ui/UserInfo";
import { useTheme } from "@/context/ThemeContext";
import DocumentViewer from "@/components/ui/DocumentViewer";
import EmailManager from "@/components/settings/EmailManager";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";
import { parseLecturePost } from "@/utils/lectureUtils";
import BiometricSettings from "@/components/settings/BiometricSettings";
import VoiceSettings from "@/components/settings/VoiceSettings";

const UserProfile = () => {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  // Fallback to current user if no ID param or it's literally "undefined"
  const userId = useMemo(() => (
    !paramUserId || paramUserId === "undefined"
      ? currentUser?._id
      : paramUserId
  ), [paramUserId, currentUser?._id]);

  const { appTheme } = useTheme();

  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [posts, setPosts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("none");
  const [loading, setLoading] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activityTab, setActivityTab] = useState("posts");
  const [allFeedPosts, setAllFeedPosts] = useState([]);

  const [fullscreenMedia, setFullscreenMedia] = useState(null);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    name: "",
    bio: "",
    location: "",
    contactNumber: "",
    dob: "",
    skills: "",
  });
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [selectedProfilePic, setSelectedProfilePic] = useState(null);
  const [previewBanner, setPreviewBanner] = useState(null);
  const [previewProfilePic, setPreviewProfilePic] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!userId) return;

      try {
        // Parallel fetch for speed
        const [userRes, postsRes, statusRes, certsRes, allFeedRes] =
          await Promise.all([
            getUserById(userId),
            getContentByUser(userId).catch(() => []),
            getConnectionStatus(userId).catch(() => ({ status: "none" })),
            getCertificatesByStudent(userId).catch(() => []),
            currentUser?._id === userId
              ? getAllContent({ limit: 100 }).catch(() => ({ content: [] }))
              : Promise.resolve({ content: [] }),
          ]);

        setProfile(userRes);
        const basicProfile = userRes;
        setCertificates(certsRes || []);
        setPosts(postsRes || []);

        const rawPosts = Array.isArray(allFeedRes.content)
          ? allFeedRes.content
          : Array.isArray(allFeedRes)
            ? allFeedRes
            : [];
        setAllFeedPosts(rawPosts);

        // 2. Fetch Role Specific Details (Signup Data)
        const detailsRes = await getRoleProfile(basicProfile.role, userId);

        if (isMounted) {
          if (detailsRes) setDetails(detailsRes);
          setConnectionStatus(statusRes.status);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingActivity(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleConnect = async () => {
    try {
      await sendConnectionRequest(userId);
      setConnectionStatus("pending");
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: err.response?.data?.message || "Failed to send request. ❌",
        }),
      );
    }
  };

  const handleDeleteContent = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteContent(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (error) {
      console.error("Failed to delete post", error);
    }
  };

  const handleRestoreContent = async (postId) => {
    try {
      await updateContent(postId, { isDeleted: false });
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, isDeleted: false } : p)),
      );
      setAllFeedPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, isDeleted: false } : p)),
      );
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Post restored from trash! ♻️",
        }),
      );
    } catch (error) {
      console.error("Failed to restore post", error);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to restore post. ❌" }),
      );
    }
  };

  const handleEmptyTrash = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete ALL items in the Trash Bin? This cannot be undone!",
      )
    )
      return;

    const currentTrashPosts = posts.filter((p) => p.isDeleted);
    const trashIds = currentTrashPosts.map((p) => p._id);
    const previousPosts = [...posts];
    const previousAllFeed = [...allFeedPosts];

    // Optimistic clear
    setPosts((prev) => prev.filter((p) => !trashIds.includes(p._id)));
    setAllFeedPosts((prev) => prev.filter((p) => !trashIds.includes(p._id)));

    try {
      const results = await Promise.allSettled(trashIds.map((id) => deleteContent(id)));

      const failedIds = trashIds.filter((_, i) => results[i].status === "rejected");
      const succeededIds = trashIds.filter((_, i) => results[i].status === "fulfilled");

      if (failedIds.length > 0) {
        setPosts((prev) => [
          ...prev.filter((p) => !succeededIds.includes(p._id)),
          ...previousPosts.filter((p) => failedIds.includes(p._id)),
        ]);
        setAllFeedPosts((prev) => [
          ...prev.filter((p) => !succeededIds.includes(p._id)),
          ...previousAllFeed.filter((p) => failedIds.includes(p._id)),
        ]);
        window.dispatchEvent(new CustomEvent("showToast", {
          detail: `${failedIds.length} item(s) could not be deleted. ❌`,
        }));
      } else {
        window.dispatchEvent(new CustomEvent("showToast", {
          detail: "Trash Bin emptied successfully! 🗑️",
        }));
      }
    } catch (err) {
      console.error("Failed to empty trash", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to empty trash. Restoring view. ❌",
        }),
      );
      setPosts(previousPosts);
      setAllFeedPosts(previousAllFeed);
    }
  };

  const handleRemoveAttachment = async (postId, attachmentIndex) => {
    if (!window.confirm("Are you sure you want to remove this attachment?"))
      return;

    const targetPost = posts.find((p) => p._id === postId);
    if (!targetPost) return;

    const newMedia = (targetPost.media || []).filter(
      (_, i) => i !== attachmentIndex,
    );

    // Optimistic Update
    const optimisticUpdate = (p) =>
      p._id === postId ? { ...p, media: newMedia } : p;
    setPosts((prev) => prev.map(optimisticUpdate));
    setAllFeedPosts((prev) => prev.map(optimisticUpdate));

    try {
      await updateContent(postId, {
        retainedMediaIds: newMedia
          .filter((m) => m._id && !m._isTemp)
          .map((m) =>
            typeof m === "string" ? m : m._id,
        ),
      });
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Attachment removed! 🗑️" }),
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to remove attachment. ❌",
        }),
      );
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

    try {
      await updateContent(postId, payload);

      const newMediaDocs = newAttachments.map((a) => ({
        _id: null,
        _isTemp: true,
        path: a.previewUrl,
        mimetype: a.type === "video" ? "video/mp4" : "image/jpeg",
        title: a.title || "",
        description: a.description || "",
        isDownloadable: a.isDownloadable ?? false,
      }));

      setPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const updatedMedia = (p.media || []).map((m, idx) => ({
              ...m,
              isDownloadable: existingDownloadable
                ? existingDownloadable[idx]
                : m.isDownloadable,
            }));
            return {
              ...p,
              content: content,
              isEdited: true,
              linkPreview: null,
              media: [...updatedMedia, ...newMediaDocs],
            };
          }
          return p;
        }),
      );

      setAllFeedPosts((prev) =>
        prev.map((p) => {
          if (p._id === postId) {
            const updatedMedia = (p.media || []).map((m, idx) => ({
              ...m,
              isDownloadable: existingDownloadable
                ? existingDownloadable[idx]
                : m.isDownloadable,
            }));
            return {
              ...p,
              content: content,
              isEdited: true,
              linkPreview: null,
              media: [...updatedMedia, ...newMediaDocs],
            };
          }
          return p;
        }),
      );
    } catch (error) {
      console.error("Failed to update post", error);
    }
  };

  const handleShareClick = async (post) => {
    setPostToShare(post);
    setShareModalOpen(true);
    try {
      const users = await getConversations();
      setShareUsers(users);
    } catch (err) {
      console.error("Failed to load conversations for sharing", err);
    }
  };

  const handleSendShare = async (targetUserId) => {
    if (!postToShare) return;
    try {
      // ✅ Strip internal metadata markers before using as message content
      const rawContent = postToShare.content || "";
      const displayContent = rawContent.startsWith("[LECTURE]")
        ? rawContent.split("\n\n").slice(1).join("\n\n").trim() || "Shared a lecture"
        : rawContent.substring(0, 200) || "Shared a post";

      const payload = {
        content: displayContent,
        replyToMessage: {
          _id: postToShare._id,
          senderName: postToShare.author?.name || profile?.name || "A User",
          content: displayContent.substring(0, 50) || "Forwarded Post",
        }
      };

      if (postToShare.media && postToShare.media.length > 0) {
        payload.mediaUrls = [];
        payload.mediaTypes = [];
        payload.mediaTitles = [];
        payload.mediaDescriptions = [];
        payload.mediaDownloadable = [];

        postToShare.media.forEach((m) => {
          const mPath = typeof m === "string" ? m : m.path;
          payload.mediaUrls.push(mPath?.startsWith("http") ? mPath : `/${mPath}`);
          payload.mediaTypes.push(
            m.mimetype === "youtube" || /youtube\.com|youtu\.be/i.test(mPath)
              ? "youtube"
              : m.mimetype?.startsWith("video") ? "video" 
              : m.mimetype?.startsWith("audio") ? "audio" 
              : "image"
          );
          payload.mediaTitles.push(m.title || " ");
          payload.mediaDescriptions.push(m.description || " ");
          payload.mediaDownloadable.push(m.isDownloadable ?? false);
        });
      }

      await sendMessage(targetUserId, payload);

      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Post shared successfully! 🚀",
        }),
      );
      setShareModalOpen(false);
    } catch (error) {
      console.error("Failed to share post", error);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to share post. ❌" }),
      );
    }
  };

  const handleBookmarkPost = async (postId) => {
    const savedPosts = currentUser?.savedPosts || [];
    const isSaved = savedPosts.includes(postId);
    const newSavedPosts = isSaved
      ? savedPosts.filter((id) => id !== postId)
      : [...savedPosts, postId];
    dispatch(updateUser({ ...currentUser, savedPosts: newSavedPosts }));
    setProfile((prev) => ({ ...prev, savedPosts: newSavedPosts }));
    try {
      await updateUserProfile(currentUser?._id, { savedPosts: newSavedPosts });
    } catch (err) {
      console.error("Failed to bookmark post", err);
      dispatch(updateUser({ ...currentUser, savedPosts })); // Rollback
    }
  };

  const handleBookmarkLecture = async (lectureId) => {
    const savedLectures = currentUser?.savedLectures || [];
    const isSaved = savedLectures.includes(lectureId);
    const newSavedLectures = isSaved
      ? savedLectures.filter((id) => id !== lectureId)
      : [...savedLectures, lectureId];
    dispatch(updateUser({ ...currentUser, savedLectures: newSavedLectures }));
    setProfile((prev) => ({ ...prev, savedLectures: newSavedLectures }));
    try {
      await updateUserProfile(currentUser?._id, {
        savedLectures: newSavedLectures,
      });
    } catch (err) {
      console.error("Failed to bookmark lecture", err);
      dispatch(updateUser({ ...currentUser, savedLectures }));
      setProfile((prev) => ({ ...prev, savedLectures }));
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: "Failed to save lecture bookmark. ❌",
      }));
    }
  };

  const handleDownloadCertificate = async (certId, title) => {
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Generating certificate... ⏳",
        }),
      );
      await downloadCertificate(certId);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Certificate downloaded! 🎉" }),
      );
    } catch (err) {
      console.error("Certificate download failed:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to download certificate. ❌";
      window.dispatchEvent(new CustomEvent("showToast", { detail: errorMsg }));
    }
  };

  const handleEditClick = () => {
    setEditFormData({
      name: profile.name || "",
      bio: profile.bio || "",
      location: profile.location || "",
      contactNumber: profile.contactNumber || "",
      dob: (profile.dob && !isNaN(new Date(profile.dob).getTime())) 
        ? new Date(profile.dob).toISOString().split("T")[0] 
        : "",
      skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || ""),
    });
    setPreviewBanner(profile.banner || null);
    setPreviewProfilePic(profile.profilePicture || null);
    setIsEditing(true);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const scrollContainer = document.getElementById("main-scroll-container");
      if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === "banner") {
      if (previewBanner?.startsWith("blob:")) URL.revokeObjectURL(previewBanner);
      setSelectedBanner(file);
      setPreviewBanner(URL.createObjectURL(file));
    } else {
      if (previewProfilePic?.startsWith("blob:")) URL.revokeObjectURL(previewProfilePic);
      setSelectedProfilePic(file);
      setPreviewProfilePic(URL.createObjectURL(file));
    }
  };

  const handleCancelEdit = () => {
    if (previewBanner?.startsWith("blob:")) URL.revokeObjectURL(previewBanner);
    if (previewProfilePic?.startsWith("blob:")) URL.revokeObjectURL(previewProfilePic);
    setIsEditing(false);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (!editFormData.name.trim()) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Name is required. ❌" }));
      return;
    }
    if (editFormData.dob && new Date(editFormData.dob) > new Date()) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Date of birth cannot be in the future. ❌" }));
      return;
    }

    try {
      const formData = new FormData();

      formData.append("name", editFormData.name);
      formData.append("bio", editFormData.bio);
      formData.append("location", editFormData.location);
      formData.append("contactNumber", editFormData.contactNumber);
      formData.append("dob", editFormData.dob);

      // Process skills
      const skillsArray = editFormData.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);

      if (skillsArray.length === 0) {
        formData.append("skills", ""); // Explicitly send empty string to clear the DB array
      } else {
        skillsArray.forEach((skill) => formData.append("skills[]", skill));
      }

      if (selectedBanner) {
        formData.append("banner", selectedBanner);
      }
      if (selectedProfilePic) {
        formData.append("profilePicture", selectedProfilePic);
      }

      const data = await updateUserProfile(userId, formData);

      // 1. Update Auth Context (Global User State)
      if (currentUser?._id === userId) {
        dispatch(updateUser(data.user));
      }

      // 2. Update Local Profile State (View)
      setProfile(data.user);

      // 3. Close Edit Mode without reloading
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to update profile. ❌",
        }),
      );
    }
  };

  const handleEmailUpdate = (updatedUser) => {
    setProfile(updatedUser);
    if (currentUser?._id === updatedUser._id) {
      dispatch(updateUser(updatedUser));
    }
  };

  // Render Edit Form
  if (isEditing) {
    return (
      <div
        className={`max-w-4xl mx-auto p-4 rounded-xl shadow-lg ${getCardThemeClasses(appTheme)}`}
      >
        <div className="flex justify-between items-center mb-6 border-b border-inherit/30 pb-4">
          <h2 className="text-2xl font-bold">Edit Profile</h2>
          <button
            onClick={() => setIsEditing(false)}
            className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-inherit opacity-70" />
          </button>
        </div>

        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-6">
          {/* Banner Upload */}
          <div className="relative h-40 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden group">
            {previewBanner ? (
              <img
                referrerPolicy="no-referrer"
                src={previewBanner}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Banner
              </div>
            )}
            <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "banner")}
              />
            </label>
          </div>

          {/* Profile Pic Upload */}
          <div className="relative -mt-16 ml-6 w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600 overflow-hidden group">
            {previewProfilePic ? (
              <img
                referrerPolicy="no-referrer"
                src={previewProfilePic}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-3xl text-gray-500 dark:text-gray-300">
                {profile.name?.charAt(0)}
              </div>
            )}
            <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "profile")}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
              />
            </div>
            <div>
              <label htmlFor="profile-bio" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Headline / Bio
              </label>
              <input
                id="profile-bio"
                type="text"
                value={editFormData.bio}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, bio: e.target.value })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
                placeholder="e.g. Student at SocioFest University"
              />
            </div>
            <div>
              <label htmlFor="profile-location" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Location
              </label>
              <input
                id="profile-location"
                type="text"
                value={editFormData.location}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, location: e.target.value })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
                placeholder="City, Country"
              />
            </div>
            <div>
              <label htmlFor="profile-dob" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Date of Birth
              </label>
              <input
                id="profile-dob"
                type="date"
                value={editFormData.dob}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, dob: e.target.value })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
              />
            </div>
            <div>
              <label htmlFor="profile-contact" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Contact Number
              </label>
              <input
                id="profile-contact"
                type="tel"
                value={editFormData.contactNumber}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    contactNumber: e.target.value,
                  })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="profile-skills" className="block text-sm font-medium text-inherit opacity-90 mb-1">
                Skills (comma separated)
              </label>
              <textarea
                id="profile-skills"
                value={editFormData.skills}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, skills: e.target.value })
                }
                className="w-full p-2 border border-inherit/50 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
                placeholder="React, Node.js, Leadership, Public Speaking"
                rows="2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 text-inherit bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-colors ${getPrimaryButtonClasses(appTheme)}`}
            >
              Save Profile
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-inherit/30 pt-8">
          <EmailManager user={profile} setUser={handleEmailUpdate} />
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <LoadingSkeleton count={1} className="mt-8" />
        <LoadingSkeleton count={2} />
      </div>
    );
  if (!profile) return <div className="text-center p-10">User not found</div>;

  // Advanced Permission Logic for Navigation
  const currentUserDept =
    currentUser?.department?._id || currentUser?.department;
  const profileDept = profile?.department?._id || profile?.department;
  const isSameDept =
    currentUserDept &&
    profileDept &&
    String(currentUserDept) === String(profileDept);
  const canViewContent = canViewDepartmentContent(
    currentUser?.role,
    isSameDept,
  );

  const studentDashboardLink =
    currentUser?._id === profile._id
      ? "/dashboard"
      : canViewContent && ["Admin", "HOD", "Teacher"].includes(currentUser.role)
        ? `/dashboard?userId=${profile._id}`
        : null;

  const facultyActivitiesLink = canViewContent ? "/activities" : null;

  const savedPosts = allFeedPosts.filter(
    (p) =>
      profile?.savedPosts?.includes(p._id) &&
      !(p.material?.description || p.content || "")?.startsWith("[LECTURE]"),
  );

  const savedLectures = allFeedPosts
    .filter(
      (p) =>
        profile?.savedLectures?.includes(p._id) &&
        (p.material?.description || p.content || "")?.startsWith("[LECTURE]"),
    )
    .map((p) => {
      const rawContent = p.material?.description || p.content || "";
      const contentParts = rawContent.split("\n\n");
      const metaString = contentParts[0].replace("[LECTURE]", "");
      const description = contentParts.slice(1).join("\n\n");
      const parts = metaString.split("|");

      let title = parts[0] || "Untitled";
      let jobLabel = parts[1] || "General";
      let viewsStr = parts[2] || "0";
      let englishUrl = "";
      let hindiUrl = "";

      if (parts.length >= 5) {
        if (["English", "Hindi", "Bilingual"].includes(parts[3])) {
          if (parts[4] !== "none") {
            if (parts[3] === "Hindi") hindiUrl = parts[4];
            else englishUrl = parts[4];
          }
        } else {
          englishUrl = parts[3] !== "none" ? parts[3] : "";
          hindiUrl = parts[4] !== "none" ? parts[4] : "";
        }
      }

      return {
        ...p,
        title,
              subjectLabel: jobLabel,
        description,
        likes: p.reactions?.length || 0,
        views: parseInt(viewsStr) || 0,
        englishAttachmentUrl: englishUrl,
        hindiAttachmentUrl: hindiUrl,
      };
    });

  const myRegularPosts = posts.filter(
    (p) => !(p.material?.description || p.content || "")?.startsWith("[LECTURE]") && !p.isDeleted,
  );

  const myTrashPosts = posts.filter((p) => p.isDeleted);

  const myLectures = posts
    .filter((p) => (p.material?.description || p.content || "")?.startsWith("[LECTURE]") && !p.isDeleted)
    .map((p) => parseLecturePost({ ...p, content: p.material?.description || p.content }));

  const studentData = profile?.studentData || details?.studentData || details || {};
  const teacherData = profile?.teacherData || details?.teacherData || details || {};
  const hodData = profile?.hodData || details?.hodData || details || {};

  return (
    <div className="max-w-6xl mx-auto p-4 flex flex-col gap-4">
      {/* Header Card */}
      <div
        className={`${getCardThemeClasses(appTheme)} rounded-xl shadow-sm overflow-hidden`}
      >
        {/* Banner Section */}
        <div className="h-40 md:h-[380px] bg-gray-200 dark:bg-gray-700 relative">
          {profile.banner ? (
            <img
              referrerPolicy="no-referrer"
              src={profile.banner}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-400 to-indigo-500"></div>
          )}
        </div>
        <div>
          <div className="w-full   relative">
            <div className="absolute -top-12 md:-top-16 left-4 md:left-8 border-4 border-transparent rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-sm shadow-md shrink-0">
              <UserInfo
                user={profile}
                avatarSize="w-24 h-24 md:w-32 md:h-32"
                showText={false}
                nameClassName="text-3xl md:text-4xl"
              />
            </div>

            <div
              className={`pt-14 md:pt-16 mt-1 p-4 md:px-10 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center h-full gap-4 ${getCardThemeClasses(appTheme)} border-0 rounded-none`}
            >
              <div className="p-2">
                <h1 className="text-2xl font-bold text-inherit">
                  {profile.name}
                </h1>
                <p className="opacity-90 font-medium">
                  {profile.bio || profile.role}
                </p>
                <p className="text-inherit opacity-60 text-sm mt-1">
                  {profile.role} • {profile.department?.name || "General"}
                </p>
                <div className="mt-2">
                  {profile.role === "Admin" &&
                    profile.managedUsers !== undefined && (
                      <span className="text-inherit text-xs font-semibold bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 flex items-center w-fit gap-1 shadow-sm">
                        <Users className="w-3 h-3 text-current opacity-80" /> Managing{" "}
                        {profile.managedUsers} Users
                      </span>
                    )}
                  {profile.role === "Teacher" &&
                    details?.stats?.studentCount !== undefined && (
                      <span className="text-inherit text-xs font-semibold bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 flex items-center w-fit gap-1 shadow-sm">
                        <Users className="w-3 h-3 text-current opacity-80" /> Mentoring{" "}
                        {details.stats.studentCount} Students
                      </span>
                    )}
                  {profile.role === "HOD" &&
                    details?.stats?.studentCount !== undefined && (
                      <span className="text-inherit text-xs font-semibold bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 flex items-center w-fit gap-1 shadow-sm">
                        <Users className="w-3 h-3 text-current opacity-80" />{" "}
                        Supervising {details.stats.studentCount} Students
                      </span>
                    )}
                  {profile.role === "Student" &&
                    details?.stats?.subjectCount !== undefined && (
                      <span className="text-inherit text-xs font-semibold bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 flex items-center w-fit gap-1 shadow-sm">
                        <BookOpen className="w-3 h-3 text-current opacity-80" /> Enrolled
                        in {details.stats.subjectCount} Subjects
                      </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm opacity-80 text-inherit">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {profile.location}
                    </span>
                  )}
                  {profile.contactNumber && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" /> {profile.contactNumber}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" /> {profile.email}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 justify-between">
                {currentUser?._id === profile._id ? (
                  <button
                    onClick={handleEditClick}
                    className={`px-6 py-2 flex items-center gap-1 rounded-lg font-medium shadow-sm transition-colors ${getPrimaryButtonClasses(appTheme)}`}
                  >
                    <Edit className="w-4 h-4" /> Edit Profile
                  </button>
                ) : (
                  <>
                    {connectionStatus === "none" && (
                      <button
                        onClick={handleConnect}
                        className={`gap-2 w-full flex items-center px-4 py-2 rounded-lg transition shadow-sm font-bold ${getPrimaryButtonClasses(appTheme)}`}
                      >
                        <UserPlus className="w-4 h-4" /> Connect
                      </button>
                    )}
                    {connectionStatus === "pending" && (
                      <button
                        disabled
                        variant="outline"
                        className="gap-2 w-full text-yellow-600 dark:text-yellow-400 flex items-center px-4 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 cursor-not-allowed"
                      >
                        <div
                          className="loader"
                          style={{ "--s": "10px", "--g": "2px" }}
                        ></div>{" "}
                        Pending
                      </button>
                    )}
                    {connectionStatus === "accepted" && (
                      <button
                        variant="outline"
                        className="gap-2 w-full text-green-600 dark:text-green-400 border border-green-500/30 bg-green-500/10 flex items-center px-4 py-2 rounded-lg"
                      >
                        <Check className="w-4 h-4" /> Connected
                      </button>
                    )}

                    <button
                      variant="outline"
                      onClick={() => navigate(`/chat?userId=${profile._id}`)}
                      className="flex w-full items-center gap-2 px-4 py-2 border border-inherit/30 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition text-inherit"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div className="flex flex-col lg:flex-row w-full gap-4 mt-4">
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <div
            className={`p-4 rounded-xl shadow-sm ${getCardThemeClasses(appTheme)}`}
          >
            <h3 className="font-bold text-inherit mb-2">About</h3>
            <p className="text-sm opacity-90 text-inherit">
              {profile.bio ||
                `Member of the ${profile.department?.name} department.`}
            </p>
            {profile.dob && (
              <div className="mt-3 text-sm text-inherit opacity-70 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Born{" "}
                {new Date(profile.dob).toLocaleDateString()}
              </div>
            )}
            {profile.skills && profile.skills.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-sm mb-2 text-inherit">
                  Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-black/5 dark:bg-white/5 text-inherit text-xs rounded-md border border-inherit/30"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Role Specific Details Card */}
          <div
            className={`p-4 rounded-xl shadow-sm flex flex-col gap-4 ${getCardThemeClasses(appTheme)}`}
          >
            <h3 className="font-bold text-inherit border-b border-inherit/30 pb-2">
              Details
            </h3>

            {/* Student Details */}
            {profile.role === "Student" && details && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <GraduationCap className="w-5 h-5 text-current opacity-60 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-inherit">
                      Semester {studentData.semester || "N/A"}
                    </p>
                    <p className="text-xs opacity-70">Current Academic Year</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-inherit">
                      Roll No: {studentData.rollNumber || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Teacher Details */}
            {profile.role === "Teacher" && details && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Briefcase className="w-5 h-5 text-current opacity-60 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-inherit">
                      Experience
                    </p>
                    <p className="text-sm opacity-80">
                      {teacherData.experience ? `${teacherData.experience} Years` : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-current opacity-60 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-inherit">
                      Qualifications
                    </p>
                    <p className="text-sm opacity-80">
                      {teacherData.qualifications || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* HOD Details */}
            {profile.role === "HOD" && details && (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-current opacity-60 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-inherit">Tenure</p>
                    <p className="text-sm opacity-80">
                      {hodData.tenure ? `${hodData.tenure} Years as HOD` : "N/A"}
                    </p>
                  </div>
                </div>
                {hodData.achievements && (
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-current opacity-60 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-inherit">
                        Achievements
                      </p>
                      <p className="text-sm opacity-80">
                        {hodData.achievements}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Subjects List */}
            {details?.subjects && details.subjects.length > 0 && (
              <div className="pt-2 border-t border-inherit/30 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-current opacity-80" />
                  <span className="font-semibold text-sm text-inherit">
                    Subjects
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {details.subjects.map((sub, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-black/5 dark:bg-white/5 text-inherit text-xs rounded-md border border-inherit/30"
                    >
                      {sub.name || sub.subject} (Sem {sub.semester})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Stats */}
            {details?.stats && (
              <div className="pt-4 border-t border-inherit/30 mt-4">
                <h4 className="font-semibold text-sm mb-3 text-inherit">
                  Academic Contributions
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {profile.role === "Student" ? (
                    <>
                      <div
                        onClick={
                          studentDashboardLink
                            ? () =>
                                navigate(`${studentDashboardLink}#quiz-history`)
                            : undefined
                        }
                        className={`bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex flex-col items-center justify-center text-center shadow-sm transition-all ${studentDashboardLink ? "cursor-pointer hover:bg-blue-500/20 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                      >
                        <FileQuestion className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                          {details.stats.quizzesAttempted}
                        </span>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 opacity-80">
                          Quizzes Attempted
                        </span>
                      </div>
                      <div
                        onClick={
                          studentDashboardLink
                            ? () => navigate(`${studentDashboardLink}#subjects`)
                            : undefined
                        }
                        className={`bg-green-500/10 border border-green-500/20 p-3 rounded-lg flex flex-col items-center justify-center text-center shadow-sm transition-all ${studentDashboardLink ? "cursor-pointer hover:bg-green-500/20 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                          {details.stats.assignmentsSubmitted}
                        </span>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 opacity-80">
                          Assignments Done
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        onClick={
                          facultyActivitiesLink
                            ? () => navigate(`${facultyActivitiesLink}#quizzes`)
                            : undefined
                        }
                        className={`bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg flex flex-col items-center justify-center text-center shadow-sm transition-all ${facultyActivitiesLink ? "cursor-pointer hover:bg-purple-500/20 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                      >
                        <FileQuestion className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-1" />
                        <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                          {details.stats.quizzesGenerated}
                        </span>
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 opacity-80">
                          Quizzes Created
                        </span>
                      </div>
                      <div
                        onClick={
                          facultyActivitiesLink
                            ? () =>
                                navigate(`${facultyActivitiesLink}#assignments`)
                            : undefined
                        }
                        className={`bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex flex-col items-center justify-center text-center shadow-sm transition-all ${facultyActivitiesLink ? "cursor-pointer hover:bg-indigo-500/20 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                      >
                        <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-1" />
                        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                          {details.stats.assignmentsCreated}
                        </span>
                        <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 opacity-80">
                          Assignments Set
                        </span>
                      </div>
                      <div
                        onClick={
                          facultyActivitiesLink
                            ? () =>
                                navigate(`${facultyActivitiesLink}#materials`)
                            : undefined
                        }
                        className={`bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex flex-col items-center justify-center text-center col-span-2 shadow-sm transition-all ${facultyActivitiesLink ? "cursor-pointer hover:bg-orange-500/20 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                      >
                        <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400 mb-1" />
                        <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                          {details.stats.materialsUploaded}
                        </span>
                        <span className="text-xs font-medium text-orange-600 dark:text-orange-400 opacity-80">
                          Materials Uploaded
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-inherit/30 mt-2 text-xs text-inherit opacity-60">
              Joined {new Date(profile.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Certificates Section */}
          {certificates.length > 0 && (
            <div
              className={`p-4 rounded-xl shadow-sm flex flex-col gap-4 ${getCardThemeClasses(appTheme)}`}
            >
              <h3 className="font-bold text-inherit border-b border-inherit/30 pb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-600" /> Earned
                Certificates
              </h3>
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-1">
                {certificates.map((cert) => (
                  <CertificateCard
                    key={cert._id}
                    cert={cert}
                    onDownload={handleDownloadCertificate}
                  />
                ))}
              </div>
            </div>
          )}

          {currentUser?._id === profile._id && <Network />}
        </div>
        <div className="w-full lg:w-2/3 flex flex-col gap-4">
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-2 mb-4 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
            <button
              onClick={() => setActivityTab("posts")}
              className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "posts" ? "text-current border-b-2 border-current" : "opacity-60 hover:opacity-100 text-inherit"}`}
            >
              Posts
            </button>
            {(myLectures.length > 0 ||
              (profile.role !== "Student" &&
                currentUser?._id === profile._id)) && (
              <button
                onClick={() => setActivityTab("my_lectures")}
                className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "my_lectures" ? "text-current border-b-2 border-current" : "opacity-60 hover:opacity-100 text-inherit"}`}
              >
                Lectures
              </button>
            )}
            {currentUser?._id === profile._id && (
              <>
                <button
                  onClick={() => setActivityTab("saved_posts")}
                  className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "saved_posts" ? "text-current border-b-2 border-current" : "opacity-60 hover:opacity-100 text-inherit"}`}
                >
                  Saved Posts
                </button>
                <button
                  onClick={() => setActivityTab("saved_lectures")}
                  className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "saved_lectures" ? "text-current border-b-2 border-current" : "opacity-60 hover:opacity-100 text-inherit"}`}
                >
                  Saved Lectures
                </button>
                <button
                  onClick={() => setActivityTab("security")}
                  className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "security" ? "text-current border-b-2 border-current" : "opacity-60 hover:opacity-100 text-inherit"}`}
                >
                  Security & AI
                </button>
              </>
            )}
            {currentUser?._id === profile._id && myTrashPosts.length > 0 && (
              <button
                onClick={() => setActivityTab("trash")}
                className={`font-bold whitespace-nowrap px-2 pb-2 -mb-[10px] transition-colors ${activityTab === "trash" ? "text-red-500 border-b-2 border-red-500" : "opacity-60 hover:opacity-100 text-red-500 dark:text-red-400"}`}
              >
                Trash Bin ({myTrashPosts.length})
              </button>
            )}
          </div>

          {loadingActivity ? (
            <LoadingSkeleton count={2} />
          ) : (
            activityTab === "posts" &&
            (myRegularPosts.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No posts yet."
                actionButton={
                  currentUser?._id === profile._id && (
                    <button
                      onClick={() => navigate("/feed")}
                      className={`px-4 py-2 font-medium rounded-lg transition shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                    >
                      Post Your Thoughts ...
                    </button>
                  )
                }
              />
            ) : (
              <div className="columns-1 md:columns-2 gap-4">
                {myRegularPosts.map((post) => (
                  <div className="break-inside-avoid mb-4" key={post._id}>
                    <PostCard
                      post={post}
                      currentUser={currentUser}
                      onDelete={handleDeleteContent}
                      onEdit={saveEdit}
                      onRemoveAttachment={handleRemoveAttachment}
                      onShare={handleShareClick}
                      setFullscreenMedia={setFullscreenMedia}
                      hideHeader={true}
                    />
                  </div>
                ))}
              </div>
            ))
          )}

          {!loadingActivity &&
            activityTab === "my_lectures" &&
            (myLectures.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No Lectures Uploaded"
                description="This user hasn't uploaded any lectures yet."
              />
            ) : (
              <div className="columns-1 md:columns-2 gap-4">
                {myLectures.map((lecture) => (
                  <div className="break-inside-avoid mb-4" key={lecture._id}>
                    <PostCard
                      post={lecture}
                      currentUser={currentUser}
                      onBookmark={handleBookmarkLecture}
                      setFullscreenMedia={setFullscreenMedia}
                      onShare={handleShareClick}
                    />
                  </div>
                ))}
              </div>
            ))}

          {!loadingActivity &&
            activityTab === "saved_posts" &&
            (savedPosts.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="No Saved Posts"
                description="Posts you bookmark will appear here."
              />
            ) : (
              <div className="columns-1 md:columns-2 gap-4">
                {savedPosts.map((post) => (
                  <div className="break-inside-avoid mb-4" key={post._id}>
                    <PostCard
                      post={post}
                      currentUser={currentUser}
                      onBookmark={handleBookmarkPost}
                      onShare={handleShareClick}
                      setFullscreenMedia={setFullscreenMedia}
                      hideHeader={false}
                    />
                  </div>
                ))}
              </div>
            ))}

          {!loadingActivity &&
            activityTab === "saved_lectures" &&
            (savedLectures.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No Saved Lectures"
                description="Lectures you save from the Study Hub will appear here."
              />
            ) : (
              <div className="columns-1 md:columns-2 gap-4">
                {savedLectures.map((lecture) => (
                  <div className="break-inside-avoid mb-4" key={lecture._id}>
                    <PostCard
                      post={lecture}
                      currentUser={currentUser}
                      onBookmark={handleBookmarkLecture}
                      setFullscreenMedia={setFullscreenMedia}
                      onShare={handleShareClick}
                    />
                  </div>
                ))}
              </div>
            ))}

          {!loadingActivity &&
            activityTab === "trash" &&
            (myTrashPosts.length === 0 ? (
              <EmptyState icon={Trash2} title="Trash is Empty" />
            ) : (
              <div className="w-full flex flex-col">
                <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 px-3 bg-black/5 dark:bg-white/5 py-3 rounded-xl border border-inherit/30 gap-3">
                  <p className="text-sm font-medium opacity-80 text-inherit flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Items in trash are
                    automatically deleted after 30 days.
                  </p>
                  <button
                    onClick={handleEmptyTrash}
                    className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-bold flex items-center gap-2 shadow-sm shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Empty Trash
                  </button>
                </div>
                <div className="columns-1 md:columns-2 gap-4">
                  {myTrashPosts.map((post) => (
                    <div
                      className="break-inside-avoid mb-4 opacity-75 hover:opacity-100 transition-opacity"
                      key={post._id}
                    >
                      <PostCard
                        post={post}
                        currentUser={currentUser}
                        onDelete={handleDeleteContent}
                        onRestore={handleRestoreContent}
                        hideHeader={true}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {!loadingActivity &&
            activityTab === "security" &&
            currentUser?._id === profile._id && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BiometricSettings user={profile} />
                <VoiceSettings user={profile} />
              </div>
            )}
        </div>
      </div>
      {fullscreenMedia && (
        <div className="fixed inset-0 z-[9999]">
          <DocumentViewer
            url={fullscreenMedia.url}
            title={fullscreenMedia.title || "Media"}
            media={fullscreenMedia}
            currentUser={currentUser}
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
    </div>
  );
};

export default UserProfile;
