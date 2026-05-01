import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, ClipboardList, Edit2, Trash2, CheckCircle, Upload, X } from 'lucide-react';
import AssignmentCard from './ui/AssignmentCard';
import SubmissionItem from './ui/SubmissionItem';
import PostComposer from './ui/PostComposer';
import EmptyState from './ui/EmptyState';
import { getCardThemeClasses, getPrimaryButtonClasses } from '../utils/themeUtils';
import { 
  getAssignmentsBySubject,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission 
} from '../services/assignmentService';

const AssignmentsSection = ({
  activeSubjectId,
  user,
  appTheme,
  canManageContent,
  assignments,
  setAssignments,
  enrolledUsers,
  selectedAssignments,
  setSelectedAssignments,
  editingAssignmentId,
  setEditingAssignmentId,
  editAssignmentData,
  setEditAssignmentData,
  editAssignmentFiles,
  setEditAssignmentFiles,
  submissionInputs,
  setSubmissionInputs,
  submittingAssignment,
  setSubmittingAssignment,
  resubmittingAssignment,
  setResubmittingAssignment,
  gradingState,
  setGradingState
}) => {
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    dueDate: "",
  });
  const [newAssignmentFiles, setNewAssignmentFiles] = useState([]);
  const [adding, setAdding] = useState(false);

  const submissionInputsRef = useRef(submissionInputs);
  useEffect(() => {
    submissionInputsRef.current = submissionInputs;
  }, [submissionInputs]);

  const handleAddAssignment = async () => {
    if (!newAssignment.title || !newAssignment.dueDate) {
      window.dispatchEvent(new CustomEvent("showToast", { 
        detail: "Assignment title and due date are required. ❌" 
      }));
      return;
    }
    setAdding(true);
    try {
      const res = await createAssignment(
        activeSubjectId,
        newAssignment,
        newAssignmentFiles,
      );
      setAssignments([res, ...assignments]);
      setNewAssignment({ title: "", description: "", dueDate: "" });
      setNewAssignmentFiles([]);
      window.dispatchEvent(new CustomEvent("showToast", { 
        detail: "Assignment created successfully! 📝" 
      }));
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to add assignment.";
      window.dispatchEvent(new CustomEvent("showToast", { 
        detail: `${msg} ❌` 
      }));
    } finally {
      setAdding(false);
    }
  };

  const handleEditAssignmentStart = (assignment) => {
    setEditingAssignmentId(assignment._id);
    const d = assignment.dueDate ? new Date(assignment.dueDate) : null;
    const formattedDate = d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
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

  const handleUpdateAssignment = async (id) => {
    if (!editAssignmentData.title || !editAssignmentData.dueDate)
      return window.dispatchEvent(new CustomEvent("showToast", { detail: "Title and due date required. ❌" }));
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
      setAssignments((prev) => prev.map((a) => (a._id === id ? res : a)));
      setEditingAssignmentId(null);
      setEditAssignmentData({ title: "", description: "", dueDate: "" });
      setEditAssignmentFiles([]);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Assignment updated! ✏️" }));
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update assignment.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const handleSubmitAssignment = async (assignmentId) => {
    const inputData = submissionInputsRef.current[assignmentId];
    if (
      !inputData?.text &&
      (!inputData?.files || inputData.files.length === 0)
    ) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Please provide answer or files. ❌" }));
      return;
    }

    setSubmittingAssignment(assignmentId);
    try {
      const formData = new FormData();
      if (inputData.text) formData.append("textAnswer", inputData.text);
      
      const retainedIds = inputData.files?.filter(f => f.isRetained).map(f => f._id) || [];
      if (retainedIds.length === 0) {
        formData.append("retainedMediaIds", "[]");
      } else {
        retainedIds.forEach(id => formData.append("retainedMediaIds", id));
      }

      inputData.files?.filter(f => !f.isRetained).forEach((file) => {
        formData.append("files", file.file || file);
        formData.append("mediaTitles", file.title || file.file?.name || "Submission File");
        formData.append("mediaDescriptions", file.description || " ");
        formData.append("mediaDownloadable", file.isDownloadable ?? false);
      });

      const res = await submitAssignment(assignmentId, formData);
      setAssignments((prev) => prev.map((a) => (a._id === assignmentId ? res : a)));
      setSubmissionInputs((prev) => ({
        ...prev,
        [assignmentId]: { text: "", files: [] },
      }));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Submitted! ✅" }));
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to submit.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setSubmittingAssignment(null);
      setResubmittingAssignment(null);
    }
  };

  const handleGradeSubmit = async (assignmentId, studentId) => {
    const gradeData = gradingState[`${assignmentId}-${studentId}`];
    if (!gradeData || !studentId) return;
    try {
      const res = await gradeSubmission(assignmentId, studentId, gradeData);
      setAssignments((prev) => prev.map((a) => (a._id === assignmentId ? res : a)));
      setGradingState((prev) => ({
        ...prev,
        [`${assignmentId}-${studentId}`]: { ...gradeData, editing: false },
      }));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Grade saved! 🎓" }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to save grade. ❌" }));
    }
  };

  const toggleAssignmentSelect = (id) => {
    setSelectedAssignments((prev) =>
      prev.includes(id) ? prev.filter((aId) => aId !== id) : [...prev, id],
    );
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm("Delete this assignment?")) return;
    try {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a._id !== id));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Deleted 🗑️" }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Delete failed ❌" }));
    }
  };

  if (!activeSubjectId) return null;

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
    <section className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="opacity-80" /> Assignments
          </h2>
          {studentAvgGrade !== null && (
            <span className="bg-green-500/10 text-green-600 px-3 py-1 rounded-full text-sm font-bold border border-green-500/20">
              Avg: {studentAvgGrade}%
            </span>
          )}
        </div>
        {canManageContent && selectedAssignments.length > 0 && (
          <button
            onClick={() => {/* bulk delete handler */}}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-600 font-bold rounded-lg border border-red-500/20"
          >
            <Trash2 className="w-4 h-4" /> Delete ({selectedAssignments.length})
          </button>
        )}
      </div>

      {/* Add New Assignment Form */}
      {canManageContent && (
        <div className={`p-6 rounded-2xl shadow-sm border ${getCardThemeClasses(appTheme)}`}>
          <h3 className="font-bold mb-4 text-lg">➕ New Assignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Title *"
              value={newAssignment.title}
              onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
              className="p-3 rounded-xl border border-inherit/30 focus:ring-2 focus:ring-current"
            />
            <input
              type="datetime-local"
              value={newAssignment.dueDate}
              onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
              className="p-3 rounded-xl border border-inherit/30 focus:ring-2 focus:ring-current"
            />
          </div>
          <textarea
            placeholder="Description"
            value={newAssignment.description}
            onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
            rows="3"
            className="w-full p-3 rounded-xl border border-inherit/30 focus:ring-2 focus:ring-current resize-vertical mb-4"
          />
          <input
            type="file"
            multiple
            onChange={(e) => setNewAssignmentFiles(Array.from(e.target.files))}
            className="w-full p-3 border-2 border-dashed border-inherit/30 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-colors mb-4"
          />
          <button
            onClick={handleAddAssignment}
            disabled={adding}
            className={`w-full py-3 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${getPrimaryButtonClasses(appTheme)} disabled:opacity-50`}
          >
            {adding ? (
              <>
                <div className="loader" style={{ "--s": "12px", "--g": "2px" }} />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create Assignment
              </>
            )}
          </button>
        </div>
      )}

      {/* Assignments List */}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-2">
        {assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No Assignments"
            description="Assignments will appear here."
            className="my-8"
          />
        ) : (
          assignments.map((assignment) => (
            <AssignmentCard
              key={assignment._id}
              title={assignment.title}
              description={assignment.material?.description || assignment.description}
              dueDate={assignment.dueDate}
              headerAction={
                canManageContent ? (
                  <input
                    type="checkbox"
                    checked={selectedAssignments.includes(assignment._id)}
                    onChange={() => toggleAssignmentSelect(assignment._id)}
                    className="w-5 h-5 rounded"
                  />
                ) : null
              }
              actionButton={
                canManageContent ? (
                  <div className="flex gap-1 p-1 bg-black/5 rounded-xl border border-inherit/30">
                    <button
                      onClick={() => handleEditAssignmentStart(assignment)}
                      className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(assignment._id)}
                      className="p-1.5 text-red-600 hover:bg-red-500/10 rounded transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : null
              }
            >
              {/* Render logic for student submissions or teacher grading */}
              {user.role === "Student" ? (
                // Student submission UI
                <div className="mt-4">
                  {/* Submission form or status */}
                </div>
              ) : (
                // Teacher grading UI  
                <div className="mt-4">
                  {/* Student submissions list */}
                </div>
              )}
            </AssignmentCard>
          ))
        )}
      </div>
    </section>
  );
};

export default AssignmentsSection;

