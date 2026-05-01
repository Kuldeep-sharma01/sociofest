import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getNotices,
  createContent,
  deleteContent,
  updateContent,
} from "@/services/contentService";
import { useSelector } from "react-redux";
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/services/eventService";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Megaphone,
  AlertCircle,
  FileText,
  Calendar as CalendarIcon,
  Plus,
  X,
  Edit,
  Save,
  Lock,
  Globe,
  Paperclip,
  Video,
} from "lucide-react";
import EventDetailsModal from "@/components/ui/EventDetailsModal";
import PostComposer from "@/components/ui/PostComposer";
import { useTheme } from "@/context/ThemeContext";
import UserInfo from "@/components/ui/UserInfo";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import { detectMediaInText } from "@/utils/textUtils.jsx";
import PostCard from "@/components/ui/PostCard";
import DocumentViewer from "@/components/ui/DocumentViewer";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
  getBannerThemeClasses,
  getOptionClasses,
} from "@/utils/themeUtils";

const localizer = momentLocalizer(moment);

const categoryColors = {
  Seminar: "#3174ad",
  Workshop: "#4caf50",
  Competition: "#f44336",
  Festival: "#ff9800",
  Personal: "#9c27b0",
  "Study Plan": "#009688",
  Other: "#607d8b",
};

