import React, { useEffect, useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  BookOpen,
  FileText,
  Plus,
  Upload,
  Download,
  XCircle,
  Users,
  ArrowLeft,
  Trash2,
  Edit,
  Save,
  X,
  CheckCircle,
  Eye,
  Link as LinkIcon,
  Share,
  AlertCircle,
  ClipboardList,
  Edit2,
} from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";
import MaterialsSection from "../components/MaterialsSection";
import AssignmentsSection from "../components/AssignmentsSection";
import ClassroomSection from "../components/ClassroomSection";
import SubjectHub from "../components/SubjectHub";
import AddSubjectForm from "../components/AddSubjectForm";
import UserCard from "@/components/ui/UserCard";
import { useTheme } from "@/context/ThemeContext";
import AssignmentCard from "@/components/ui/AssignmentCard";
import SubmissionItem from "@/components/ui/SubmissionItem";
import UploadProgress from "@/components/ui/UploadProgress";
import EmptyState from "@/components/ui/EmptyState";
import PostComposer from "@/components/ui/PostComposer";
import ErrorAlert from "../components/ui/ErrorAlert";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  getDepartments,
  getDepartmentSemesters,
  getAllUsers,
} from "@/services/userService";

import {
  getSubjectById,
  updateSubject,
  createSubject,
  getAllSubjects,
} from "@/services/subjectService";
import { getRoleProfile } from "@/utils/roleUtils";
import {
  getMaterialsBySubject,
  uploadMaterial,
  deleteMaterial,
} from "@/services/materialService";
import {
  getAssignmentsBySubject,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
} from "@/services/assignmentService";
import DocumentViewer from "@/components/ui/DocumentViewer";
import PostCard from "@/components/ui/PostCard";
import {
  getAllContent,
  createContent,
  updateContentWithMedia,
  deleteContent,
  toggleLike,
  addComment,
} from "@/services/contentService";
import { useDispatch } from "react-redux";
import { updateUser } from "@/redux/authSlice";
import { updateUserProfile } from "@/services/userService";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
  getOptionClasses,
} from "@/utils/themeUtils";
import ShareModal from "@/components/ui/ShareModal";

