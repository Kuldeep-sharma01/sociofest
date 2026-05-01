import { useState } from "react";
import TeacherForm from "./TeacherForm";

const MAX_SEMESTERS = 12;
const MAX_TENURE = 70;

const HODForm = ({
  hodData,
  setHodData,
  teacherData,
  setTeacherData,
  hodTeaches,
  setHodTeaches,
  totalSemesters,
}) => {

  const handleSemesterChange = (e) => {
    const value = Number(e.target.value);

    // Guard: enforce 1–12 only
    if (value >= 1 && value <= MAX_SEMESTERS) {
      setHodData((prev) => ({
        ...prev,
        semesters: value,
      }));
      
    } else if (e.target.value === "") {
      // Allow clearing input
      setHodData((prev) => ({
        ...prev,
        semesters: "",
      }));
    }
  };

  return (
    <>
      {/* Total Semesters (Authority Field) */}
      <input
        type="number"
        min={1}
        max={MAX_SEMESTERS}
        step={1}
        placeholder="Total Semesters (Max 12)"
        value={hodData.semesters}
        onChange={handleSemesterChange}
        required
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />
      {/* Tenure */}
      <input
        type="number"
        max={MAX_TENURE}
        placeholder="Tenure (Years)"
        value={hodData.tenure}
        onChange={(e) => {
          const value = Number(e.target.value);

          if (value >= 1 && value <= MAX_TENURE) {
            setHodData((prev) => ({
              ...prev,
              tenure: value,
            }));
          } else if (e.target.value === "") {
            // Allow clearing input
            setHodData((prev) => ({
              ...prev,
              tenure: "",
            }));
          }
        }}
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />
      {/* Achievements */}
      <input
        placeholder="Achievements"
        value={hodData.achievements}
        onChange={(e) =>
          setHodData((prev) => ({
            ...prev,
            achievements: e.target.value,
          }))
        }
        className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />
      {/* Teaching Toggle */}
      <label className="flex p-3 border border-inherit/30 bg-black/5 dark:bg-white/5 items-center gap-3 rounded-lg cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10 w-full">
        <input
          type="checkbox"
          checked={hodTeaches}
          onChange={() => setHodTeaches((prev) => !prev)}
          className="w-5 h-5 accent-current cursor-pointer"
        />
        <span className="font-semibold text-sm text-inherit opacity-90">I Also Teach Subjects</span>
      </label>
      {/* Teacher Form (inherits semester authority) */}
      {hodTeaches && (hodData.semesters > 0 || totalSemesters > 0) && (
        <TeacherForm
          teacherData={teacherData}
          setTeacherData={setTeacherData}
          totalSemesters={hodData.semesters || totalSemesters}
        />
      )}
    </>
  );
};

export default HODForm;
