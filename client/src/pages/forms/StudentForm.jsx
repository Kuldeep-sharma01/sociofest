import React from "react";
import { useSelector } from "react-redux";
import Subject from "../../components/subject";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses } from "@/utils/themeUtils";
const StudentForm = ({
  studentData,
  setStudentData,
  totalSemesters,
  studentSubjects,
  department,
  isEditMode,
}) => {
  const { appTheme, isDark } = useTheme();
  const currentUser = useSelector((state) => state.auth.user);

  // ✅ Show a loading state instead of a stale fallback
  const semesters =
    totalSemesters > 0
      ? Array.from({ length: totalSemesters }, (_, i) => i + 1)
      : [];

  const handleRollChange = (e) => {
    const value = Number(e.target.value);

    // Enforce positive roll number only
    if (value >= 1) {
      setStudentData((prev) => ({
        ...prev,
        rollNumber: value,
      }));
    } else if (e.target.value === "") {
      // Allow clearing the field
      setStudentData((prev) => ({
        ...prev,
        rollNumber: "",
      }));
    }
  };

  const handleSemesterChange = (e) => {
    setStudentData((prev) => ({
      ...prev,
      semester: Number(e.target.value),
    }));
  };

  return (
    <>
      {/* Roll Number */}
      <input
        type="number"
        min={1}
        step={1}
        placeholder="University Roll Number"
        value={studentData.rollNumber}
        onChange={handleRollChange}
        required
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />

      {/* Semester */}
      {totalSemesters === 0 && department ? (
        <p className="text-xs opacity-60 text-center py-2 font-medium">Loading semesters...</p>
      ) : (
        <select
          value={studentData.semester}
          onChange={handleSemesterChange}
          required
          disabled={
            totalSemesters === 0 || 
            (isEditMode && currentUser?.role === 'Student' && !!studentData.semester && studentData.semester !== 0)
          }
          className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled hidden className={getOptionClasses(appTheme, isDark)}>
            {totalSemesters === 0 ? "Select Department First" : "Select Semester"}
          </option>

          {semesters.map((sem) => (
            <option key={sem} value={sem} className={getOptionClasses(appTheme, isDark)}>
              Semester {sem}
            </option>
          ))}
        </select>
      )}
      {studentData.semester && <Subject Subjects={studentSubjects} />}
    </>
  );
};

export default StudentForm;