export const SubjectPage = ({
  subjectId: propSubjectId,
  embedded = false,
  targetUser: embeddedTargetUser,
}) => {
  const authUser = useSelector((state) => state.auth.user);
  const user = embeddedTargetUser || authUser;
  const { subjectId: paramSubjectId } = useParams();
  const navigate = useNavigate();
  const { appTheme, isDark } = useTheme();

  const activeSubjectId = propSubjectId || paramSubjectId;

  // Hub States
  const [hubSubjects, setHubSubjects] = useState([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubDept, setHubDept] = useState("");
  const [hubSem, setHubSem] = useState("");
  const [deptSemesters, setDeptSemesters] = useState(0);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [hubRefreshKey, setHubRefreshKey] = useState(0);

  const [subject, setSubject] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [enrolledUsers, setEnrolledUsers] = useState([]);

  // Form states
  const [uploadData, setUploadData] = useState({
    title: "",
    views: 0,
    englishAttachmentUrl: "",
    hindiAttachmentUrl: "",
    mediaUrl: "",
    isDownloadable: true,
  });
  const [composerText, setComposerText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditingId, setIsEditingId] = useState(null);

  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  const [newAssignmentFiles, setNewAssignmentFiles] = useState([]);
  const [editAssignmentFiles, setEditAssignmentFiles] = useState([]);
  const [submittingAssignment, setSubmittingAssignment] = useState(null);
  const [resubmittingAssignment, setResubmittingAssignment] = useState(null);
  const [submissionInputs, setSubmissionInputs] = useState({});
  const [gradingState, setGradingState] = useState({});

  const submissionInputsRef = useRef(submissionInputs);
  useEffect(() => {
    submissionInputsRef.current = submissionInputs;
  }, [submissionInputs]);

  useEffect(() => {
    return () => {
      Object.values(submissionInputsRef.current).forEach((input) => {
        input.files?.forEach((f) => {
          if (f.previewUrl?.startsWith("blob:"))
            URL.revokeObjectURL(f.previewUrl);
        });
      });
    };
  }, []);

  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [editAssignmentData, setEditAssignmentData] = useState({
    title: "",
    description: "",
    dueDate: "",
  });

  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editSubData, setEditSubData] = useState({
    name: "",
    semester: "",
    code: "",
    assignedTeachers: [],
  });
  const [deptTeachers, setDeptTeachers] = useState([]);
  const [savingSubject, setSavingSubject] = useState(false);

  // UI states
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);

  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubData, setNewSubData] = useState({
    name: "",
    code: "",
    semester: "",
    assignedTeachers: [],
  });
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);


  // ================= HUB FETCHING LOGIC =================
  useEffect(() => {
    if (activeSubjectId) return;
    const controller = new AbortController();
    if (user.role === "Admin" || user.role === "HOD") {
      getDepartments()
        .then((res) => {
          if (controller.signal.aborted) return;
          const data = res;
          const depts = data?.departments || (Array.isArray(data) ? data : []);
          setDepartmentsList(depts);
          setHubDept((prev) => {
            if (user.role === "Admin" && depts.length > 0 && !prev) {
              setHubSem("all");
              return depts[0];
            }
            return prev;
          });
        })
        .catch((err) => console.error("Failed to load departments:", err));

      if (user.role === "HOD") {
        setHubSem("own");
        if (user.department?.name) {
          setHubDept(user.department.name);
        } else {
          getRoleProfile(user.role, user._id)
            .then((res) => {
              const data = res;
              if (data?.user?.department?.name) {
                setHubDept(data.user.department.name);
              }
            })
            .catch((err) => console.error("Failed to load HOD profile:", err));
        }
      }
    } else {
      setHubLoading(true);
      getRoleProfile(user.role, user._id)
        .then((res) => {
          const data = res;
          setHubSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
        })
        .catch((err) => console.error(err))
        .finally(() => setHubLoading(false));
    }
  }, [activeSubjectId, user, hubRefreshKey]);

  useEffect(() => {
    if (activeSubjectId) return;
    if ((user.role === "Admin" || user.role === "HOD") && hubDept) {
      getDepartmentSemesters(hubDept)
        .then((res) => {
          const data = res;
          setDeptSemesters(data?.Semesters || 8);
        })
        .catch(() => setDeptSemesters(8));
    } else {
      setDeptSemesters(0);
      if (user.role !== "HOD") setHubSem("all");
    }
  }, [hubDept, user, activeSubjectId]);

  useEffect(() => {
    if (activeSubjectId) return;
    if (user.role === "Admin" || user.role === "HOD") {
      if (hubSem === "own") {
        setHubLoading(true);
        getRoleProfile(user.role, user._id)
          .then((res) => {
            const data = res;
            setHubSubjects(Array.isArray(data?.subjects) ? data.subjects : []);
          })
          .catch((err) => console.error(err))
          .finally(() => setHubLoading(false));
      } else if (hubDept && hubSem) {
        setHubLoading(true);
        getAllSubjects()
          .then((res) => {
            const subjectsList = Array.isArray(res)
              ? res
              : Array.isArray(res?.subjects)
                ? res.subjects
                : [];
            const filtered = (Array.isArray(subjectsList) ? subjectsList : []).filter(
              (s) =>
                (s.department?.name === hubDept || s.department === hubDept) &&
                (hubSem === "all" || s.semester === Number(hubSem)),
            );
            setHubSubjects(filtered);
          })
          .finally(() => setHubLoading(false));
      } else {
        setHubSubjects([]);
      }
    }
  }, [hubDept, hubSem, user, activeSubjectId, hubRefreshKey]);

  // Fetch subject details and related data
  const fetchSubjectData = useCallback(async (signal) => {
    if (!activeSubjectId) return;
    setLoading(true);
    setError("");
    try {
      const subjectRes = await getSubjectById(activeSubjectId).catch(
        () => null,
      );

      if (!subjectRes) {
        setError("Subject not found or you do not have permission to view it.");
        setSubject(null);
        return;
      }

      let fetchedSubject = subjectRes;

      // Robust fallback: If backend returns an array of subjects instead of a single object, extract the correct one
      if (Array.isArray(fetchedSubject)) {
        fetchedSubject = fetchedSubject.find(
          (s) => String(s._id) === String(activeSubjectId),
        );
      } else if (fetchedSubject && Array.isArray(fetchedSubject.subjects)) {
        fetchedSubject = fetchedSubject.subjects.find(
          (s) => String(s._id) === String(activeSubjectId),
        );
      } else if (fetchedSubject && fetchedSubject.subject && typeof fetchedSubject.subject === 'object') {
        fetchedSubject = fetchedSubject.subject;
      }

      if (!fetchedSubject) {
        setError("Subject not found or you do not have permission to view it.");
        setSubject(null);
        return;
      }

      const deptQuery =
        fetchedSubject.department?.name ||
        fetchedSubject.department?._id ||
        fetchedSubject.department;

      const [materialsRes, assignmentsRes, usersRes] = await Promise.all([
        getAllContent({ subjectId: activeSubjectId, limit: 100 }).catch(() => []),
        getAssignmentsBySubject(activeSubjectId).catch(() => []),
        getAllUsers({ status: "Approved", department: deptQuery, limit: 1000 }).catch(
          () => [],
        ),
      ]);

      if (signal?.aborted) return;

      const getList = (response, key) => {
        if (Array.isArray(response)) return response;
        if (!response || typeof response !== "object") return [];
        if (key && Array.isArray(response[key])) return response[key];
        if (Array.isArray(response.data)) return response.data;
        if (Array.isArray(response.users)) return response.users;
        if (Array.isArray(response.materials)) return response.materials;
        if (Array.isArray(response.assignments)) return response.assignments;
        if (Array.isArray(response.subjects)) return response.subjects;
        return [];
      };

      const rawPosts = Array.isArray(materialsRes?.content) ? materialsRes.content : Array.isArray(materialsRes) ? materialsRes : [];
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
          let isDownloadable = true;

          if (parts.length >= 6) {
            title = parts[0];
            subjectLabel = parts[1];
            views = parseInt(parts[2]) || 0;
            englishAttachmentUrl = parts[3] !== "none" ? parts[3] : "";
            hindiAttachmentUrl = parts[4] !== "none" ? parts[4] : "";
            isDownloadable = parts[5] === "true";
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

      const fetchedAssignments = getList(assignmentsRes, 'assignments');
      const fetchedUsers = getList(usersRes);
      // Normalize assignedTeacher to always be an array of full teacher objects
      if (fetchedSubject) {
        let teachers = fetchedSubject.assignedTeacher;
        if (!Array.isArray(teachers)) {
          teachers = teachers ? [teachers] : [];
        }
        fetchedSubject.assignedTeacher = teachers
          .map((t) => {
            if (typeof t === "string") {
              return (
                fetchedUsers.find((u) => String(u._id) === String(t)) || {
                  _id: t,
                  name: "Unknown",
                }
              );
            }
            return t || { _id: null, name: "Unknown" };
          })
          .filter(Boolean);
      }

      setSubject(fetchedSubject || null);
      setMaterials(parsedLectures);
      setAssignments(Array.isArray(fetchedAssignments) ? fetchedAssignments : []);
      setEnrolledUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
      setSelectedMaterials([]);
      setSelectedAssignments([]);
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Error fetching subject data:", err);
      setError("Failed to load subject data. Please try refreshing the page.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [activeSubjectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSubjectData(controller.signal);
    return () => controller.abort();
  }, [fetchSubjectData]);

  // Edit Subject (HOD/Admin Reassignment)
  const openEditSubject = async () => {
    const assignedIds = Array.isArray(subject?.assignedTeacher)
      ? subject.assignedTeacher
        .map((t) => (typeof t === "object" && t !== null ? t._id : t))
        .filter(Boolean)
      : [];

    setEditSubData({
      name: subject?.name || (typeof subject?.subject === 'string' ? subject.subject : "") || "",
      semester: subject?.semester || "",
      code: subject?.code || "",
      assignedTeachers: assignedIds,
    });
    setIsEditingSubject(true);
    try {
      const subjDeptId = subject.department?._id || subject.department;
      const res = await getAllUsers({
        status: "Approved",
        department: subjDeptId || hubDept,
        role: ["Teacher", "HOD", "Admin"].join(","),
      });
      const usersArray = Array.isArray(res)
        ? res
        : Array.isArray(res?.users)
          ? res.users
          : [];
      let filtered = [...usersArray];

      // Ensure the currently assigned teachers are always in the dropdown options
      if (Array.isArray(subject.assignedTeacher)) {
        subject.assignedTeacher.forEach((t) => {
          if (
            typeof t === "object" &&
            t !== null &&
            !filtered.some((f) => String(f._id) === String(t._id))
          ) {
            filtered.push(t);
          }
        });
      }

      // Ensure current user is in the list if they are Teacher or HOD
      if (
        ["Teacher", "HOD", "Admin"].includes(user.role) &&
        !filtered.some((f) => String(f._id) === String(user._id))
      ) {
        filtered.unshift(user);
      }

      setDeptTeachers(filtered);
    } catch (e) {
      console.error("Failed to load teachers for reassignment", e);
    }
  };

  const saveSubjectEdit = async () => {
    setSavingSubject(true);
    try {
      const payload = {
        name: editSubData.name,
        semester: editSubData.semester,
        code: editSubData.code,
        assignedTeacher: editSubData.assignedTeachers,
      };
      const res = await updateSubject(activeSubjectId, payload);
      const updated = res;
      setSubject(updated);
      setIsEditingSubject(false);
      fetchSubjectData();
      setHubRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Subject updated successfully! ✏️" }));
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update subject.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setSavingSubject(false);
    }
  };

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

      const subjectName = postToShare.subjectLabel || "a subject";
      const payload = {
        content: `**Forwarded from ${subjectName}**\n\n${displayContent}`,
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

  const handlePublishMaterial = async () => {
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
        await updateContentWithMedia(isEditingId, contentStr, attachments, (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }, extraPayload);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Updated successfully! 🚀" }));
      } else {
        console.log("content str", contentStr, attachments, extraPayload);

        await createContent(contentStr, attachments, (progressEvent) => {
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }, extraPayload);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Published successfully! 🚀" }));
      }
      setIsEditingId(null);
      setUploadData({ title: "", views: 0, englishAttachmentUrl: "", hindiAttachmentUrl: "", mediaUrl: "", isDownloadable: true });
      setComposerText("");
      setAttachments([]);
      fetchSubjectData();
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to publish. ❌" }));
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  // Add assignment (teacher only)
  const handleAddAssignment = async () => {
    if (!newAssignment.title || !newAssignment.dueDate) {
      setError("Assignment title and due date are required.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await createAssignment(
        activeSubjectId,
        newAssignment,
        newAssignmentFiles,
      );
      const newAssign = res;
      setAssignments([newAssign, ...assignments]);
      setNewAssignment({ title: "", description: "", dueDate: "" });
      setNewAssignmentFiles([]);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignment created successfully! 📝" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to add assignment.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setAdding(false);
    }
  };

  const handleLike = async (lectureId) => {
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
    try { await toggleLike(lectureId, "👍"); } catch (err) { fetchSubjectData(); }
  };

  const handleBookmark = async (lectureId) => {
    const savedLectures = user?.savedLectures || [];
    const newSavedLectures = savedLectures.includes(lectureId) ? savedLectures.filter((id) => id !== lectureId) : [...savedLectures, lectureId];
    dispatch(updateUser({ ...user, savedLectures: newSavedLectures }));
    try { await updateUserProfile(user._id, { savedLectures: newSavedLectures }); } catch (err) { dispatch(updateUser({ ...user, savedLectures })); }
  };

  const handleComment = async (lectureId, text) => {
    if (!text.trim()) return;
    try {
      const res = await addComment(lectureId, text);
      setMaterials((prev) => prev.map((l) => (l._id === lectureId ? { ...l, comments: res.comments } : l)));
    } catch (err) { console.error(err); }
  };

  // Delete Material (Teacher/HOD/Admin)
  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Are you sure you want to delete this material?"))
      return;
    try {
      await deleteContent(id);
      setMaterials((prev) => prev.filter((m) => m._id !== id));
      setSelectedMaterials((prev) => prev.filter((mId) => mId !== id));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Material deleted 🗑️" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to delete material.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
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
      const results = await Promise.allSettled(selectedMaterials.map((id) => deleteContent(id)));
      const deletedIds = selectedMaterials.filter((_, i) => results[i].status === "fulfilled");
      const failedCount = results.filter((r) => r.status === "rejected").length;

      setMaterials((prev) =>
        prev.filter((m) => !deletedIds.includes(m._id)),
      );
      setSelectedMaterials((prev) => prev.filter((id) => !deletedIds.includes(id)));

      if (failedCount > 0) {
        const msg = `${failedCount} material(s) could not be deleted.`;
        setError(msg);
        window.dispatchEvent(new CustomEvent("showToast", { detail: `${failedCount} deletion(s) failed ❌` }));
      } else {
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Materials deleted 🗑️" }));
      }
    } catch (err) {
      console.error(err);
      const msg = "Failed to process bulk delete.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
      fetchSubjectData(); // Refresh to ensure sync
    }
  };

  const toggleMaterialSelect = (id) => {
    setSelectedMaterials((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id],
    );
  };

  // Delete Assignment (Teacher/HOD/Admin)
  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this assignment?"))
      return;
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a._id !== id));
      setSelectedAssignments((prev) => prev.filter((aId) => aId !== id));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignment deleted 🗑️" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to delete assignment.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const handleBulkDeleteAssignments = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedAssignments.length} assignments?`,
      )
    )
      return;
    try {
      const results = await Promise.allSettled(selectedAssignments.map((id) => deleteAssignment(id)));
      const deletedIds = selectedAssignments.filter((_, i) => results[i].status === "fulfilled");
      const failedCount = results.filter((r) => r.status === "rejected").length;

      setAssignments((prev) =>
        prev.filter((a) => !deletedIds.includes(a._id)),
      );
      setSelectedAssignments((prev) => prev.filter((id) => !deletedIds.includes(id)));

      if (failedCount > 0) {
        const msg = `${failedCount} assignment(s) could not be deleted.`;
        setError(msg);
        window.dispatchEvent(new CustomEvent("showToast", { detail: `${failedCount} deletion(s) failed ❌` }));
      } else {
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignments deleted 🗑️" }));
      }
    } catch (err) {
      console.error(err);
      const msg = "Failed to process bulk delete.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
      fetchSubjectData(); // Refresh to ensure sync
    }
  };

  const toggleAssignmentSelect = (id) => {
    setSelectedAssignments((prev) =>
      prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id],
    );
  };

  // Start editing assignment
  const handleEditAssignmentStart = (assignment) => {
    setEditingAssignmentId(assignment._id);
    const d = assignment.dueDate ? new Date(assignment.dueDate) : null;
    const formattedDate = d ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
    setEditAssignmentData({
      title: assignment.title,
      description: assignment.material?.description || "",
      dueDate: formattedDate,
    });
    setEditAssignmentFiles(
      assignment.material?.media
        ? assignment.material.media.map((m) => {
          const mPath = typeof m === "string" ? m : m.path;
          return {
            _id: typeof m === "string" ? m : m._id,
            name: m.title || "Attached File",
            url: mPath?.startsWith("http") ? mPath : `/${mPath}`,
            mimetype: m.mimetype,
            isRetained: true,
          };
        })
        : [],
    );
  };

  // Save edited assignment
  const handleUpdateAssignment = async (id) => {
    if (!editAssignmentData.title || !editAssignmentData.dueDate)
      return setError("Assignment title and due date are required.");
    try {
      const retainedIds = editAssignmentFiles
        .filter((f) => f.isRetained)
        .map((f) => f._id);
      const newFiles = editAssignmentFiles
        .filter((f) => !f.isRetained)
        .map((f) => f.file);
      const res = await updateAssignment(
        id,
        editAssignmentData,
        newFiles,
        retainedIds,
      );
      const updated = res;
      setAssignments((prev) => prev.map((a) => (a._id === id ? updated : a)));
      setEditingAssignmentId(null);
      setEditAssignmentData({ title: "", description: "", dueDate: "" });
      setEditAssignmentFiles([]);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignment updated! ✏️" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to update assignment.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // Submit assignment (student only)
  const handleSubmitAssignment = async (assignmentId) => {
    const inputData = submissionInputs[assignmentId];
    if (
      !inputData?.text &&
      (!inputData?.files || inputData.files.length === 0)
    ) {
      setError("Please provide an answer or attach at least one file.");
      return;
    }

    setSubmittingAssignment(assignmentId);
    setError("");

    try {
      const formData = new FormData();
      if (inputData.text) formData.append("textAnswer", inputData.text);

      const retainedIds = inputData.files?.filter(f => f.isRetained).map(f => f._id) || [];
      if (retainedIds.length === 0) {
        formData.append("retainedMediaIds", "[]");
      } else {
        retainedIds.forEach(id => formData.append("retainedMediaIds", id));
      }

      if (inputData.files && inputData.files.length > 0) {
        inputData.files.filter(f => !f.isRetained).forEach((file) => {
          // Extract the actual File object from the attachment wrapper used by PostComposer
          formData.append("files", file.file || file);
          formData.append(
            "mediaTitles",
            file.title || file.file?.name || "Submission File",
          );
          formData.append("mediaDescriptions", file.description || " ");
          formData.append("mediaDownloadable", file.isDownloadable ?? false);
        });
      }

      const res = await submitAssignment(assignmentId, formData);

      // Update local assignment state with the updated assignment returned from backend
      const updated = res;
      setAssignments((prev) =>
        prev.map((a) => (a._id === assignmentId ? updated : a)),
      );
      setSubmissionInputs((prev) => ({
        ...prev,
        [assignmentId]: { text: "", files: [] },
      }));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignment submitted! ✅" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to submit assignment.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setSubmittingAssignment(null);
      setResubmittingAssignment(null);
    }
  };

  // Grade submission (Teacher/HOD/Admin)
  const handleGradeSubmit = async (assignmentId, studentId) => {
    if (!studentId) {
      window.dispatchEvent(new CustomEvent("showToast", {
        detail: "Cannot grade: student not found in enrolled users. ❌",
      }));
      return;
    }
    const gradeData = gradingState[`${assignmentId}-${studentId}`];
    if (!gradeData) return;

    try {
      const res = await gradeSubmission(assignmentId, studentId, {
        grade: gradeData.grade,
        feedback: gradeData.feedback,
      });

      const updated = res;
      setAssignments((prev) =>
        prev.map((a) => (a._id === assignmentId ? updated : a)),
      );
      setGradingState((prev) => ({
        ...prev,
        [`${assignmentId}-${studentId}`]: { ...gradeData, editing: false },
      }));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Grade saved! 🎓" }));
    } catch (err) {
      console.error(err);
      const msg = "Failed to save grade.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // Force download file instead of just viewing it
  const handleDownloadFile = async (fileUrl, title) => {
    const isCrossOrigin =
      new URL(fileUrl, window.location.href).origin !== window.location.origin;
    let objectUrl = null;

    try {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Preparing download... ⏳" }),
      );
      const ext = fileUrl.split(".").pop().split("?")[0] || "pdf";
      const filename = `${title.replace(/\s+/g, "_")}.${ext}`;

      if (isCrossOrigin) {
        const res = await fetch(fileUrl);
        const blob = await res.blob();
        objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.setAttribute("download", filename);
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.setAttribute("download", filename);
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Downloaded successfully! 📥" }),
      );
    } catch (error) {
      console.error("Download failed, falling back to open:", error);
      window.open(fileUrl, "_blank");
    } finally {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl); // always revoke
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubData.name || !newSubData.semester) return;
    setCreatingSubject(true);
    try {
      const assignedTeacher = newSubData.assignedTeachers;
      const autoCode = `${newSubData.name.replace(/\s/g, "").toUpperCase().slice(0, 4)}${newSubData.semester}`;
      const code = newSubData.code || `${autoCode}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      await createSubject({
        name: newSubData.name,
        code: code,
        department: hubDept,
        semester: Number(newSubData.semester),
        assignedTeacher,
      });
      setIsAddingSubject(false);
      setNewSubData({
        name: "",
        code: "",
        semester: "",
        assignedTeachers: [],
      });
      setHubRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Subject created successfully! 📘" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to create subject.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setCreatingSubject(false);
    }
  };

  const toggleAddSubject = async () => {
    setIsAddingSubject(!isAddingSubject);
    if (!isAddingSubject && hubDept) {
      try {
        const res = await getAllUsers({ status: "Approved" });
        const usersArray = Array.isArray(res)
          ? res
          : Array.isArray(res?.users)
            ? res.users
            : [];
        const filtered = usersArray.filter(
          (t) =>
            t.role === "Admin" ||
            ((t.role === "Teacher" || t.role === "HOD") &&
              t.department?.name === hubDept),
        );

        // Explicitly inject the current user if they match the role and aren't already in the list
        if (
          ["Teacher", "HOD", "Admin"].includes(user.role) &&
          !filtered.some((t) => String(t._id) === String(user._id))
        ) {
          filtered.unshift(user);
        }

        setDeptTeachers(filtered);
      } catch (e) {
        console.error("Failed to load teachers", e);
      }
    }
  };

  // ================= RENDER HUB MODE =================
  if (!activeSubjectId) {
    return (
      <div className={`w-full ${embedded ? "" : "max-w-5xl mx-auto m-5"}`}>
        <div
          className={`p-6 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-inherit">
            <BookOpen className="text-current opacity-80" />
            {user.role === "Admin" || user.role === "HOD"
              ? "Subject Management Hub"
              : "My Subjects"}
          </h2>
          {(user.role === "Admin" || user.role === "HOD") && (
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap gap-4">
                {user.role === "Admin" ? (
                  <select
                    value={hubDept}
                    onChange={(e) => {
                      setHubDept(e.target.value);
                      setHubSem("all");
                    }}
                    className="p-2 border border-inherit/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-current min-w-[200px] bg-black/5 dark:bg-white/5 text-inherit"
                  >
                    <option
                      value=""
                      disabled
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      Select Department
                    </option>
                    {departmentsList.map((d, idx) => (
                      <option
                        key={d || idx}
                        value={d}
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit font-semibold min-w-[200px] flex items-center shadow-inner">
                    {hubDept || "Loading Department..."}
                  </div>
                )}
                <select
                  value={hubSem}
                  onChange={(e) => setHubSem(e.target.value)}
                  disabled={!hubDept && user.role !== "HOD"}
                  className="p-2 border border-inherit/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-current min-w-[150px] disabled:opacity-50 bg-black/5 dark:bg-white/5 text-inherit"
                >
                  <option
                    value=""
                    disabled
                    className={getOptionClasses(appTheme, isDark)}
                  >
                    Select Semester
                  </option>
                  <option
                    value="all"
                    className={getOptionClasses(appTheme, isDark)}
                  >
                    All
                  </option>
                  {user.role === "HOD" && (
                    <option
                      value="own"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      My Subjects
                    </option>
                  )}
                  {Array.from({ length: deptSemesters }, (_, i) => i + 1).map(
                    (sem) => (
                      <option
                        key={sem}
                        value={sem}
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Semester {sem}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {hubDept && (
                <button
                  onClick={toggleAddSubject}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                >
                  {isAddingSubject ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isAddingSubject ? "Cancel" : "Add Subject"}
                </button>
              )}
            </div>
          )}

          <ErrorAlert message={error} className="mb-6" />

          {isAddingSubject && hubDept && (
            <AddSubjectForm
              hubDept={hubDept}
              newSubData={newSubData}
              setNewSubData={setNewSubData}
              deptSemesters={deptSemesters}
              deptTeachers={deptTeachers}
              handleCreateSubject={handleCreateSubject}
              creatingSubject={creatingSubject}
            />
          )}
          {hubLoading ? (
            <LoadingSkeleton count={3} />
          ) : hubSubjects.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
              {hubSubjects.map((sub, idx) => (
                <div
                  key={sub._id || idx}
                  onClick={() => navigate(`/subjects/${sub._id}`)}
                  className={`cursor-pointer p-6 border border-inherit/30 rounded-2xl bg-black/5 dark:bg-white/5 hover:shadow-lg hover:-translate-y-1 transition-all group shadow-sm flex flex-col justify-center text-center relative overflow-hidden`}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-current opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <h3 className="font-bold text-inherit text-lg opacity-90 group-hover:opacity-100 transition-opacity">
                    {sub.name}
                  </h3>
                  <p className="text-sm opacity-70 mt-2 flex justify-center gap-1 flex-wrap">
                    <span className="font-semibold">Teacher:</span>{" "}
                    {Array.isArray(sub.assignedTeacher) &&
                      sub.assignedTeacher.length > 0
                      ? sub.assignedTeacher.map((t) => t?.name || (typeof t === "string" ? t : "Unknown")).join(", ")
                      : sub.assignedTeacher?.name || " Not Assigned"}
                  </p>
                  {sub.semester && (
                    <span className="mt-3 inline-block px-3 py-1 bg-black/10 dark:bg-white/10 text-inherit opacity-80 text-xs font-bold rounded-full border border-inherit/20">
                      Sem {sub.semester}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              description="No subjects found."
              className="my-4"
            />
          )}
        </div>
      </div>
    );
  }

  // ================= RENDER DETAILS MODE =================
  if (loading || (!subject && !error)) {
    return (
      <div className="max-w-5xl mx-auto m-5 p-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (error && !subject) {
    return (
      <div className="max-w-xl mx-auto p-8 mt-10 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm text-red-500">
        <h2 className="text-xl font-bold text-inherit mb-2">Access Error</h2>
        <p className="opacity-90 font-medium text-inherit">{error}</p>
      </div>
    );
  }

  // Check if the current user is officially assigned to teach this subject
  const isAssignedTeacher = subject?.assignedTeacher?.some(
    (t) => t && String(typeof t === "object" ? t._id : t) === String(user?._id),
  );
  const canManageContent =
    user?.role === "Admin" || user?.role === "HOD" || isAssignedTeacher;

  const studentGradedSubmissions = user?.role === "Student"
    ? assignments.reduce((acc, a) => {
      const mySub = a.mySubmission || a.submissions?.find(s => String(s.student?._id || s.student) === String(user._id));
      if (mySub && typeof mySub.grade === 'number') acc.push(mySub.grade);
      return acc;
    }, [])
    : [];
  const studentAvgGrade = studentGradedSubmissions.length > 0
    ? (studentGradedSubmissions.reduce((sum, g) => sum + g, 0) / studentGradedSubmissions.length).toFixed(1)
    : null;

  return (
    <div className="w-full h-full bg-transparent">
      <div className="min-h-full w-full">
        <div className={`flex flex-col ${embedded ? "" : "max-w-5xl mx-auto pt-6 pb-20 px-4 sm:px-6"} space-y-8`}>
      <ErrorAlert message={error} className="mb-6" />

      {viewerFile && (
        <div className="fixed inset-0 z-[9999]">
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

      <button
        onClick={() => navigate("/dashboard/curriculum")}
        className="flex items-center gap-2 opacity-70 hover:opacity-100 text-inherit transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </button>

      {/* Subject header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center  border-b pb-4 gap-4 border-gray-100 dark:border-gray-700">
        <div className="w-full">
          {isEditingSubject ? (
            <AddSubjectForm
              isEditMode={true}
              newSubData={{
                ...editSubData,
                originalTeachers: subject.assignedTeacher,
              }}
              deptSemesters={deptSemesters}
              setNewSubData={setEditSubData}
              deptTeachers={deptTeachers}
              handleCreateSubject={saveSubjectEdit}
              creatingSubject={savingSubject}
              onCancel={() => setIsEditingSubject(false)}
            />
          ) : (
            <>
              <h1 className="text-3xl font-bold flex items-center gap-2 text-inherit">
                <BookOpen className="opacity-80" />{" "}
                {subject.name || (typeof subject.subject === 'string' ? subject.subject : null) || "Unnamed Subject"}
                {subject.code && (
                  <span className="opacity-60 text-inherit text-2xl font-normal ml-2">
                    ({subject.code})
                  </span>
                )}
              </h1>
              <p className="opacity-80 text-inherit mt-2 flex gap-1 items-center flex-wrap">
                Instructor(s):{" "}
                {Array.isArray(subject.assignedTeacher) &&
                  subject.assignedTeacher.length > 0
                  ? subject.assignedTeacher.map((t, idx) => (
                    <span key={t?._id || t || idx}>
                      <Link
                        to={`/profile/${t?._id || t}`}
                        className="text-current opacity-90 hover:opacity-100 transition-colors hover:no-underline font-medium"
                      >
                        {t?.name || "Unknown Teacher"}
                      </Link>
                      {idx < subject.assignedTeacher.length - 1 && ", "}
                    </span>
                  ))
                  : "Not Assigned"}
              </p>
            </>
          )}
        </div>
        {!isEditingSubject &&
          (user.role === "Admin" || user.role === "HOD") && (
            <button
              onClick={openEditSubject}
              className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg flex items-center gap-2 transition-colors border border-inherit/30 shadow-sm shrink-0"
            >
              <Edit className="w-4 h-4" />{" "}
              <span className="font-medium">Edit & Reassign</span>
            </button>
          )}
      </div>

      {/* Materials section */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-inherit">
            <FileText className="text-current opacity-80" /> Materials
          </h2>
          {canManageContent && selectedMaterials.length > 0 && (
            <button
              onClick={handleBulkDeleteMaterials}
              className="flex items-center gap-2 text-sm bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition-colors font-bold"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected (
              {selectedMaterials.length})
            </button>
          )}
        </div>

        {canManageContent && (
          <div
            className={`p-4 mb-4 shadow-sm border rounded-xl transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h3 className="font-semibold mb-2 text-inherit">
              Upload New Material
            </h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title / Topic Name *"
                value={uploadData.title}
                onChange={(e) =>
                  setUploadData({ ...uploadData, title: e.target.value })
                }
                className="w-full border border-inherit/30 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
              />

              {/* External Links Section */}
              <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/10 flex flex-col gap-4 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5" /> External Links (Optional)
                </h4>

                <div>
                  <label htmlFor="upload-media" className="block text-sm font-bold text-inherit opacity-90 mb-1">
                    Main Video / Document Link
                  </label>
                  <input
                    id="upload-media"
                    type="url"
                    value={uploadData.mediaUrl}
                    onChange={(e) => setUploadData({ ...uploadData, mediaUrl: e.target.value })}
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
                      onChange={(e) => setUploadData({ ...uploadData, englishAttachmentUrl: e.target.value })}
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
                      onChange={(e) => setUploadData({ ...uploadData, hindiAttachmentUrl: e.target.value })}
                      placeholder="e.g. Drive link for Hindi notes"
                      className="w-full border border-inherit/30 bg-white dark:bg-black/20 text-inherit p-2.5 rounded-lg focus:ring-2 focus:ring-current outline-none transition-colors shadow-inner"
                    />
                  </div>
                </div>
              </div>

              <PostComposer
                value={composerText}
                onChange={setComposerText}
                onSend={handlePublishMaterial}
                isSending={isPublishing}
                placeholder="Add description or paste link..."
                user={user}
                attachments={attachments}
                onAddFiles={(incoming) => {
                  let atts = incoming;
                  if (incoming.target) {
                    atts = Array.from(incoming.target.files).map((f) => ({
                      file: f, previewUrl: URL.createObjectURL(f), type: f.type.startsWith("video") ? "video" : f.type.startsWith("image") ? "image" : "document", title: f.name, description: "", isDownloadable: uploadData.isDownloadable
                    }));
                    incoming.target.value = null;
                  }
                  setAttachments((prev) => [...prev, ...atts]);
                }}
                onRemoveFile={(idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                isDownloadable={uploadData.isDownloadable}
                onIsDownloadableChange={(e) => { const chk = e.target.checked; setUploadData({ ...uploadData, isDownloadable: chk }); setAttachments(prev => prev.map(a => ({ ...a, isDownloadable: chk }))); }}
                setFullscreenMedia={setViewerFile}
                hideInternalPreview={false}
              />
              {uploadProgress > 0 && uploadProgress < 100 && <UploadProgress progress={uploadProgress} fileName="Uploading..." />}
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={handlePublishMaterial}
                disabled={isPublishing}
                className={`flex items-center px-4 py-2 font-bold rounded-lg disabled:opacity-50 transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
              >
                {isPublishing ? (
                  <>
                    <div
                      className="loader mr-2"
                      style={{ "--s": "10px", "--g": "2px" }}
                    ></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
          {materials.length === 0 ? (
            <EmptyState
              icon={FileText}
              description="No materials uploaded yet."
              className="my-4"
            />
          ) : (
            <div className="columns-1 md:columns-2 gap-4 w-full">
              {materials.map((m, idx) => (
                <PostCard
                  key={m._id || idx}
                  post={m}
                  currentUser={user}
                  onLike={handleLike}
                  onBookmark={handleBookmark}
                  onDelete={canManageContent ? handleDeleteMaterial : undefined}
                  onComment={handleComment}
                  onShare={handleShareClick}
                  setFullscreenMedia={setViewerFile}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Assignments section */}
      <section>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-inherit">
              <Plus className="text-current opacity-80" /> Assignments
            </h2>
            {studentAvgGrade !== null && (
              <span className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">
                Avg Grade: {studentAvgGrade}%
              </span>
            )}
          </div>
          {canManageContent && selectedAssignments.length > 0 && (
            <button
              onClick={handleBulkDeleteAssignments}
              className="flex items-center gap-2 text-sm bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition-colors font-bold"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected (
              {selectedAssignments.length})
            </button>
          )}
        </div>

        {canManageContent && (
          <div
            className={`p-4 mb-4 shadow-sm border rounded-xl transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <h3 className="font-semibold mb-2 text-inherit">
              Add New Assignment
            </h3>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Assignment Title"
                value={newAssignment.title}
                onChange={(e) =>
                  setNewAssignment({ ...newAssignment, title: e.target.value })
                }
                className="w-full border border-inherit/30 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
              />
              <textarea
                placeholder="Description"
                value={newAssignment.description}
                onChange={(e) =>
                  setNewAssignment({
                    ...newAssignment,
                    description: e.target.value,
                  })
                }
                rows="3"
                className="w-full border border-inherit/30 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit resize-none"
              />
              <input
                type="datetime-local"
                value={newAssignment.dueDate}
                onChange={(e) =>
                  setNewAssignment({
                    ...newAssignment,
                    dueDate: e.target.value,
                  })
                }
                className="w-full md:w-1/2 border border-inherit/30 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
              />
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setNewAssignmentFiles(Array.from(e.target.files));
                  }
                }}
                className="w-full text-sm opacity-80 text-inherit file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-600 dark:file:text-purple-400 hover:file:bg-purple-500/30 file:transition-colors file:cursor-pointer mt-2"
              />
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={handleAddAssignment}
                disabled={adding}
                className={`flex items-center px-4 py-2 font-bold rounded-lg disabled:opacity-50 transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
              >
                {adding ? (
                  <>
                    <div
                      className="loader mr-2"
                      style={{ "--s": "10px", "--g": "2px" }}
                    ></div>{" "}
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Create
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
          {assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              description="No assignments yet."
              className="my-4"
            />
          ) : (
            assignments.map((a, idx) => {
              // console.log("Rendering assignment",a);
              const hasSubmitted = !!a.mySubmission || a.submissions?.some(
                (sub) =>
                  String(sub.student?._id || sub.student) === String(user._id),
              );
              const mySubmission = a.mySubmission || a.submissions?.find(
                (sub) =>
                  String(sub.student?._id || sub.student) === String(user._id),
              );

              return (
                <React.Fragment key={a._id || idx}>
                  {editingAssignmentId === a._id ? (
                    <div
                      className={`rounded-2xl shadow-sm border p-5 group relative overflow-hidden transition-colors ${getCardThemeClasses(appTheme)}`}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-current opacity-50"></div>
                      <div className="flex flex-col gap-3">
                        <input
                          type="text"
                          placeholder="Assignment Title"
                          value={editAssignmentData.title}
                          onChange={(e) =>
                            setEditAssignmentData({
                              ...editAssignmentData,
                              title: e.target.value,
                            })
                          }
                          className="w-full border border-inherit/30 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-current text-sm bg-black/5 dark:bg-white/5 text-inherit"
                        />
                        <textarea
                          placeholder="Description"
                          value={editAssignmentData.description}
                          onChange={(e) =>
                            setEditAssignmentData({
                              ...editAssignmentData,
                              description: e.target.value,
                            })
                          }
                          rows="2"
                          className="w-full border border-inherit/30 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-current text-sm bg-black/5 dark:bg-white/5 text-inherit resize-none"
                        />
                        <input
                          type="datetime-local"
                          value={editAssignmentData.dueDate}
                          onChange={(e) =>
                            setEditAssignmentData({
                              ...editAssignmentData,
                              dueDate: e.target.value,
                            })
                          }
                          className="w-full md:w-1/2 border border-inherit/30 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-current text-sm bg-black/5 dark:bg-white/5 text-inherit"
                        />
                        <div className="flex flex-col gap-2 mt-2">
                          <label className="text-xs font-semibold opacity-70">
                            Attachments
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {editAssignmentFiles.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-black/10 dark:bg-white/10 px-2 py-1 rounded border border-inherit/30"
                              >
                                <span className="text-xs max-w-[150px] truncate">
                                  {file.name || file.file?.name}
                                </span>
                                <button
                                  onClick={() =>
                                    setEditAssignmentFiles((prev) =>
                                      prev.filter((_, i) => i !== idx),
                                    )
                                  }
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => {
                              if (e.target.files) {
                                const incoming = Array.from(e.target.files).map(
                                  (f) => ({
                                    file: f,
                                    name: f.name,
                                    isRetained: false,
                                  }),
                                );
                                setEditAssignmentFiles((prev) => [
                                  ...prev,
                                  ...incoming,
                                ]);
                              }
                            }}
                            className="text-xs mt-1"
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingAssignmentId(null)}
                            className="px-3 py-1.5 text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg transition-colors border border-inherit/30"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateAssignment(a._id)}
                            className={`px-3 py-1.5 text-sm rounded-lg font-bold shadow-sm transition-colors ${getPrimaryButtonClasses(appTheme)}`}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <AssignmentCard
                      title={a.title}
                      description={a.material?.description}
                      dueDate={a.dueDate}
                      headerAction={
                        canManageContent ? (
                          <input
                            type="checkbox"
                            checked={selectedAssignments.includes(a._id)}
                            onChange={() => toggleAssignmentSelect(a._id)}
                            className="w-4 h-4 text-current rounded cursor-pointer border-inherit/30 focus:ring-current shadow-sm"
                          />
                        ) : null
                      }
                      actionButton={
                        canManageContent ? (
                          <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-inherit/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditAssignmentStart(a)}
                              className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 p-2 rounded-lg transition-colors"
                              title="Edit Assignment"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAssignment(a._id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                              title="Delete Assignment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null
                      }
                    >
                      {/* Teacher's Master Attachments */}
                      {a.material?.media && a.material.media.length > 0 && (
                        <div className="flex flex-col gap-2 mt-3 mb-4">
                          {a.material.media.map((m, i) => {
                            const mPath = typeof m === "string" ? m : m?.path;
                            const safePath = mPath ? mPath.replace(/\\/g, "/") : "";
                            const mUrl = mPath?.startsWith("http")
                              ? safePath
                              : `/${safePath}`;
                            return (
                              <button
                                key={i}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setViewerFile({
                                    url: mUrl,
                                    title: m?.title || a.title,
                                  });
                                }}
                                className="inline-flex w-fit items-center gap-1.5 text-sm font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-sm"
                              >
                                <Eye className="w-4 h-4" /> View Assignment
                                Document {a.material.media.length > 1 ? i + 1 : ""}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Student View */}
                      {user?.role === "Student" && (
                        <div>
                          {hasSubmitted && resubmittingAssignment !== a._id ? (
                            <div className="bg-green-500/10 text-green-700 dark:text-green-300 p-4 rounded-xl border border-green-500/30 shadow-sm flex flex-col gap-2">
                              <div className="flex items-center gap-2 font-bold mb-2">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                                Submitted on{" "}
                                {new Date(
                                  mySubmission.submittedAt,
                                ).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                              {mySubmission.textAnswer && (
                                <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/30 shadow-inner">
                                  <p className="text-sm text-inherit opacity-90 font-medium">
                                    {mySubmission.textAnswer}
                                  </p>
                                </div>
                              )}
                              {mySubmission.media &&
                                mySubmission.media.length > 0 && (
                                  <div className="flex flex-col gap-2">
                                    {mySubmission.media.map((m, i) => {
                                      const mPath = typeof m === "string" ? m : m?.path;
                                      const safePath = mPath ? mPath.replace(/\\/g, "/") : "";
                                      const mUrl = mPath?.startsWith("http")
                                        ? safePath
                                        : `/${safePath}`;
                                      return (
                                        <button
                                          key={i}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setViewerFile({
                                              url: mUrl,
                                              title: "Attachment",
                                            });
                                          }}
                                          className="inline-flex w-fit items-center gap-1.5 text-sm font-bold bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors shadow-sm"
                                        >
                                          <Eye className="w-4 h-4" /> View
                                          Attached File{" "}
                                          {mySubmission.media.length > 1
                                            ? i + 1
                                            : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              {mySubmission.grade !== null &&
                                mySubmission.grade !== undefined && (
                                  <div className="mt-3 border-t border-green-200/60 dark:border-green-700/60 pt-3">
                                    <span className="inline-block font-black text-green-700 dark:text-green-300 bg-green-500/10 px-3 py-1 rounded-lg shadow-sm text-sm border border-green-500/30">
                                      Graded: {mySubmission.grade} / 100
                                    </span>
                                    {mySubmission.feedback && (
                                      <p className="text-sm text-green-700 dark:text-green-300 mt-2 bg-green-500/10 p-2.5 rounded-lg border border-green-500/20 italic font-medium">
                                        Feedback: "{mySubmission.feedback}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              {(mySubmission.grade === null ||
                                mySubmission.grade === undefined) && (
                                  <button
                                    onClick={() => {
                                      setResubmittingAssignment(a._id);
                                      setSubmissionInputs((prev) => ({
                                        ...prev,
                                        [a._id]: {
                                          text: mySubmission.textAnswer || "",
                                          files: mySubmission.media
                                            ? mySubmission.media.map(m => ({
                                              _id: typeof m === "string" ? m : m._id,
                                              name: m.title || "Attached File",
                                              previewUrl: m.path?.startsWith("http") ? m.path : `/${m.path}`,
                                              isRetained: true,
                                            }))
                                            : [],
                                        },
                                      }));
                                    }}
                                    className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-bold bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-colors shadow-sm"
                                  >
                                    <Edit2 className="w-4 h-4" /> Resubmit
                                    Assignment
                                  </button>
                                )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/30 shadow-inner text-inherit">
                              <PostComposer
                                value={submissionInputs[a._id]?.text || ""}
                                onChange={(val) =>
                                  setSubmissionInputs((prev) => ({
                                    ...prev,
                                    [a._id]: {
                                      ...prev[a._id],
                                      text: val,
                                    },
                                  }))
                                }
                                onSend={() => handleSubmitAssignment(a._id)}
                                isSending={submittingAssignment === a._id}
                                placeholder="Type your answer here..."
                                user={user}
                                attachments={
                                  submissionInputs[a._id]?.files || []
                                }
                                onAddFiles={(e) => {
                                  let incoming = e;
                                  if (e.target) {
                                    incoming = Array.from(e.target.files).map(
                                      (f) => ({
                                        file: f,
                                        previewUrl: URL.createObjectURL(f),
                                        type: f.type.startsWith("video")
                                          ? "video"
                                          : f.type.startsWith("image")
                                            ? "image"
                                            : "document",
                                      }),
                                    );
                                    e.target.value = null;
                                  }
                                  setSubmissionInputs((prev) => ({
                                    ...prev,
                                    [a._id]: {
                                      ...prev[a._id],
                                      files: [
                                        ...(prev[a._id]?.files || []),
                                        ...incoming,
                                      ],
                                    },
                                  }));
                                }}
                                onRemoveFile={(idx) => {
                                  setSubmissionInputs((prev) => ({
                                    ...prev,
                                    [a._id]: {
                                      ...prev[a._id],
                                      files: prev[a._id]?.files?.filter(
                                        (file, i) => {
                                          if (
                                            i === idx &&
                                            file?.previewUrl &&
                                            file.previewUrl.startsWith("blob:")
                                          ) {
                                            URL.revokeObjectURL(
                                              file.previewUrl,
                                            );
                                          }
                                          return i !== idx;
                                        },
                                      ),
                                    },
                                  }));
                                }}
                                hideInternalPreview={false}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Teacher/HOD/Admin View */}
                      {(user?.role === "Teacher" ||
                        user?.role === "HOD" ||
                        user?.role === "Admin") && (
                          <div>
                            <h4 className="font-bold text-inherit mb-3 flex items-center gap-2">
                              <Users className="w-5 h-5 text-current opacity-80" />{" "}
                              Student Submissions (
                              <span className="text-inherit opacity-90 font-bold">
                                {a.submissions?.length || 0}
                              </span>
                              )
                            </h4>
                            {a.submissions?.length > 0 ? (
                              <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
                                {a.submissions.slice(0, 100).map((sub, sIdx) => {
                                  const studentObj =
                                    typeof sub.student === "object"
                                      ? sub.student
                                      : enrolledUsers.find(
                                        (u) =>
                                          String(u._id) === String(sub.student),
                                      );
                                  return (
                                    <SubmissionItem
                                      key={sIdx}
                                      submission={sub}
                                      studentName={
                                        studentObj?.name || "Unknown Student"
                                      }
                                      studentAvatar={studentObj?.profilePicture}
                                      onViewMedia={(url, title) =>
                                        setViewerFile({ url, title })
                                      }
                                      gradingState={
                                        gradingState[
                                        `${a._id}-${studentObj?._id}`
                                        ]
                                      }
                                      onEditGrade={() =>
                                        setGradingState((prev) => ({
                                          ...prev,
                                          [`${a._id}-${studentObj?._id}`]: {
                                            grade: sub.grade || "",
                                            feedback: sub.feedback || "",
                                            editing: true,
                                          },
                                        }))
                                      }
                                      onSaveGrade={() =>
                                        handleGradeSubmit(a._id, studentObj?._id)
                                      }
                                      onGradeChange={(val) =>
                                        setGradingState((prev) => ({
                                          ...prev,
                                          [`${a._id}-${studentObj?._id}`]: {
                                            ...prev[
                                            `${a._id}-${studentObj?._id}`
                                            ],
                                            grade: val,
                                          },
                                        }))
                                      }
                                      onFeedbackChange={(val) =>
                                        setGradingState((prev) => ({
                                          ...prev,
                                          [`${a._id}-${studentObj?._id}`]: {
                                            ...prev[
                                            `${a._id}-${studentObj?._id}`
                                            ],
                                            feedback: val,
                                          },
                                        }))
                                      }
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm opacity-70 text-inherit italic">
                                No submissions yet.
                              </p>
                            )}
                          </div>
                        )}
                    </AssignmentCard>
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      </section>

      {/* Classroom Section */}
      <section>
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-inherit">
          <Users className="text-current opacity-80" /> Classroom
        </h2>
        <div
          className={`p-6 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
        >
          <h3 className="font-semibold text-inherit border-b pb-2 mb-4 border-inherit/30">
            Assigned Teacher(s)
          </h3>
          <div className="flex flex-wrap gap-4 mb-6">
            {Array.isArray(subject.assignedTeacher) &&
              subject.assignedTeacher.length > 0 ? (
              <>
                {subject.assignedTeacher.filter(Boolean).slice(0, 50).map((t, idx) => (
                  <UserCard
                    key={t?._id || idx}
                    user={t}
                    subtitle="View Profile"
                    to={`/profile/${t?._id || t}`}
                    avatarSize="w-12 h-12 text-lg"
                    className="w-fit bg-black/5 dark:bg-white/5 border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10"
                  />
                ))}
                {subject.assignedTeacher.length > 50 && (
                  <div className="flex items-center justify-center p-4 text-sm font-bold opacity-70">
                    + {subject.assignedTeacher.length - 50} more teachers
                  </div>
                )}
              </>
            ) : (
              <p className="opacity-70 text-inherit text-sm mb-4">
                No teacher assigned to this subject yet.
              </p>
            )}
          </div>

          {(() => {
            const subjDeptId = subject?.department?._id || subject?.department;
            const students = enrolledUsers.filter((u) => {
              const uDeptId = u.department?._id || u.department;

              const explicitlyEnrolled = u.subjects?.some(
                (s) => String(s._id || s) === String(subject?._id)
              );
              const defaultEnrolled = u.semester === subject?.semester && String(uDeptId) === String(subjDeptId);

              return (
                u.role === "Student" && (explicitlyEnrolled || defaultEnrolled)
              );
            });

            return (
              <>
                <h3 className="font-semibold text-inherit border-b pb-2 mb-4 mt-6 border-inherit/30">
                  Enrolled Students ({students.length})
                </h3>
                {students.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
                      {students.slice(0, 100).map((student, idx) => (
                        <UserCard
                          key={student._id || idx}
                          user={student}
                          to={`/profile/${student._id}`}
                          subtitle={`Roll: ${student.rollNumber || "N/A"}`}
                          className="p-2 bg-black/5 dark:bg-white/5 border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10"
                        />
                      ))}
                    </div>
                    {students.length > 100 && (
                      <div className="mt-4 text-center text-sm font-bold opacity-70">
                        + {students.length - 100} more enrolled students
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={Users}
                    description="No students found for this semester."
                    className="my-4"
                  />
                )}
              </>
            );
          })()}
        </div>
      </section>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        users={shareUsers}
        onShare={handleSendShare}
      />
    </div>
  </div>
</div>
  );
};

export default SubjectPage;
