import React, { useEffect, useState } from "react";
import { getAllEvents, deleteEvent } from "@/services/eventService";
import { getTeacherOverview, getAllQuizStats } from "@/services/statsService";
import { getAllSubjects } from "@/services/subjectService";
import { API_URL } from "../config/constants";
import {
  getRoleProfile,
  isFacultyRole,
  isNonStudentRole,
} from "@/utils/roleUtils";
import { getAllQuizzes, updateQuiz } from "@/services/quizService";
import {
  getAssignmentsBySubject,
  gradeSubmission,
  deleteAssignment,
} from "@/services/assignmentService";
import { getAllContent, getContentByUser, deleteContent } from "@/services/contentService";
import { useSelector } from "react-redux";
import {
  CalendarDays,
  XCircle,
  CheckCircle,
  Pen,
  Plus,
  BookOpen,
  Download,
  Bell,
  X,
  AlertCircle,
  FileText,
  Eye,
  FileQuestion,
  Clock,
  MapPin,
  Trash2,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import AssignmentCard from "@/components/ui/AssignmentCard";
import PostCard from "@/components/ui/PostCard";
import SubmissionItem from "@/components/ui/SubmissionItem";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useSocket } from "@/context/SocketContext";
import { useTheme } from "@/context/ThemeContext";
import UniversalBadge from "@/components/ui/UniversalBadge";
import DocumentViewer from "@/components/ui/DocumentViewer";
import {
  getCardThemeClasses,
  getBannerThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";

const Activities = () => {
  const user = useSelector((state) => state.auth.user);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const { appTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState(user?.role === "Student" || isFacultyRole(user?.role) ? "quizzes" : "events");

  // Quiz states
  const [quizStats, setQuizStats] = useState([]);
  const [availableQuizzes, setAvailableQuizzes] = useState([]); // For students
  const [availableAssignments, setAvailableAssignments] = useState([]);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [managedAssignments, setManagedAssignments] = useState([]);
  const [managedMaterials, setManagedMaterials] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [gradingState, setGradingState] = useState({});
  const [closing, setClosing] = useState(null);
  const [dismissedNotifs, setDismissedNotifs] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(`dismissed_notifs_${user?._id}`)) || []
      );
    } catch {
      return [];
    }
  });

  // Activity states
  const [realEvents, setRealEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socketRefreshKey, setSocketRefreshKey] = useState(0);
  const [viewerFile, setViewerFile] = useState(null);

  // Messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =============================
  // Real-Time Socket Listeners
  // =============================
  useEffect(() => {
    if (!user || !socket) return;

    const handleRefresh = () => setSocketRefreshKey((k) => k + 1);

    socket.on("notification", handleRefresh);
    socket.on("new activity", handleRefresh);
    socket.on("remove activity", handleRefresh);

    return () => {
      socket.off("notification", handleRefresh);
      socket.off("new activity", handleRefresh);
      socket.off("remove activity", handleRefresh);
    };
  }, [user, socket]);

  // =============================
  // Load Quiz Stats (Teacher Overview)
  // =============================
  useEffect(() => {
    if (!token || !user?.role) return;

    const loadStats = async () => {
      try {
        if (user?.role === "Teacher") {
          const res = await getTeacherOverview();
          setQuizStats(res.quizStats || []);
        } else if (user?.role === "HOD" || user?.role === "Admin") {
          const res = await getAllQuizStats();
          setQuizStats(res.quizStats || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadStats();
  }, [token, user?.role, socketRefreshKey]);

  // =============================
  // Load Available Quizzes (Student)
  // =============================
  useEffect(() => {
    if (!user?._id || user?.role !== "Student") return;

    const fetchAvailableQuizzes = async () => {
      setLoading(true);
      setError("");
      try {
        const studentProfile = await getRoleProfile(user.role, user._id);

        const studentSubjects = studentProfile?.subjects;

        if (!studentSubjects || !Array.isArray(studentSubjects)) {
          setError(
            "Could not load your subjects. Your student profile may be incomplete.",
          );
          return;
        }

        // --- Fetch Quizzes ---
        const quizzesRes = await getAllQuizzes();
        const allQuizzes = Array.isArray(quizzesRes)
          ? quizzesRes
          : Array.isArray(quizzesRes?.quizzes)
            ? quizzesRes.quizzes
            : [];

        const studentDeptId = studentProfile.user?.department?._id;

        // Step 3: Filter quizzes
        const filteredQuizzes = allQuizzes
          .filter((quiz) => {
            // 1. Department Match: Ensure quiz is for the student's department
            const quizDeptId = quiz.department?._id || quiz.department;
            if (
              !studentDeptId ||
              !quizDeptId ||
              String(studentDeptId) !== String(quizDeptId)
            ) {
              return false;
            }

            // 2. Subject & Semester Match: Compare MongoDB Object IDs instead of arbitrary text names
            const subjectIds = studentSubjects.map((s) => String(s._id));
            const isRelevant = subjectIds.includes(String(quiz.subject?._id || quiz.subject));

            if (!isRelevant || !quiz.isActive) return false;

            const userAttempts =
              quiz.attempts?.filter(
                (a) => a.student?.toString() === user._id,
              ) || [];
            userAttempts.sort(
              (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
            );
            const lastAttempt = userAttempts[0];
            const quizVersionDate = quiz.questionsUpdatedAt || quiz.createdAt;
            const canAttempt =
              !lastAttempt ||
              new Date(lastAttempt.submittedAt) < new Date(quizVersionDate);

            return canAttempt;
          })
          .map((quiz) => {
            const userAttempts =
              quiz.attempts?.filter(
                (a) => a.student?.toString() === user._id,
              ) || [];
              
            // Convert raw ObjectId to human-readable Subject Name
            const matchedSubject = studentSubjects.find(s => String(s._id) === String(quiz.subject?._id || quiz.subject));
            const subjectName = matchedSubject ? matchedSubject.name : "Unknown Subject";

            return { ...quiz, isRetake: userAttempts.length > 0, subjectName };
          });

        setAvailableQuizzes(filteredQuizzes);

        // --- Fetch Assignments ---
        if (studentSubjects.length > 0) {
          const assignmentPromises = studentSubjects.map((sub) =>
            getAssignmentsBySubject(sub._id).catch(() => []),
          );
          const assignmentsRes = await Promise.all(assignmentPromises);

          let allStudentAssignments = [];
          assignmentsRes.forEach((res, index) => {
            const arr = Array.isArray(res) ? res : (res?.assignments || res?.data || []);
            const subjectInfo = studentSubjects[index];
            const enrichedAssignments = arr.map((a) => ({
              ...a,
              subjectName:
                subjectInfo.name || subjectInfo.subject || "Unknown Subject",
            }));
            allStudentAssignments = [
              ...allStudentAssignments,
              ...enrichedAssignments,
            ];
          });

          // Filter to show assignments that are not submitted (keep past due visible)
          const pendingAssignments = allStudentAssignments.filter((a) => {
            const hasSubmitted = a.submissions?.some(
              (sub) =>
                String(sub.student?._id || sub.student) === String(user._id),
            );
            return !hasSubmitted;
          });
          setAvailableAssignments(pendingAssignments);

          // --- Fetch Materials ---
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError(
            "Your student profile could not be found. Please contact support.",
          );
        } else {
          setError(
            "Could not load quizzes for your subjects. Please try again later.",
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?._id) {
      fetchAvailableQuizzes();
    }
  }, [user?._id, user?.role, token, socketRefreshKey]);

  // =============================
  // Load Managed Content (Teacher/HOD/Admin)
  // =============================
  useEffect(() => {
    if (!user?._id || user.role === "Student") return;

    const fetchManagedContent = async () => {
      setLoadingAssignments(true);
      try {
        let subjects = [];
        if (user.role === "Admin") {
          const res = await getAllSubjects();
          subjects = Array.isArray(res)
            ? res
            : Array.isArray(res?.subjects)
              ? res.subjects
              : [];
        } else {
          const profileData = await getRoleProfile(user.role, user._id);
          subjects = profileData?.subjects || [];
        }

        if (subjects.length > 0) {
          const assignmentPromises = subjects.map((sub) =>
            getAssignmentsBySubject(sub._id).catch(() => []),
          );
          const materialPromises = subjects.map((sub) =>
            getAllContent({ subjectId: sub._id, limit: 50 }).catch(() => []),
          );

          const [assignmentResults, materialResults] = await Promise.all([
            Promise.all(assignmentPromises),
            Promise.all(materialPromises),
          ]);

          let allAssign = [];
          assignmentResults.forEach((r, index) => {
            const arr = Array.isArray(r) ? r : (r?.assignments || r?.data || []);
            const subjectInfo = subjects[index];
            const enrichedAssignments = arr.map((a) => ({
              ...a,
              subjectName:
                subjectInfo.name || subjectInfo.subject || "Unknown Subject",
            }));
            allAssign = [...allAssign, ...enrichedAssignments];
          });

          const uniqueAssign = Array.from(
            new Map(allAssign.map((a) => [a._id, a])).values(),
          );
          uniqueAssign.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          );
          setManagedAssignments(uniqueAssign);

          // Fetch user's own materials via Post Content
          const postsRes = await getContentByUser(user._id).catch(() => []);
          const rawPosts = Array.isArray(postsRes?.content) ? postsRes.content : Array.isArray(postsRes) ? postsRes : [];
          const uniqueMaterials = rawPosts
            .filter((p) => p.material?.description && p.material.description.startsWith("[LECTURE]") && !p.isDeleted)
            .map((p) => {
              const contentParts = p.material.description.split("\n\n");
              const metaString = contentParts[0].replace("[LECTURE]", "");
              const description = contentParts.slice(1).join("\n\n");
              const parts = metaString.split("|");
              let title = parts[0] || "Untitled";
              let subjectLabel = parts[1] || "General";
              return {
                ...p,
                title,
                subjectLabel,
                description,
                likes: p.reactions?.length || 0,
                views: parseInt(parts[2]) || 0,
                mediaUrl: p.material?.media?.length > 0 ? (() => {
                  const mPath = typeof p.material.media[0] === "string" ? p.material.media[0] : p.material.media[0].path;
                  return mPath?.startsWith("http") ? mPath : `/${mPath}`;
                })() : null,
                mediaType: p.material?.media?.length > 0 ? (() => {
                  const mMime = typeof p.material.media[0] === "string" ? "" : p.material.media[0].mimetype || "";
                  return mMime.startsWith("video") || mMime === "youtube" ? "video" : "image";
                })() : null,
              };
            });
          setManagedMaterials(uniqueMaterials);
        }
      } catch (err) {
        console.error("Failed to load managed content", err);
      } finally {
        setLoadingAssignments(false);
      }
    };

    fetchManagedContent();
  }, [user?._id, user?.role, token, socketRefreshKey]);

  // =============================
  // Grade Submission
  // =============================
  const handleGradeSubmit = async (assignmentId, studentId) => {
    const gradeData = gradingState[`${assignmentId}-${studentId}`];
    if (!gradeData) return;

    try {
      const updatedAssignment = await gradeSubmission(assignmentId, studentId, {
        grade: gradeData.grade,
        feedback: gradeData.feedback,
      });

      setManagedAssignments((prev) =>
        prev.map((a) => (a._id === assignmentId ? updatedAssignment : a)),
      );
      setGradingState((prev) => ({
        ...prev,
        [`${assignmentId}-${studentId}`]: { ...gradeData, editing: false },
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to save grade.");
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // =============================
  // Delete Content
  // =============================
  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;
    try {
      await deleteAssignment(id);
      setManagedAssignments((prev) => prev.filter((a) => a._id !== id));
      setSuccess("Assignment deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to delete assignment.");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Are you sure you want to delete this material?")) return;
    try {
      await deleteContent(id);
      setManagedMaterials((prev) => prev.filter((m) => m._id !== id));
      setSuccess("Material deleted successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to delete material.");
      setTimeout(() => setError(""), 3000);
    }
  };

  // =============================
  // Download Material Logic
  // =============================
  const handleDownloadFile = async (fileUrl, title) => {
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Preparing download... ⏳" }),
      );
      const ext = fileUrl.split(".").pop().split("?")[0] || "pdf";
      const filename = `${title.replace(/\s+/g, "_")}.${ext}`;

      const isCrossOrigin =
        new URL(fileUrl, window.location.href).origin !==
        window.location.origin;

      if (isCrossOrigin) {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Downloaded successfully! 📥" }),
      );
    } catch (error) {
      console.error("Download failed, falling back to open:", error);
      window.open(fileUrl, "_blank");
    }
  };

  // =============================
  // Fetch Activities
  // =============================

  useEffect(() => {
    if (!user?._id) return;
    const fetchActivities = async () => {
      setLoading(true);
      setError("");
      try {
        
        // Fetch both global events and personal system notifications concurrently
        const [eventsData, notifsRes] = await Promise.all([
          getAllEvents().catch(() => []),
          fetch(`${API_URL}/notifications`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }).then((res) => (res.ok ? res.json() : [])).catch(() => [])
        ]);

        const revEvents = Array.isArray(eventsData) ? eventsData.reverse() : [];
        const realEvts = revEvents.filter((e) => e.category !== "Notification");

        // Map Event-based global broadcast notifications
        const eventNotifs = revEvents
          .filter((e) => e.category === "Notification")
          .map((e) => ({
            _id: e._id,
            title: e.title || "Announcement",
            description: e.description,
            start: e.start || e.createdAt,
            isPublic: true,
          }));

        // Map personal System Notifications (e.g., Graded Assignments)
        const systemNotifsList = Array.isArray(notifsRes) ? notifsRes : notifsRes.notifications || notifsRes.data || [];
        const systemNotifs = systemNotifsList.map((n) => ({
          _id: n._id,
          title: n.type ? n.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "System Alert",
          description: n.message,
          start: n.createdAt,
          isPublic: false,
          isSystem: true,
        }));

        // ✅ Read current dismissed array directly from localStorage to prevent dependency loops
        const currentDismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user._id}`)) || [];

        // Merge and sort all notifications chronologically
        const allNotifs = [...eventNotifs, ...systemNotifs]
          .filter((n) => !currentDismissed.includes(n._id))
          .sort((a, b) => new Date(b.start) - new Date(a.start));

        // Filter for local display - showing unread counts correctly
        setNotifications(allNotifs);
        setRealEvents(realEvts);
      } catch (err) {
        console.error(err);
        setError("Failed to load activities.");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [user?._id, socketRefreshKey, token]); // ✅ Removed dismissedNotifs

  // =============================
  // Timer for Countdown
  // =============================
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDeleteNotification = async (id) => {
    if (!user?._id) return;
    try {
      const notif = notifications.find((n) => n._id === id);
      const updated = [...dismissedNotifs, id];
      setDismissedNotifs(updated);
      localStorage.setItem(
        `dismissed_notifs_${user._id}`,
        JSON.stringify(updated),
      );
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      
      if (notif?.isSystem) {
        fetch(`${API_URL}/notifications/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }).then(() => {
           // Notify Sidebar to update count
           window.dispatchEvent(new Event("messagesRead"));
        }).catch(() => console.log("System notification dismissed locally."));
      } else {
        // Even for public notifications, notify sidebar to re-fetch and respect dismissed list
        window.dispatchEvent(new Event("messagesRead"));
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  // =============================
  // Toggle Quiz Status (Close / Reopen)
  // =============================
  const handleToggleQuizStatus = async (quizIdToToggle, currentStatus) => {
    const newStatus = !currentStatus;
    const actionText = newStatus ? "reopen" : "close";

    if (!window.confirm(`Are you sure you want to ${actionText} this quiz?`))
      return;

    setClosing(quizIdToToggle);
    setError("");
    setSuccess("");

    try {
      await updateQuiz(quizIdToToggle, { isActive: newStatus });

      setQuizStats((prev) =>
        prev.map((q) =>
          q.quizId === quizIdToToggle ? { ...q, isActive: newStatus } : q,
        ),
      );

      setSuccess(`Quiz ${actionText}d successfully!`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Failed to ${actionText} quiz. Please try again.`,
      );
    } finally {
      setClosing(null);
    }
  };

  // =============================
  // Navigate to Edit Quiz
  // =============================
  const editQuiz = (quizId) => navigate(`/teacher/quiz-editor?id=${quizId}`);

  // =============================
  // Navigate to Attempt Quiz
  // =============================
  const attemptQuiz = (quizId) => navigate(`/quiz/attempt/${quizId}`); // Note: This route needs to be created in App.jsx

  // =============================
  // Quiz Status Badge
  // =============================
  const getQuizStatusBadge = (isActive) =>
    isActive ? (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30 shadow-sm">
        Active
      </span>
    ) : (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-black/10 dark:bg-white/10 text-inherit opacity-80 border border-inherit/30 shadow-sm">
        Closed
      </span>
    );

  // =============================
  // Activity Status
  // =============================
  const getStatus = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (today >= start && today <= end) return "Ongoing";
    return start > today ? "Upcoming" : "Completed";
  };

  // Handle hash scrolling
  useEffect(() => {
    if (!loading && !loadingAssignments && location.hash) {
      setTimeout(() => {
        const id = location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [loading, loadingAssignments, location.hash]);

  // =============================
  // Mark Notifications as Read on Page Load or Tab View
  // =============================
  useEffect(() => {
    if (token && notifications.length > 0) {
      const markAsRead = async () => {
        try {
          await fetch(`${API_URL}/notifications/read-all`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` }
          });
          // Dispatch event to sidebar to refresh its count
          window.dispatchEvent(new Event("messagesRead"));
        } catch (err) {
          console.error("Failed to mark notifications as read", err);
        }
      };
      // If we are on the activities page and there are notifications, consider them "seen"
      markAsRead();
    }
  }, [token, notifications.length]); // Mark read when they load

  // =============================
  // UI
  // =============================
  return (

    <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Header */}
      <div
        className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-purple-600 to-indigo-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}
      >
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <CalendarDays className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            Activities & Quiz Management
          </h1>
          <p className="opacity-80 mt-2 text-base md:text-lg font-medium max-w-xl text-inherit">
            View and manage college activities and quiz status.
          </p>
        </div>
      </div>

      {viewerFile && (
        <div className="absolute z-[9999]">
          <DocumentViewer
            url={viewerFile.url}
            title={viewerFile.title || "Document"}
            media={viewerFile}
            currentUser={user}
            onClose={() => setViewerFile(null)}
            canEdit={false}
          />
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-2 shadow-sm font-medium">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-current mt-0.5" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Smart Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-inherit/20 mt-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {(isFacultyRole(user?.role) || user?.role === "Student") && (
          <>
            <button onClick={() => setActiveTab('quizzes')} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'quizzes' ? 'bg-black/5 dark:bg-white/5 border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 text-inherit'}`}>
              <FileQuestion className="w-4 h-4" /> Quizzes
            </button>
            <button onClick={() => setActiveTab('assignments')} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'assignments' ? 'bg-black/5 dark:bg-white/5 border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 text-inherit'}`}>
              <BookOpen className="w-4 h-4" /> Assignments
            </button>
            <button onClick={() => setActiveTab('materials')} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'materials' ? 'bg-black/5 dark:bg-white/5 border-b-2 border-orange-500 text-orange-600 dark:text-orange-400' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 text-inherit'}`}>
              <FileText className="w-4 h-4" /> Materials
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('events')} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'events' ? 'bg-black/5 dark:bg-white/5 border-b-2 border-teal-500 text-teal-600 dark:text-teal-400' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 text-inherit'}`}>
          <CalendarDays className="w-4 h-4" /> Events
        </button>
        <button onClick={() => setActiveTab('notifications')} className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === 'notifications' ? 'bg-black/5 dark:bg-white/5 border-b-2 border-red-500 text-red-600 dark:text-red-400' : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 text-inherit'}`}>
          <Bell className="w-4 h-4" /> Notifications
          {notifications.filter(n => !n.isRead && !n.isPublic).length > 0 && (
            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] ml-1">
              {notifications.filter(n => !n.isRead && !n.isPublic).length}
            </span>
          )}
        </button>
      </div>

      <div className="animate-in fade-in duration-500">
      {/* ================= QUIZ MANAGEMENT ================= */}
        {/* ================= QUIZ MANAGEMENT ================= */}
        {activeTab === 'quizzes' && isFacultyRole(user?.role) && (
          <div
            id="quizzes"
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
              <button
                onClick={() => navigate("/teacher/quiz-editor")}
                className={`w-full sm:w-auto rounded-xl px-6 py-3 font-bold transition-all active:scale-95 shadow-sm flex items-center justify-center gap-3 ${getPrimaryButtonClasses(appTheme)}`}
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold text-lg">Create New Quiz</span>
              </button>
            </div>

            <div>
              {quizStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                  {quizStats.map((q) => (
                    <div
                      key={q.quizId}
                      className="flex flex-col p-5 rounded-2xl border border-inherit/30 shadow-sm hover:shadow-md transition-all bg-black/5 dark:bg-white/5 group"
                    >
                      <div className="flex justify-between items-start mb-4 gap-3">
                        <h3 className="font-bold text-lg leading-tight text-inherit group-hover:text-blue-500 transition-colors line-clamp-2">
                          {q.title}
                        </h3>
                        <UniversalBadge text={q.isActive ? "Active" : "Closed"} className="shrink-0" />
                      </div>

                      <div className="mt-auto pt-4 border-t border-inherit/20 flex flex-wrap items-center justify-between gap-3">
                        {isNonStudentRole(user?.role) && (
                          <div className="flex w-full gap-2 rounded-lg justify-between items-center shrink-0">
                            <div
                              className="flex-1 justify-center rounded-lg flex items-center p-2 border border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors font-bold text-sm shadow-sm"
                              onClick={() => editQuiz(q.quizId)}
                            >
                              <Pen className="w-4 h-4 mr-1" />
                              Edit
                            </div>
                            <div
                              className={`flex-1 justify-center border flex items-center p-2 rounded-lg cursor-pointer transition-colors font-bold text-sm shadow-sm ${
                                q.isActive
                                  ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                                  : "border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white"
                              }`}
                              onClick={() =>
                                handleToggleQuizStatus(q.quizId, q.isActive)
                              }
                            >
                              {closing === q.quizId ? (
                                <div
                                  className="loader mr-2"
                                  style={{ "--s": "10px", "--g": "2px" }}
                                ></div>
                              ) : q.isActive ? (
                                <XCircle className="w-4 h-4 mr-1" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
                              )}
                              {q.isActive ? "Close Quiz" : "Reopen Quiz"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileQuestion}
                  description="You have not created any quizzes yet."
                  className="my-4"
                />
              )}
            </div>
          </div>
        )}

        {/* ================= AVAILABLE QUIZZES (STUDENT) ================= */}
        {activeTab === 'quizzes' && user?.role === "Student" && (
          <div
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
              <FileQuestion className="text-green-600 w-5 h-5" /> Available
              Quizzes
            </h2>
            <div>
              {availableQuizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                  {availableQuizzes.map((quiz) => {
                    const now = currentTime;
                    const start = new Date(quiz.startDate);
                    const diffMs = start - now;

                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((diffMs / 1000 / 60) % 60);
                    const seconds = Math.floor((diffMs / 1000) % 60);
                    return (
                      <div
                        key={quiz._id}
                        className="flex flex-col p-5 rounded-2xl shadow-sm border border-inherit/30 bg-black/5 dark:bg-white/5 hover:shadow-md transition-all group"
                      >
                        <div className="mb-4 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 bg-black/10 dark:bg-white/10 px-2.5 py-1 rounded-md border border-inherit/20 text-inherit">{quiz.subjectName}</span>
                          <h3 className="font-bold text-lg mt-3 leading-tight text-inherit group-hover:text-blue-500 transition-colors line-clamp-2">
                            {quiz.title}
                          </h3>
                        </div>

                        <div className="mt-auto pt-4 border-t border-inherit/20">
                          <button
                            onClick={() => attemptQuiz(quiz._id)}
                            disabled={diffMs > 0}
                            className={`w-full rounded-xl py-3 font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
                          >
                            {diffMs > 0 ? (
                              <span className="flex items-center justify-center gap-2"><Clock className="w-4 h-4"/> {days}d {hours}h {minutes}m {seconds}s</span>
                            ) : quiz.isRetake ? (
                              "Retake (Updated)"
                            ) : (
                              "Start Attempt"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={FileQuestion}
                  description="No available quizzes for your subjects right now."
                  className="my-4"
                />
              )}
            </div>
          </div>
        )}

        {/* ================= AVAILABLE ASSIGNMENTS (STUDENT) ================= */}
        {activeTab === 'assignments' && user?.role === "Student" && (
          <div
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
              <BookOpen className="text-purple-600" /> Pending Assignments
            </h2>
            <div>
              {availableAssignments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                  {availableAssignments.map((assignment) => {
                    const now = currentTime;
                    const due = new Date(assignment.dueDate);
                    const diffMs = due - now;

                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((diffMs / 1000 / 60) % 60);

                    return (
                      <AssignmentCard
                        key={assignment._id}
                        title={assignment.title}
                        subjectName={assignment.subjectName}
                        description={assignment.material?.description}
                        media={assignment.material?.media}
                        onDownloadFile={handleDownloadFile}
                        dueDate={assignment.dueDate}
                        actionButton={
                          <button
                            onClick={() =>
                              navigate(`/subjects/${assignment.subject}`)
                            }
                            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap ${diffMs < 0 ? "bg-red-500 hover:bg-red-600 text-white border-transparent" : getPrimaryButtonClasses(appTheme)}`}
                          >
                            {diffMs > 0
                              ? `Due in ${days}d ${hours}h`
                              : "Late - Submit Now"}
                          </button>
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle}
                  title="All Caught Up!"
                  description="You have no pending assignments! 🎉"
                  className="my-4"
                />
              )}
            </div>
          </div>
        )}

        {/* ================= AVAILABLE MATERIALS (STUDENT) ================= */}
        {activeTab === 'materials' && user?.role === "Student" && (
          <div
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
              <FileText className="text-orange-500 w-5 h-5" /> Recent Study
              Materials
            </h2>
            <div>
              {availableMaterials.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                  {availableMaterials.map((m) => (
                    <MaterialCard
                      key={m._id}
                      material={m}
                      subjectName={m.subjectName}
                      onView={(url, title) => {
                        const matchedMedia = m.media?.find((mediaItem) => {
                          const mPath =
                            typeof mediaItem === "string"
                              ? mediaItem
                              : mediaItem?.path;
                          return (
                            (mPath?.startsWith("http") ? mPath : `/${mPath}`) ===
                            url
                          );
                        });
                        setViewerFile({
                          url,
                          title,
                          isDownloadable: matchedMedia?.isDownloadable ?? true,
                          authorId: m.author?._id || m.author,
                        });
                      }}
                      onDownload={handleDownloadFile}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  description="Your teachers haven't uploaded any materials yet."
                  className="my-4"
                />
              )}
            </div>
          </div>
        )}

        {/* ================= ASSIGNMENT MANAGEMENT (TEACHER/HOD/ADMIN) ================= */}
        {activeTab === 'assignments' && (user?.role === "Teacher" || user?.role === "HOD" || user?.role === "Admin") && (
          <div
            id="assignments"
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
              <button
                onClick={() => navigate("/dashboard/curriculum")}
                className={`w-full sm:w-auto rounded-xl px-6 py-3 font-bold transition-all active:scale-95 shadow-sm flex items-center justify-center gap-3 ${getPrimaryButtonClasses(appTheme)}`}
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold text-lg">Create New Assignment</span>
              </button>
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-inherit">
                <BookOpen className="text-purple-600" /> Managed Assignments
              </h2>
            </div>

            {loadingAssignments ? (
              <LoadingSkeleton count={2} />
            ) : managedAssignments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                {managedAssignments.map((a) => (
                  <AssignmentCard
                    key={a._id}
                    title={a.title}
                    subjectName={a.subjectName}
                    description={a.material?.description}
                    media={a.material?.media}
                    onDownloadFile={handleDownloadFile}
                    dueDate={a.dueDate}
                    actionButton={
                      <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-inherit/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/subjects/${a.subject}`);
                            window.dispatchEvent(new CustomEvent("showToast", { detail: "Please use the Subject page to edit assignments. 📘" }));
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 p-2 rounded-lg transition-colors"
                          title="Edit Assignment"
                        >
                          <Pen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAssignment(a._id);
                          }}
                          className="text-red-600 dark:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                          title="Delete Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    }
                  >
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                      Submissions{" "}
                      <span className="text-purple-600 dark:text-purple-400">
                        ({a.submissions?.length || 0})
                      </span>
                    </h4>
                    {a.submissions?.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {a.submissions.map((sub, idx) => (
                          <SubmissionItem
                            key={idx}
                            submission={sub}
                            studentName={sub.student?.name || "Unknown Student"}
                            studentAvatar={sub.student?.profilePicture}
                            gradingState={
                              gradingState[
                                `${a._id}-${sub.student?._id || sub.student}`
                              ]
                            }
                            onEditGrade={() =>
                              setGradingState((prev) => ({
                                ...prev,
                                [`${a._id}-${sub.student?._id || sub.student}`]: {
                                  grade: sub.grade || "",
                                  feedback: sub.feedback || "",
                                  editing: true,
                                },
                              }))
                            }
                            onSaveGrade={() =>
                              handleGradeSubmit(
                                a._id,
                                sub.student?._id || sub.student,
                              )
                            }
                            onGradeChange={(val) =>
                              setGradingState((prev) => ({
                                ...prev,
                                [`${a._id}-${sub.student?._id || sub.student}`]: {
                                  ...prev[
                                    `${a._id}-${sub.student?._id || sub.student}`
                                  ],
                                  grade: val,
                                },
                              }))
                            }
                            onFeedbackChange={(val) =>
                              setGradingState((prev) => ({
                                ...prev,
                                [`${a._id}-${sub.student?._id || sub.student}`]: {
                                  ...prev[
                                    `${a._id}-${sub.student?._id || sub.student}`
                                  ],
                                  feedback: val,
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm opacity-70 text-inherit italic">
                        No students have submitted yet.
                      </p>
                    )}
                  </AssignmentCard>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                description="No assignments have been created yet."
                className="my-4"
              />
            )}
          </div>
        )}

        {/* ================= MATERIAL MANAGEMENT (TEACHER/HOD/ADMIN) ================= */}
        {activeTab === 'materials' && (user?.role === "Teacher" || user?.role === "HOD" || user?.role === "Admin") && (
          <div
            id="materials"
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
              <button
                onClick={() => navigate("/dashboard/curriculum")}
                className={`w-full sm:w-auto rounded-xl px-6 py-3 font-bold transition-all active:scale-95 shadow-sm flex items-center justify-center gap-3 ${getPrimaryButtonClasses(appTheme)}`}
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold text-lg">Upload New Material</span>
              </button>
            </div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-inherit">
                <FileText className="text-orange-500" /> Managed Materials
              </h2>
            </div>

            {loadingAssignments ? (
              <LoadingSkeleton count={2} />
            ) : managedMaterials.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
                {managedMaterials.map((m) => (
                <PostCard
                    key={m._id}
                  post={m}
                  currentUser={user}
                    onDelete={handleDeleteMaterial}
                  setFullscreenMedia={setViewerFile}
                  hideHeader={true}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                description="No materials have been uploaded yet."
                className="my-4"
              />
            )}
          </div>
        )}

        {/* ================= NOTIFICATIONS ================= */}
        {activeTab === 'notifications' && (
          <section
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h2 className="text-xl font-bold mb-4 text-inherit flex items-center gap-2">
              <Bell className="text-blue-500 w-6 h-6" /> Your Notifications
            </h2>
            {notifications.length > 0 ? (
              <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
                {notifications.map((notif) => (
                  <div
                    key={notif._id}
                    className="p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-inherit/30 rounded-xl text-sm flex justify-between items-start gap-4 transition-colors group relative"
                  >
                    <div>
                      <span className="font-bold text-inherit block mb-1">
                        {notif.title}
                      </span>
                      <span className="opacity-80">{notif.description}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs font-semibold text-blue-400 shrink-0 mt-1">
                        {new Date(notif.start).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDeleteNotification(notif._id)}
                        className="text-inherit opacity-50 hover:opacity-100 hover:text-red-500 md:opacity-100 md:group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Bell}
                title="All caught up!"
                description="You have no new notifications."
                className="my-4"
              />
            )}
          </section>
        )}

        {/* ================= ACTIVITIES ================= */}
        {activeTab === 'events' && (
          <section
            className={`p-6 rounded-2xl shadow-sm border w-full transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
              <button
                onClick={() => navigate("/notice-board")}
                className={`w-full sm:w-auto rounded-xl px-6 py-3 font-bold transition-all active:scale-95 shadow-sm flex items-center justify-center gap-3 ${getPrimaryButtonClasses(appTheme)}`}
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold text-lg">Schedule New Event</span>
              </button>
            </div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit"><CalendarDays className="w-5 h-5 text-teal-500" /> All Events</h2>

            {loading ? (
              <LoadingSkeleton count={2} />
            ) : realEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                description="No activities found."
                className="my-4"
              />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[75vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2 p-1">
          {realEvents.map((activity) => {
            const isAuthor = activity.author === user?._id || activity.author?._id === user?._id;
            const isAdmin = user?.role === 'Admin';
            const canManage = isAuthor || isAdmin;

            return (
              <div
                key={activity._id}
                className="flex flex-col h-full shadow-sm p-5 rounded-2xl hover:shadow-md transition-shadow bg-black/5 dark:bg-white/5 border border-inherit/30 group"
              >
                <div className="flex-auto">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <UniversalBadge text={activity.category} className="shrink-0" />
                    <UniversalBadge text={getStatus(activity.start, activity.end)} className="shrink-0 ml-auto" />
                  </div>
                  <h3 className="font-bold text-lg leading-tight text-inherit group-hover:text-teal-500 transition-colors mb-1">{activity.title}</h3>
                  <p className="text-xs opacity-70 mb-3 flex items-center gap-1.5 text-inherit">
                    <Clock className="w-3.5 h-3.5"/> {new Date(activity.start).toLocaleDateString()} - {new Date(activity.end).toLocaleDateString()}
                  </p>

                  <p className="opacity-90 mb-4 text-sm line-clamp-3 text-inherit">
                    {activity.description}
                  </p>
                </div>
                {activity.location && (
                   <div className={`mt-auto pt-3 border-t border-inherit/20 text-xs font-semibold opacity-80 flex items-center gap-1.5 text-inherit ${canManage ? 'mb-3' : ''}`}>
                     <MapPin className="w-3.5 h-3.5"/> {activity.location}
                   </div>
                )}
                {canManage && (
                  <div className="mt-auto pt-3 border-t border-inherit/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex w-full gap-2 rounded-lg justify-between items-center shrink-0">
                      <div
                        className="flex-1 justify-center rounded-lg flex items-center p-2 border border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors font-bold text-sm shadow-sm"
                        onClick={() => {
                          navigate("/notice-board");
                          window.dispatchEvent(new CustomEvent("showToast", { detail: "Please use the Notice Board calendar to edit events. 📅" }));
                        }}
                      >
                        <Pen className="w-4 h-4 mr-1" />
                        Edit
                      </div>
                      <div
                        className="flex-1 justify-center border flex items-center p-2 rounded-lg cursor-pointer transition-colors font-bold text-sm shadow-sm border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                        onClick={async () => {
                          if (!window.confirm("Are you sure you want to delete this event?")) return;
                          try {
                            await deleteEvent(activity._id);
                            setRealEvents((prev) => prev.filter((e) => e._id !== activity._id));
                            setSuccess("Event deleted successfully!");
                            setTimeout(() => setSuccess(""), 3000);
                          } catch (err) {
                            console.error(err);
                            setError("Failed to delete event.");
                            setTimeout(() => setError(""), 3000);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Activities;