export const NoticeBoard = () => {
  const user = useSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState("notices");
  const { appTheme, isDark } = useTheme();

  // --- Notices State ---
  const [notices, setNotices] = useState([]);
  const [newNotice, setNewNotice] = useState("");
  const [noticeAttachments, setNoticeAttachments] = useState([]);
  const [loadingNotices, setLoadingNotices] = useState(false);
  const [posting, setPosting] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [fullscreenMedia, setFullscreenMedia] = useState(null);

  // --- Events State ---
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start: "",
    end: "",
    description: "",
    category: "Seminar",
    location: "Campus",
    isPrivate: false,
    media: [],
  });
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventError, setEventError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditingId, setIsEditingId] = useState(null);

  const [eventAttachments, setEventAttachments] = useState([]);

  const noticeAttachmentsRef = useRef(noticeAttachments);
  useEffect(() => {
    noticeAttachmentsRef.current = noticeAttachments;
  }, [noticeAttachments]);

  useEffect(() => {
    return () => {
      noticeAttachmentsRef.current.forEach((a) => {
        if (a.previewUrl?.startsWith("blob:"))
          URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const eventAttachmentsRef = useRef(eventAttachments);
  useEffect(() => {
    eventAttachmentsRef.current = eventAttachments;
  }, [eventAttachments]);

  useEffect(() => {
    return () => {
      eventAttachmentsRef.current.forEach((a) => {
        if (a.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  // ================= NOTICES LOGIC =================
  const fetchNotices = useCallback(async (signal) => {
    setLoadingNotices(true);
    setNoticeError("");
    try {
      const data = await getNotices();
      if (signal?.aborted) return;
      const noticesList = Array.isArray(data)
        ? data
        : Array.isArray(data?.content)
          ? data.content
          : [];
      setNotices(noticesList);
    } catch (err) {
      if (!signal?.aborted) setNoticeError("Failed to load notices. Please try again.");
    } finally {
      if (!signal?.aborted) setLoadingNotices(false);
    }
  }, []);

  const handleNewNoticeChange = (val) => {
    setNewNotice(val);
    // Only auto-detect if no manual files are attached
    const hasManualFile = noticeAttachments.some((a) => a.file !== null);
    if (!hasManualFile) {
      const detected = detectMediaInText(val);
      if (detected) {
        let dUrl = detected.url;
        if (dUrl.includes("img.youtube.com") || dUrl.includes("i.ytimg.com")) {
          dUrl = `https://wsrv.nl/?url=${dUrl.replace(/^https?:\/\//, "")}&q=100`;
        }
        setNoticeAttachments([{ previewUrl: dUrl, type: detected.type, file: null }]);
      } else {
        // ✅ Clear auto-detected attachment if URL is gone from text
        setNoticeAttachments((prev) => prev.filter((a) => a.file !== null));
      }
    }
  };

  // Post new notice
  const handlePostNotice = async () => {
    if (!newNotice.trim() && noticeAttachments.length === 0) {
      setNoticeError("Notice or attachments cannot be empty!");
      return;
    }
    if (!user) {
      setNoticeError("Please login to post notices");
      return;
    }
    setPosting(true);
    setNoticeError("");
    try {
      let extraPayload = { isNotice: true };
      const actualFiles = noticeAttachments.filter((a) => a.file);

      if (noticeAttachments.length > 0) {
        extraPayload.mediaTitles = noticeAttachments.map((a) => a.title?.trim() || " ");
        extraPayload.mediaDescriptions = noticeAttachments.map((a) => a.description?.trim() || " ");
        extraPayload.mediaDownloadable = noticeAttachments.map((a) => a.isDownloadable ?? true);
      }

      if (
        actualFiles.length === 0 &&
        noticeAttachments.length > 0 &&
        noticeAttachments[0].previewUrl
      ) {
        extraPayload.mediaUrls = noticeAttachments.map(a => a.previewUrl);
        extraPayload.mediaTypes = noticeAttachments.map(a => a.type || "image");
      } else if (noticeAttachments.length === 0) {
        const detected = detectMediaInText(newNotice);
        if (detected) {
          extraPayload.mediaUrl = detected.url;
          extraPayload.mediaType = detected.type;
        }
      }

      const data = await createContent(
        newNotice,
        noticeAttachments,
        null,
        extraPayload,
      );
      setNotices([data, ...notices]);
      setNewNotice("");
      setNoticeAttachments([]);
    } catch (err) {
      console.error("Error posting notice:", err);
      setNoticeError(err.response?.data?.message || "Failed to post notice.");
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault(); // Prevent adding a new line
      handlePostNotice();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      await deleteContent(id);
      setNotices(notices.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Error deleting notice:", err);
      setNoticeError("Failed to delete notice.");
    }
  };

  const saveEdit = async (
    noticeId,
    payload,
    newAttachments = [],
    existingDownloadable = null,
  ) => {
    const content =
      payload instanceof FormData ? payload.get("content") : payload.content;
    if (!content?.trim() && newAttachments.length === 0) return;

    setPosting(true);
    setNoticeError("");

    try {
      // PostCard passes a perfectly constructed FormData payload, just pass it through
      const updated = await updateContent(noticeId, payload);
      setNotices((prev) =>
        prev.map((n) =>
          n._id === noticeId ? { ...n, ...updated, isEdited: true } : n,
        ),
      );
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Notice updated successfully! 📝",
        }),
      );
    } catch (err) {
      console.error("Failed to update notice", err);
      setNoticeError("Failed to update notice.");
    } finally {
      setPosting(false);
    }
  };

  const handleRemoveAttachment = async (noticeId, attachmentIndex) => {
    if (!window.confirm("Remove this attachment?")) return;

    const targetNotice = notices.find((n) => n._id === noticeId);
    if (!targetNotice) return;

    const newMedia = (targetNotice.material?.media || []).filter(
      (_, i) => i !== attachmentIndex,
    );
    try {
      await updateContent(noticeId, {
        retainedMediaIds: newMedia.map((m) =>
          typeof m === "string" ? m : m._id,
        ),
      });
      setNotices(
        notices.map((n) =>
          n._id === noticeId
            ? {
                ...n,
                material: { ...(n.material || {}), media: newMedia },
              }
            : n,
        ),
      );
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Attachment removed! 🗑️" }),
      );
    } catch (err) {
      console.error(err);
  setNoticeError("Failed to remove attachment.");
    }
  };

  // ================= EVENTS LOGIC =================
  const fetchEvents = useCallback(async (signal) => {
    setLoadingEvents(true);
    setEventError("");
    try {
      const data = await getAllEvents();
      if (signal?.aborted) return;
      const visibleEvents = Array.isArray(data) ? data : [];
      setEvents(
        visibleEvents
          .filter((e) => e.category !== "Notification")
          .map((e) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end),
          })),
      );
    } catch (err) {
      if (!signal?.aborted) setEventError("Failed to load events.");
    } finally {
      if (!signal?.aborted) setLoadingEvents(false);
    }
  }, []);

  const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const handleEventFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newAtts = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("image")
          ? "image"
          : "document",
      title: file.name,
    }));

    setEventAttachments((prev) => [...prev, ...newAtts]);
    if (e.target) e.target.value = null;
  };

  const removeEventAttachment = (idx) => {
    setEventAttachments((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const removeRetainedMedia = (mediaId) => {
    setNewEvent((prev) => ({
      ...prev,
      media: (prev.media || []).filter(
        (m) => (typeof m === "string" ? m : m._id) !== mediaId,
      ),
    }));
  };

  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.start || !newEvent.end) {
      setEventError("Please fill out all required fields.");
      return;
    }
    if (new Date(newEvent.start) >= new Date(newEvent.end)) {
      setEventError("End date must be after the start date.");
      return;
    }
    setAddingEvent(true);
    setEventError("");
    try {
      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        start: new Date(newEvent.start).toISOString(),
        end: new Date(newEvent.end).toISOString(),
        category: newEvent.category,
        location: newEvent.location,
        isPrivate: newEvent.isPrivate,
      };

      if (isEditingId) {
        const retainedMediaIds = newEvent.media?.map((m) => m._id) || [];
        const updatedEvent = await updateEvent(
          isEditingId,
          eventData,
          eventAttachments,
          retainedMediaIds,
        );
        setEvents((prev) =>
          prev.map((e) =>
            e._id === isEditingId
              ? {
                  ...updatedEvent,
                  start: new Date(updatedEvent.start),
                  end: new Date(updatedEvent.end),
                }
              : e,
          ),
        );
        setIsEditingId(null);
      } else {
        const createdEvent = await createEvent(eventData, eventAttachments);
        setEvents([
          ...events,
          {
            ...createdEvent,
            start: new Date(createdEvent.start),
            end: new Date(createdEvent.end),
          },
        ]);
      }

      setNewEvent({
        title: "",
        start: "",
        end: "",
        description: "",
        category: user?.role === "Student" ? "Personal" : "Seminar",
        location: "Campus",
        isPrivate: user?.role === "Student",
        media: [],
      });
      setEventAttachments([]);
    } catch (err) {
      console.error(err);
      setEventError(
        err.response?.data?.message ||
          `Failed to ${isEditingId ? "update" : "add"} event.`,
      );
    } finally {
      setAddingEvent(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e._id !== id));
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      setEventError("Failed to delete event.");
      setTimeout(() => {
        (document.getElementById("main-scroll-container") || window).scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 0);
    }
  };

  const handleEditClick = (event) => {
    setNewEvent({
      title: event.title,
      description: event.description || "",
      start: formatDateForInput(event.start),
      end: formatDateForInput(event.end),
      category: event.category,
      location: event.location || "",
      isPrivate: !event.isPublic,
      media: event.media || [],
    });
    setEventAttachments([]);
    setIsEditingId(event._id);
    setSelectedEvent(null);
    setTimeout(() => {
      const scrollContainer =
        document.getElementById("main-scroll-container") || window;
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight ?? document.body.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  };

  const handleCancelEdit = () => {
    setIsEditingId(null);
    setNewEvent({
      title: "",
      start: "",
      end: "",
      description: "",
      category: user?.role === "Student" ? "Personal" : "Seminar",
      location: "Campus",
      isPrivate: user?.role === "Student",
      media: [],
    });
    setEventAttachments([]);
  };

  useEffect(() => {
    if (user?.role === "Student") {
      setNewEvent((prev) => ({
        ...prev,
        category: "Study Plan",
        isPrivate: true,
      }));
    } else {
      setNewEvent((prev) => ({
        ...prev,
        category: "Seminar",
        isPrivate: false,
      }));
    }
  }, [user?.role]);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotices(controller.signal);
    fetchEvents(controller.signal);
    return () => controller.abort();
  }, [user?._id, fetchNotices, fetchEvents]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <div
        className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-indigo-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <Megaphone className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            Campus Hub
          </h1>
          <p className="opacity-80 mt-2 text-base md:text-lg font-medium max-w-xl">
            Stay updated with college notices and upcoming events.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-inherit/30 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full whitespace-nowrap">
        <button
          onClick={() => setActiveTab("notices")}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "notices"
              ? "text-current border-b-2 border-current"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <FileText className="w-4 h-4" /> Notice Board
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "events"
              ? "text-current border-b-2 border-current"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <CalendarIcon className="w-4 h-4" /> Events Calendar
        </button>
      </div>

      {/* ================= NOTICES TAB ================= */}
      {activeTab === "notices" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
          {/* Post new notice (visible only for teachers/admins) */}
          {(user?.role === "Admin" ||
            user?.role === "Teacher" ||
            user?.role === "HOD") && (
            <div className="p-6 rounded-xl shadow-sm bg-black/5 dark:bg-white/5 border border-inherit/30">
              <PostComposer
                value={newNotice}
                onChange={handleNewNoticeChange}
                onSend={handlePostNotice}
                isSending={posting}
                placeholder="Write a new notice for the college..."
                user={user}
                attachments={noticeAttachments}
                onAddFiles={(incoming) => {
                  let atts = incoming;
                  if (incoming.target) {
                    atts = Array.from(incoming.target.files).map((f) => ({
                      file: f,
                      previewUrl: URL.createObjectURL(f),
                      type: f.type.startsWith("video") ? "video" : "image",
                      title: f.name,
                      description: "",
                    }));
                    incoming.target.value = null;
                  }
                  setNoticeAttachments((prev) => [...prev, ...atts]);
                }}
                onRemoveFile={(idx) => {
                  setNoticeAttachments((prev) =>
                    prev.filter((_, i) => i !== idx),
                  );
                }}
                hideInternalPreview={false}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {noticeError && notices.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <p className="font-medium text-sm">{noticeError}</p>
            </div>
          )}

          {/* Notice List */}
          {loadingNotices ? (
            <LoadingSkeleton count={3} />
          ) : noticeError && notices.length === 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-6 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm animate-in fade-in text-center">
              <AlertCircle className="w-8 h-8 shrink-0 text-red-500" />
              <p className="font-medium text-base">{noticeError}</p>
              <button
                onClick={() => fetchNotices()}
                className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          ) : notices.length === 0 ? (
            <div className="bg-black/5 dark:bg-white/5 rounded-xl shadow-sm border border-inherit/30">
              <div className="p-12 text-center">
                <Megaphone className="w-16 h-16 opacity-30 mx-auto mb-4" />
                <p className="opacity-70 text-lg">No notices posted yet.</p>
              </div>
            </div>
          ) : (
            <div className="columns-1 md:columns-2 gap-4 w-full">
              {notices.map((notice) => (
                <PostCard
                  key={notice._id}
                  post={notice}
                  currentUser={user}
                  onDelete={handleDelete}
                  onEdit={saveEdit}
                  onRemoveAttachment={handleRemoveAttachment}
                  setFullscreenMedia={setFullscreenMedia}
                  hideHeader={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= EVENTS TAB ================= */}
      {activeTab === "events" && (
        <div className="flex flex-col gap-8 animate-in fade-in duration-300">
          {/* Calendar Section */}
          <div
            className={`p-4 w-full shadow-sm rounded-xl border border-inherit/30 transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            {loadingEvents ? (
              <LoadingSkeleton count={1} />
            ) : (
              <div className="h-[500px] md:h-[700px]">
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  onSelectEvent={(event) => setSelectedEvent(event)}
                  popup
                  style={{ height: "100%" }}
                  eventPropGetter={(event) => ({
                    style: {
                      backgroundColor:
                        categoryColors[event.category] || categoryColors.Other,
                      borderRadius: "5px",
                      color: "white",
                      border: "1px solid rgba(0,0,0,0.2)",
                      opacity: 0.9,
                      display: "block",
                    },
                  })}
                />
              </div>
            )}
          </div>

          {/* Add/Edit Event Form */}
          {user && (
            <div className="w-full">
              <div className="flex flex-col gap-6 bg-black/5 dark:bg-white/5 shadow-sm p-4 md:p-6 rounded-xl border border-inherit/30">
                <div className="flex w-full border text-center justify-center border-inherit/50 rounded-lg text-inherit items-center gap-2 p-3 font-semibold bg-black/10 dark:bg-white/10">
                  {isEditingId ? (
                    <Edit className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  {isEditingId ? "Edit Event" : "Schedule New Event"}
                </div>
                <input
                  type="text"
                  placeholder="Event Title *"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  className="w-full border border-inherit/50 bg-transparent text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current placeholder-current opacity-90"
                />
                <textarea
                  placeholder="Description"
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  rows="3"
                  className="w-full border border-inherit/50 bg-transparent text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current placeholder-current opacity-90"
                />
                <div>
                  <label className="block text-sm font-medium mb-1 opacity-90">
                    Visibility
                  </label>
                  <div
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      newEvent.isPrivate
                        ? "bg-black/5 dark:bg-white/5 border-inherit/50"
                        : "bg-black/10 dark:bg-white/10 border-current"
                    }`}
                    onClick={() =>
                      setNewEvent({
                        ...newEvent,
                        isPrivate: !newEvent.isPrivate,
                      })
                    }
                  >
                    <div className="flex items-center gap-2">
                      {newEvent.isPrivate ? (
                        <Lock className="w-4 h-4 opacity-70" />
                      ) : (
                        <Globe className="w-4 h-4 text-current" />
                      )}
                      <span
                        className={`text-sm font-medium ${newEvent.isPrivate ? "opacity-70" : "text-current font-bold"}`}
                      >
                        {newEvent.isPrivate ? "Private Event" : "Public Event"}
                      </span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${newEvent.isPrivate ? "border-inherit/50" : "border-current bg-current"}`}
                    >
                      {!newEvent.isPrivate && (
                        <div className="w-1.5 h-1.5 bg-gray-50 rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">
                      Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={newEvent.start}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, start: e.target.value })
                      }
                      className="w-full border border-inherit/50 bg-transparent text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current opacity-90"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">
                      End Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={newEvent.end}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, end: e.target.value })
                      }
                      className="w-full border border-inherit/50 bg-transparent text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current opacity-90"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">
                      Category
                    </label>
                    <select
                      value={newEvent.category}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, category: e.target.value })
                      }
                      className="w-full border border-inherit/50 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current opacity-90"
                    >
                      {user?.role === "Student" ? (
                        <>
                          <option
                            value="Study Plan"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Study Plan
                          </option>
                          <option
                            value="Personal"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Personal
                          </option>
                        </>
                      ) : (
                        <>
                          <option
                            value="Seminar"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Seminar
                          </option>
                          <option
                            value="Workshop"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Workshop
                          </option>
                          <option
                            value="Competition"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Competition
                          </option>
                          <option
                            value="Festival"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Festival
                          </option>
                          <option
                            value="Personal"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Personal
                          </option>
                          <option
                            value="Other"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Other
                          </option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 opacity-90">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="Location"
                      value={newEvent.location}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, location: e.target.value })
                      }
                      className="w-full border border-inherit/50 bg-transparent text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current placeholder-current opacity-90"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium mb-1 opacity-90">
                    Attachments (Optional)
                  </label>
                  <div className="flex flex-wrap gap-3 mb-2">
                    {newEvent.media?.map((m, idx) => {
                      const mPath = typeof m === "string" ? m : m.path;
                      const mId = typeof m === "string" ? m : m._id;
                      return (
                        <div
                          key={mId || idx}
                          className="relative w-20 h-20 rounded-lg bg-black/10 border border-inherit/30 overflow-hidden shadow-sm"
                        >
                          {m.mimetype?.startsWith("video") ? (
                            <Video className="w-8 h-8 m-auto mt-6 opacity-50 text-inherit" />
                          ) : (
                            <img
                              src={
                                mPath?.startsWith("http") ? mPath : `/${mPath}`
                              }
                              className="w-full h-full object-cover"
                              alt=""
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeRetainedMedia(mId)}
                            className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white rounded-bl-lg p-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    {eventAttachments.map((a, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 rounded-lg bg-black/10 border border-inherit/30 overflow-hidden shadow-sm"
                      >
                        {a.type === "video" ? (
                          <Video className="w-8 h-8 m-auto mt-6 opacity-50 text-inherit" />
                        ) : (
                          <img
                            src={a.previewUrl}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeEventAttachment(idx)}
                          className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white rounded-bl-lg p-1 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-inherit/50 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors shadow-sm">
                      <Paperclip className="w-6 h-6 opacity-60 text-inherit" />
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleEventFileSelect}
                      />
                    </label>
                  </div>
                </div>

                {eventError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-lg flex items-start gap-2 shadow-sm animate-in fade-in">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                    <p className="font-medium text-sm">{eventError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  {isEditingId && (
                    <button
                      onClick={handleCancelEdit}
                      className="flex-1 bg-black/10 dark:bg-white/10 text-inherit rounded-lg font-semibold justify-center items-center hover:bg-black/20 dark:hover:bg-white/20 p-3 transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSaveEvent}
                    disabled={
                      addingEvent ||
                      !newEvent.title ||
                      !newEvent.start ||
                      !newEvent.end
                    }
                    className={`flex-1 flex rounded-lg font-bold shadow-sm justify-center items-center p-3 transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
                  >
                    {addingEvent ? (
                      <>
                        <div
                          className="loader mr-2"
                          style={{ "--s": "10px", "--g": "2px" }}
                        ></div>{" "}
                        {isEditingId ? "Updating..." : "Adding..."}
                      </>
                    ) : (
                      <>
                        {isEditingId ? (
                          <Save className="w-5 h-5 mr-2" />
                        ) : (
                          <Plus className="w-5 h-5 mr-2" />
                        )}
                        {isEditingId ? "Update Event" : "Schedule Event"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Event Details Modal */}
          <EventDetailsModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            currentUser={user}
            onDelete={handleDeleteEvent}
            onEdit={handleEditClick}
          />
        </div>
      )}

      {fullscreenMedia && createPortal(
        <div className="fixed inset-0 z-[9999]">
          <DocumentViewer
            url={fullscreenMedia.url}
            title={fullscreenMedia.title || "Media"}
            media={fullscreenMedia}
            currentUser={user}
            onClose={() => setFullscreenMedia(null)}
            canEdit={false}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default NoticeBoard;
