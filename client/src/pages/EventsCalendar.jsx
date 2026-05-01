import React, { useEffect, useState, useRef } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/services/eventService";
import { useSelector } from "react-redux";
import {
  Plus,
  X,
  Edit,
  Save,
  Lock,
  Globe,
  CalendarDays,
  AlertCircle,
  Paperclip,
  Video,
} from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import EventDetailsModal from "@/components/ui/EventDetailsModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useTheme } from "@/context/ThemeContext";
import {
  getOptionClasses,
  getBannerThemeClasses,
  getCardThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";

const localizer = momentLocalizer(moment);

// Color mapping for different event categories
const categoryColors = {
  Seminar: "#3174ad", // Blue
  Workshop: "#4caf50", // Green
  Competition: "#f44336", // Red
  Festival: "#ff9800", // Orange
  Personal: "#9c27b0", // Purple
  "Study Plan": "#009688", // Teal
  Other: "#607d8b", // Blue Grey
};

const EventsCalendar = () => {
  const user = useSelector((state) => state.auth.user);
  const { appTheme, isDark } = useTheme();
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    title: "",
    start: "",
    end: "",
    description: "",
    category: "Seminar", // Default for non-students
    location: "Campus",
    isPrivate: false,
    media: [],
  });
  const [eventAttachments, setEventAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditingId, setIsEditingId] = useState(null);

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

  // Fetch events from backend
  useEffect(() => {
    // When user is identified as a student, default their category to Personal
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
    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const visibleEvents = await getAllEvents();

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
        console.error("Error fetching events:", err);
        setError("Failed to load events. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user?._id]);

  // Helper to format Date object to input string (YYYY-MM-DDTHH:mm)
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

  // Save (Create or Update) event
  const handleSaveEvent = async () => {
    if (!newEvent.title || !newEvent.start || !newEvent.end) {
      setError("Please fill out all required fields.");
      return;
    }
    if (new Date(newEvent.start) >= new Date(newEvent.end)) {
      setError("End date must be after the start date.");
      return;
    }
    if (!user) {
      setError("Please login to add events");
      return;
    }

    const allowedCategories = user?.role === "Student"
      ? ["Study Plan", "Personal"]
      : ["Seminar", "Workshop", "Competition", "Festival", "Personal", "Other"];

    if (!allowedCategories.includes(newEvent.category)) {
      setError("Invalid event category for your role.");
      return;
    }

    setAdding(true);
    setError("");
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
        // Update existing event
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
        alert("Event updated successfully!");
      } else {
        // Create new event
        const data = await createEvent(eventData, eventAttachments);
        setEvents([
          ...events,
          { ...data, start: new Date(data.start), end: new Date(data.end) },
        ]);
        alert("Event added successfully!");
      }

      // Reset Form
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
      setError(
        err.response?.data?.message ||
          `Failed to ${isEditingId ? "update" : "add"} event.`,
      );
    } finally {
      setAdding(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e._id !== id));
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete event.");
    }
  };

  // Populate form for editing
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
    setSelectedEvent(null); // Close modal
    // Optionally scroll to form
    setTimeout(() => {
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
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

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 md:gap-8 w-full">
      <div
        className={`${getBannerThemeClasses()} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}
      >
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <CalendarDays className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            Events Calendar
          </h1>
          <p className="text-orange-100 mt-2 text-base md:text-lg font-medium max-w-xl">
            Manage college events, seminars, and activities with ease.
          </p>
        </div>
      </div>

      {/* Calendar Section */}
      <div
        className={`p-4 w-full shadow-md rounded-xl border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-inherit">
            College Event Schedule
          </h2>
        </div>
        <div>
          {loading ? (
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
                eventPropGetter={(event) => {
                  const backgroundColor =
                    categoryColors[event.category] || categoryColors.Other;
                  return {
                    style: {
                      backgroundColor,
                      borderRadius: "5px",
                      color: "white",
                      border: "1px solid rgba(0,0,0,0.2)",
                      opacity: 0.9,
                      display: "block",
                    },
                  };
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Event Details Modal */}
      <div className="absolute z-[9999]">
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          currentUser={user}
          onDelete={handleDeleteEvent}
          onEdit={handleEditClick}
        />
      </div>

      {/* Add Event Form */}
      {user && (
        <div className="w-full">
          <div
            className={`flex flex-col shadow-md p-4 md:p-6 rounded-xl border gap-6 ${getCardThemeClasses(appTheme)}`}
          >
            <div className="flex w-full border text-center justify-center border-inherit/50 rounded-lg items-center gap-2 p-3 font-bold bg-black/5 dark:bg-white/5">
              {isEditingId ? (
                <Edit className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {isEditingId ? "Edit Event" : "Add New Event"}
            </div>
            <input
              type="text"
              placeholder="Event Title *"
              value={newEvent.title}
              onChange={(e) =>
                setNewEvent({ ...newEvent, title: e.target.value })
              }
              className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-transparent text-inherit"
            />
            <textarea
              placeholder="Description"
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
              rows="3"
              className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-transparent text-inherit"
            />
            <div>
              <label className="block text-sm font-medium mb-1 opacity-90">
                Visibility
              </label>
              <div
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  newEvent.isPrivate
                    ? "bg-black/5 border-inherit/50"
                    : "bg-black/10 border-current"
                }`}
                onClick={() =>
                  setNewEvent({ ...newEvent, isPrivate: !newEvent.isPrivate })
                }
              >
                <div className="flex items-center gap-2">
                  {newEvent.isPrivate ? (
                    <Lock className="w-4 h-4 text-gray-600" />
                  ) : (
                    <Globe className="w-4 h-4 text-blue-600" />
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
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
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
                  className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-transparent text-inherit"
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
                  className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-transparent text-inherit"
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
                  className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
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
                  className="w-full border border-inherit/50 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-transparent text-inherit"
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
                          src={mPath?.startsWith("http") ? mPath : `/${mPath}`}
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

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start gap-2 shadow-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <p className="font-medium text-sm">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              {isEditingId && (
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 bg-black/10 dark:bg-white/10 text-inherit font-bold rounded-lg justify-center items-center hover:bg-black/20 dark:hover:bg-white/20 p-3 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveEvent}
                disabled={
                  adding || !newEvent.title || !newEvent.start || !newEvent.end
                }
                className={`flex-1 flex rounded-lg font-bold shadow-sm justify-center items-center p-3 transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
              >
                {adding ? (
                  <>
                    <div
                      className="loader mr-2"
                      style={{ "--s": "10px", "--g": "2px" }}
                    ></div>
                    {isEditingId ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  <>
                    {isEditingId ? (
                      <Save className="w-4 h-4 mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    {isEditingId ? "Update Event" : "Add Event"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsCalendar;
