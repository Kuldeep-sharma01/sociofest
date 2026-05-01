import React, { useMemo } from "react";
import SetSubject from "../../components/setSubject";
import { useTheme } from "@/context/ThemeContext";
import { getOptionClasses } from "@/utils/themeUtils";
const year = new Date().getFullYear();

const Years = Object.freeze(Array.from({ length: 80 }, (_, i) => year - i));

const TeacherForm = ({ teacherData, setTeacherData, totalSemesters }) => {
  const { appTheme, isDark } = useTheme();

  const yearOptions = useMemo(() => Years.map(y => ({ y, exp: year - y })), []);

  return (
    <>
      {/* Qualifications */}
      <input
        placeholder="Qualifications"
        value={teacherData.qualifications}
        onChange={(e) =>
          setTeacherData((prev) => ({
            ...prev,
            qualifications: e.target.value,
          }))
        }
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />

      {/* Experience (Years of Teaching) */}
      <select
        // size={5}
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="number"
        name="years"
        id="years"
        placeholder="Experienced Since..."
        value={
          teacherData.experience !== "" && teacherData.experience !== undefined
            ? year - Number(teacherData.experience)
            : ""
        }
        onChange={(e) => {
          const selectedYear = Number(e.target.value);

          if (selectedYear >= year - 80 && selectedYear <= year) {
            // Calculate years of experience from the selected year
            const yearsOfExperience = year - selectedYear;
            setTeacherData((prev) => ({
              ...prev,
              experience: yearsOfExperience,
            }));
          } else if (e.target.value === "") {
            // Allow clearing input
            setTeacherData((prev) => ({
              ...prev,
              experience: "",
            }));
          }
        }}
      >
        <option
          value=""
          disabled
          className={getOptionClasses(appTheme, isDark)}
        >
          Select the year you started teaching
        </option>
        {yearOptions.map(({ y, exp }) => {
          return (
            <option
              className={`text-center ${getOptionClasses(appTheme, isDark)}`}
              value={y}
              key={y}
            >
              {y} ({exp} years)
            </option>
          );
        })}
      </select>

      {/* Subjects */}
      <SetSubject
        teacherData={teacherData}
        setTeacherData={setTeacherData}
        totalSemesters={totalSemesters}
      />
    </>
  );
};

export default TeacherForm;
