import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const SetSubject = ({ teacherData, setTeacherData, totalSemesters }) => {
  const semesters =
    totalSemesters > 0
      ? Array.from({ length: totalSemesters }, (_, i) => i + 1)
      : [];
  const { appTheme, isDark } = useTheme();

  const addSubject = () => {
    const hasEmptyRow = teacherData.subjects.some(
      (s) => s.subject === "" && s.semester === "",
    );

    if (hasEmptyRow) return;
    setTeacherData((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        { _id: null, _key: crypto.randomUUID(), semester: "", subject: "", code: "" },
      ],
    }));
  };

  const removeSubject = (index) => {
    setTeacherData((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index),
    }));
  };

  const updateSubject = (index, field, value) => {
    setTeacherData((prev) => {
      const updated = [...prev.subjects];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, subjects: updated };
    });
  };

  return (
    <>
      <h4 className="font-semibold mt-4">Subjects You Teach</h4>

      {teacherData.subjects.map((sub, index) => (
        <div key={sub._key || sub._id || index} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 sm:mt-2 items-stretch sm:items-center p-3 sm:p-0 bg-black/5 dark:bg-white/5 sm:bg-transparent rounded-xl border border-inherit/10 sm:border-transparent">
          {/* Semester */}
          <select
            value={sub.semester}
            onChange={(e) =>
              updateSubject(
                index,
                "semester",
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
            required
            disabled={totalSemesters === 0}
          className="w-full sm:w-1/4 p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
          >
          <option value="" className={getOptionClasses(appTheme, isDark)}>
              {totalSemesters === 0 ? "Semesters not configured" : "Semester"}
            </option>
            {semesters.map((sem) => (
            <option key={sem} value={sem} className={getOptionClasses(appTheme, isDark)}>
                Sem {sem}
              </option>
            ))}
          </select>

          {/* Subject */}
          <input
            placeholder="Subject Name"
            value={sub.subject || sub.name || ""}
            onChange={(e) => updateSubject(index, "subject", e.target.value)}
            required
            className="w-full sm:flex-1 p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
          />

          {/* Subject Code */}
          <input
            placeholder="Code (Optional)"
            value={sub.code || ""}
            onChange={(e) => updateSubject(index, "code", e.target.value)}
            className="w-full sm:w-1/4 p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit"
          />

          {/* Remove */}
          <button
            type="button"
            onClick={() => removeSubject(index)}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-red-500/30 transition-colors bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white shadow-sm font-bold flex items-center justify-center gap-1"
          >
            <span className="sm:hidden">Remove</span>
            <span>−</span>
          </button>
        </div>
      ))}

      {/* Add */}
      <button
        type="button"
        onClick={addSubject}
        disabled={totalSemesters === 0}
        className={`mt-3 w-full px-4 py-2 rounded-lg border transition-colors font-bold shadow-sm
    ${
      totalSemesters === 0
        ? "text-inherit opacity-50 bg-black/10 dark:bg-white/10 cursor-not-allowed border-transparent"
        : getPrimaryButtonClasses(appTheme)
    }`}
      >
        + Add Subject
      </button>
    </>
  );
};

export default SetSubject;
