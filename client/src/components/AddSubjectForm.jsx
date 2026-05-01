import React from "react";
import { Save, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses } from "@/utils/themeUtils";

const AddSubjectForm = ({
  hubDept,
  newSubData,
  setNewSubData,
  deptSemesters,
  deptTeachers,
  handleCreateSubject,
  creatingSubject,
  isEditMode = false,
  onCancel,
}) => {
  const { appTheme, isDark } = useTheme();

  return (
    <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/30 mb-6 animate-in fade-in slide-in-from-top-2 w-full transition-colors">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-inherit">
          {isEditMode ? "Edit Subject" : `Add New Subject to ${hubDept}`}
        </h3>
        {isEditMode && onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <input
          type="text"
          aria-label="Subject Name"
          placeholder="Subject Name *"
          value={newSubData.name || ""}
          onChange={(e) =>
            setNewSubData({ ...newSubData, name: e.target.value })
          }
          className="p-2 border border-inherit/30 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
        />
        <input
          type="text"
          aria-label="Subject Code"
          placeholder="Subject Code (e.g. CS101)"
          value={newSubData.code || ""}
          onChange={(e) =>
            setNewSubData({ ...newSubData, code: e.target.value })
          }
          className="p-2 border border-inherit/30 rounded-lg focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit"
        />
        <select
          aria-label="Select Semester"
          value={newSubData.semester || ""}
          onChange={(e) =>
            setNewSubData({ ...newSubData, semester: e.target.value })
          }
        className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium"
        >
        <option value="" disabled className={getOptionClasses(appTheme, isDark)}>
            Select Semester *
          </option>
          {Array.from({ length: deptSemesters || 8 }, (_, i) => i + 1).map(
            (sem) => (
            <option key={sem} value={sem} className={getOptionClasses(appTheme, isDark)}>
                Semester {sem}
              </option>
            ),
          )}
        </select>
        <div className="w-full p-2 border border-inherit/30 rounded focus-within:ring-2 focus-within:ring-current bg-black/5 dark:bg-white/5 text-inherit min-h-[42px] col-span-1 sm:col-span-2 md:col-span-4">
          <div className="flex flex-wrap gap-2 mb-2 ">
            {(newSubData.assignedTeachers || []).map((tId, idx) => {
              const tObj =
                deptTeachers.find((t) => t._id === tId) ||
                (newSubData.originalTeachers &&
                  newSubData.originalTeachers.find(
                    (t) => typeof t === "object" && t._id === tId,
                  ));
              return (
                <span
                  key={tId || idx}
                  className="flex p-2 items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-s font-medium"
                >
                  {tObj?.name || "Unknown"}
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubData((prev) => ({
                        ...prev,
                        assignedTeachers: prev.assignedTeachers.filter(
                          (id) => id !== tId,
                        ),
                      }))
                    }
                    className="hover:text-red-500 "
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <select
            aria-label="Add or Select Teachers"
            value=""
            onChange={(e) => {
              const val = e.target.value;
            if (val && !(newSubData.assignedTeachers || []).includes(val)) {
                setNewSubData((prev) => ({
                  ...prev,
                assignedTeachers: [...(prev.assignedTeachers || []), val],
                }));
              }
            }}
          className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium"
          >
          <option value="" disabled className={getOptionClasses(appTheme, isDark)}>
              + Add / Select Teacher(s)
            </option>
            {deptTeachers
              .filter((t) => !(newSubData.assignedTeachers || []).includes(t._id))
              .map((t, idx) => (
              <option key={t._id || idx} value={t._id} className={getOptionClasses(appTheme, isDark)}>
                  {t.name} {t.role !== "Teacher" ? `(${t.role})` : ""}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={handleCreateSubject}
          disabled={creatingSubject || !newSubData.name || !newSubData.semester}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center transition shadow-sm font-medium"
        >
          {creatingSubject ? (
            <div className="loader mr-2" style={{ '--s': '10px', '--g': '2px' }}></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isEditMode ? "Save" : "Save Subject"}
        </button>
        {isEditMode && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center hover:bg-gray-300 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default AddSubjectForm;
