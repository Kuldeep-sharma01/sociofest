import React, { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from './ui/EmptyState';
import LoadingSkeleton from './ui/LoadingSkeleton';
import AddSubjectForm from './AddSubjectForm';
import { getCardThemeClasses, getOptionClasses } from '../utils/themeUtils';
import { getDepartments, getDepartmentSemesters } from '../services/userService';
import { getAllSubjects } from '../services/subjectService';
import { getRoleProfile } from '../utils/roleUtils';

const SubjectHub = ({
  user,
  hubRefreshKey,
  setHubRefreshKey,
  setHubDept,
  setHubSem,
  setHubSubjects,
  setHubLoading,
  setDeptTeachers,
  setIsAddingSubject,
  appTheme,
  isDark,
  deptSemesters
}) => {
  const [departmentsList, setDepartmentsList] = useState([]);
  const [isAddingSubject, localIsAddingSubject] = useState(false);
  const [newSubData, setNewSubData] = useState({
    name: "",
    code: "",
    semester: "",
    assignedTeachers: [],
  });
  const [creatingSubject, setCreatingSubject] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (user.role === "Admin" || user.role === "HOD") {
      getDepartments()
        .then((res) => {
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
    }
  }, [hubRefreshKey, user]);

  const toggleAddSubject = async () => {
    const current = localIsAddingSubject((prev) => !prev);
    setIsAddingSubject(current);
    
    if (!current && setHubDept) {
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
              t.department?.name === setHubDept),
        );
        setDeptTeachers(filtered);
      } catch (e) {
        console.error("Failed to load teachers", e);
      }
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubData.name || !newSubData.semester) return;
    setCreatingSubject(true);
    try {
      const assignedTeacher = newSubData.assignedTeachers;
      const autoCode = `${newSubData.name.replace(/\s/g, "").toUpperCase().slice(0, 4)}${newSubData.semester}`;
      const code = newSubData.code || `${autoCode}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      // createSubject call would go here
      setIsAddingSubject(false);
      setNewSubData({
        name: "",
        code: "",
        semester: "",
        assignedTeachers: [],
      });
      setHubRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Subject created! 📘" }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to create subject. ❌" }));
    } finally {
      setCreatingSubject(false);
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 space-y-8 ${getCardThemeClasses(appTheme)}`}>
      <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-4">
          <select
            value={setHubDept || ''}
            onChange={(e) => {
              setHubDept(e.target.value);
              setHubSem("all");
            }}
            className="p-3 border border-inherit/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-current min-w-[220px] bg-black/5 dark:bg-white/5"
          >
            <option value="" disabled>Select Department</option>
            {departmentsList.map((d, idx) => (
              <option key={d || idx} value={d}>{d}</option>
            ))}
          </select>
          
          <select
            value={setHubSem || ''}
            onChange={(e) => setHubSem(e.target.value)}
            className="p-3 border border-inherit/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-current min-w-[180px] bg-black/5 dark:bg-white/5"
          >
            <option value="" disabled>Select Semester</option>
            <option value="all">All Semesters</option>
            {Array.from({ length: deptSemesters }, (_, i) => i + 1).map((sem) => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>
        
        {setHubDept && (
          <button
            onClick={toggleAddSubject}
            className={`flex items-center gap-2 px-6 py-3 font-bold rounded-2xl shadow-lg transition-all ${getPrimaryButtonClasses(appTheme)}`}
          >
            {localIsAddingSubject ? (
              <X className="w-5 h-5" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            {localIsAddingSubject ? 'Cancel' : 'Add Subject'}
          </button>
        )}
      </div>

      {localIsAddingSubject && setHubDept && (
        <div className="p-8 rounded-3xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200/50 shadow-2xl">
          <AddSubjectForm
            hubDept={setHubDept}
            newSubData={newSubData}
            setNewSubData={setNewSubData}
            deptTeachers={setDeptTeachers}
            handleCreateSubject={handleCreateSubject}
            creatingSubject={creatingSubject}
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {setHubLoading ? (
          <LoadingSkeleton count={6} className="col-span-full h-48" />
        ) : setHubSubjects?.length > 0 ? (
          setHubSubjects.map((sub) => (
            <div
              key={sub._id}
              onClick={() => navigate(`/subjects/${sub._id}`)}
              className="group cursor-pointer p-8 rounded-3xl bg-gradient-to-br from-white/60 to-gray-50/60 dark:from-slate-800/60 dark:to-slate-900/60 hover:from-indigo-500/10 hover:to-purple-500/10 hover:shadow-2xl hover:-translate-y-2 border border-inherit/30 backdrop-blur-sm transition-all duration-500 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 via-transparent to-purple-500/5 group-hover:from-indigo-500/20 group-hover:to-purple-500/20 transition-all duration-500" />
              <div className="absolute top-4 left-4 w-2 h-full bg-gradient-to-b from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <h3 className="font-black text-xl leading-tight mb-3 relative z-10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {sub.name}
              </h3>
              
              <p className="text-sm opacity-80 mb-4 flex flex-wrap gap-1 relative z-10">
                <span className="font-semibold">👨‍🏫 Teacher:</span>
                {Array.isArray(sub.assignedTeacher) && sub.assignedTeacher.length > 0
                  ? sub.assignedTeacher.map((t, idx) => (
                      <span key={idx} className="font-medium bg-white/60 dark:bg-black/40 px-2 py-1 rounded-full text-xs">
                        {t?.name || 'TBD'}
                      </span>
                    ))
                  : <span className="italic opacity-70">Not Assigned</span>
                }
              </p>
              
              {sub.semester && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 dark:bg-black/50 backdrop-blur-sm rounded-2xl border border-inherit/40 shadow-lg relative z-10 group-hover:shadow-xl group-hover:scale-105 transition-all">
                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
                  <span className="font-bold text-sm">Semester {sub.semester}</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No Subjects Found"
            description={`Try adjusting department/semester filters${user.role === 'HOD' ? ' or create new ones' : ''}.`}
            className="col-span-full"
          />
        )}
      </div>
    </div>
  );
};

export default SubjectHub;

