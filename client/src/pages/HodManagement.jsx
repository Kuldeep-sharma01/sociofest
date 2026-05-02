import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllUsers, updateUserProfile } from "@/services/userService";
import { getAllDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/services/departmentService";
import { Link } from "react-router-dom";
import { Crown, Shield, Building, Loader2, Edit2, Plus, Trash2 } from "lucide-react";
import Select from "react-select";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useSelector, useDispatch } from "react-redux";
import { updateUser as updateAuthUser } from "@/redux/authSlice";
import { useTheme } from "@/context/ThemeContext";
import { getWrapperThemeClasses, getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
import { AlertCircle, Info } from "lucide-react";

const HodManagement = () => {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { appTheme, isDark } = useTheme();
  const authUser = useSelector((state) => state.auth.user);
  const isAdmin = authUser?.role === "Admin";

  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [targetDepartment, setTargetDepartment] = useState(null);
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptData, setEditDeptData] = useState({ name: "", code: "" });
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [newDeptData, setNewDeptData] = useState({ name: "", code: "" });

  const { data: hods, isLoading: isLoadingHods } = useQuery({
    queryKey: ["users", { role: "HOD" }],
    queryFn: () => getAllUsers({ role: "HOD" }),
  });

  const { data: teachers, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["users", { role: ["Teacher", "Admin"] }],
    queryFn: () => getAllUsers({ role: ["Teacher", "Admin"] }),
    select: (data) => {
      const list = Array.isArray(data) ? data : data?.users || data?.data || [];
      return list.map((t) => ({ 
        value: t._id, 
        label: `${t.name} (${t.email || 'No Email'}) [${t.role}]`,
        role: t.role 
      }));
    },
  });

  const { data: departments, isLoading: isLoadingDepts } = useQuery({
    queryKey: ["departments"],
    queryFn: getAllDepartments,
  });

  const { mutate: assignHod, isLoading: isAssigning } = useMutation({
    mutationFn: ({ userId, departmentName, replace }) => {
      const payload = {
        role: "HOD",
        department: departmentName,
        replace: replace,
        hodData: {
            semesters: 8,
            tenure: 0,
            achievements: "Newly Appointed"
        }
      };
      return updateUserProfile(userId, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      
      // If the updated user is the current logged-in user, refresh their local session
      if (data?.user?._id === authUser?._id) {
        dispatch(updateAuthUser(data.user));
      }
      
      setSelectedTeacher(null);
      setTargetDepartment(null);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "HOD assigned successfully! 👑" }));
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || "Failed to assign HOD.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: errorMsg, variant: 'error' } }));
    },
  });

  const { mutate: removeHod, isLoading: isRemovingHod } = useMutation({
    mutationFn: (deptId) => {
      return updateDept({ id: deptId, data: { hod: null } });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      
      // Note: removeHod now calls updateDepartment, which doesn't return the demoted user.
      // However, the backend's cleanup logic might have changed the current user's role.
      // We'll invalidate the user queries to ensure the UI eventually catches up.
      
      window.dispatchEvent(new CustomEvent("showToast", { detail: "HOD removed successfully! 🗑️" }));
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || "Failed to remove HOD.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: errorMsg, variant: 'error' } }));
    },
  });

  const { mutate: updateDept, isLoading: isUpdatingDept } = useMutation({
    mutationFn: ({ id, data }) => updateDepartment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setEditingDeptId(null);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Department updated successfully! 🏢" }));
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || "Failed to update department.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: errorMsg, variant: 'error' } }));
    },
  });

  const { mutate: createDept, isLoading: isCreatingDeptMutation } = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setIsCreatingDept(false);
      setNewDeptData({ name: "", code: "" });
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Department created! 🏢" }));
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || "Failed to create department.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: errorMsg, variant: 'error' } }));
    }
  });

  const { mutate: removeDept, isLoading: isDeletingDept } = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Department deleted! 🗑️" }));
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || "Failed to delete department.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: errorMsg, variant: 'error' } }));
    }
  });

  const handleAssignClick = (department) => {
    setTargetDepartment(department);
    setSelectedTeacher(null);
  };

  const handleConfirmAssignment = () => {
    if (selectedTeacher && targetDepartment) {
      // If assigning an Admin as HOD, we don't want to change their role to "HOD"
      // We just want to update the department's hod field.
      if (selectedTeacher.role === "Admin") {
        updateDept({
          id: targetDepartment._id,
          data: { hod: selectedTeacher.value }
        });
        setSelectedTeacher(null);
        setTargetDepartment(null);
      } else {
        assignHod({
          userId: selectedTeacher.value,
          departmentName: targetDepartment.name,
          replace: !!targetDepartment.hod,
        });
      }
    }
  };

  const handleRemoveHod = (deptId, deptName) => {
    if (window.confirm(`Are you sure you want to remove the HOD for ${deptName}? If they are not an Admin, they will be demoted to Teacher.`)) {
      removeHod(deptId);
    }
  };

  const isLoading = isLoadingHods || isLoadingTeachers || isLoadingDepts;

  const safeDepartments = Array.isArray(departments) ? departments : departments?.departments || [];
  const safeHods = Array.isArray(hods) ? hods : hods?.users || [];
  const departmentsWithHods = safeDepartments.map(dept => {
      // Robust detection: 
      // 1. Check if dept.hod is a populated object with an _id
      // 2. If not, check if dept.hod is a string (the ID itself)
      // 3. Fallback to searching the safeHods list by comparing string versions of IDs
      const hodId = dept.hod?._id || (typeof dept.hod === 'string' ? dept.hod : null);
      let hod = (dept.hod && typeof dept.hod === 'object' && dept.hod._id) ? dept.hod : null;
      
      if (!hod && hodId) {
          // If we have an ID but not the object, try to find the object in safeHods
          hod = safeHods.find(h => String(h._id) === String(hodId));
          // If still not found, create a placeholder object with the ID
          if (!hod) hod = { _id: hodId, name: "Assigned HOD (Details Loading...)" };
      } else if (!hod) {
          // If dept.hod was empty, try to find a user who claims to be in this department as HOD
          hod = safeHods.find(h => String(h.department?._id || h.department) === String(dept._id));
      }
      
      return { ...dept, hod };
  });

  return (
    <div className={`p-4 sm:p-6 min-h-[calc(100vh-64px)] transition-colors ${getWrapperThemeClasses(appTheme)}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold">HOD Management</h1>
        </div>
        <p className="mb-8 text-inherit opacity-80">
          Manage department details and assign Head of Departments (HODs) to their respective departments.
        </p>

        {isLoading ? <LoadingSkeleton count={4} /> : (
          <div className={`rounded-lg shadow-md border transition-colors ${getCardThemeClasses(appTheme)}`}>
            <div className="p-4 border-b border-inherit/30 flex justify-between items-center">
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold">Departments & HODs</h2>
                {!isAdmin && (
                  <span className="text-xs text-amber-500 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Read-only mode (Admin access required for changes)
                  </span>
                )}
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setIsCreatingDept(true)}
                  className={`text-sm font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors ${getPrimaryButtonClasses(appTheme)}`}
                >
                  <Plus className="w-4 h-4" /> New Dept
                </button>
              )}
            </div>
            {isCreatingDept && (
              <div className="p-4 border-b border-inherit/30 bg-black/5 dark:bg-white/5">
                <div className="flex flex-col gap-2 max-w-sm">
                  <input
                    type="text"
                    value={newDeptData.name}
                    onChange={(e) => setNewDeptData({ ...newDeptData, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-inherit/30 rounded-md bg-transparent text-inherit text-sm focus:outline-none focus:ring-2 focus:ring-current"
                    placeholder="Department Name"
                  />
                  <input
                    type="text"
                    value={newDeptData.code}
                    onChange={(e) => setNewDeptData({ ...newDeptData, code: e.target.value })}
                    className="w-full px-3 py-1.5 border border-inherit/30 rounded-md bg-transparent text-inherit text-sm focus:outline-none focus:ring-2 focus:ring-current"
                    placeholder="Department Code"
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => createDept(newDeptData)}
                      disabled={isCreatingDeptMutation || !newDeptData.name}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setIsCreatingDept(false)}
                      disabled={isCreatingDeptMutation}
                      className="text-xs bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-inherit px-3 py-1.5 rounded-md font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            <ul className="divide-y divide-inherit/30">
              {departmentsWithHods.map((dept) => {
                const isEditing = editingDeptId === dept._id;
                
                return (
                <li key={dept._id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto flex-1">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-full shrink-0">
                      <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    {isEditing ? (
                      <div className="flex flex-col gap-2 w-full max-w-sm">
                        <input
                          type="text"
                          value={editDeptData.name}
                          onChange={(e) => setEditDeptData({ ...editDeptData, name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-inherit/30 rounded-md bg-transparent text-inherit text-sm focus:outline-none focus:ring-2 focus:ring-current"
                          placeholder="Department Name"
                        />
                        <input
                          type="text"
                          value={editDeptData.code}
                          onChange={(e) => setEditDeptData({ ...editDeptData, code: e.target.value })}
                          className="w-full px-3 py-1.5 border border-inherit/30 rounded-md bg-transparent text-inherit text-sm focus:outline-none focus:ring-2 focus:ring-current"
                          placeholder="Department Code"
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => updateDept({ id: dept._id, data: editDeptData })}
                            disabled={isUpdatingDept}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDeptId(null)}
                            disabled={isUpdatingDept}
                            className="text-xs bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-inherit px-3 py-1.5 rounded-md font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col group">
                        <div className="flex items-center gap-2">
                           <p className="font-bold text-lg">{dept.name}</p>
                           {isAdmin && (
                             <>
                               <button
                                 onClick={() => {
                                   setEditingDeptId(dept._id);
                                   setEditDeptData({ name: dept.name, code: dept.code });
                                 }}
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 focus:opacity-100 p-1"
                                 title="Edit Department Details"
                               >
                                 <Edit2 className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => {
                                   if (window.confirm(`Are you sure you want to delete the ${dept.name} department?`)) {
                                     removeDept(dept._id);
                                   }
                                 }}
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 focus:opacity-100 p-1"
                                 title="Delete Department"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </>
                           )}
                         </div>
                        <p className="text-sm text-inherit opacity-70">{dept.code}</p>
                      </div>
                    )}
                  </div>
                  
                  {dept.hod ? (
                    <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-2 rounded-lg w-full sm:w-auto justify-between shrink-0">
                      <div className="flex items-center gap-3">
                          <img src={dept.hod.profilePicture || `https://ui-avatars.com/api/?name=${dept.hod.name}&background=random`} alt={dept.hod.name} className="w-10 h-10 rounded-full" />
                          <div>
                              <Link to={`/profile/${dept.hod._id}`} className="font-semibold hover:underline">{dept.hod.name}</Link>
                              <div className="flex items-center gap-1 text-xs text-inherit opacity-70">
                                  <Crown className="w-3 h-3 text-yellow-500" />
                                  <span>HOD</span>
                              </div>
                            </div>
                          </div>
                       {isAdmin && (
                        <div className="flex flex-col gap-1 ml-4 border-l border-inherit/30 pl-4">
                          <button
                            onClick={() => handleAssignClick(dept)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => handleRemoveHod(dept._id, dept.name)}
                            disabled={isRemovingHod}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-left disabled:opacity-50"
                          >
                            {isRemovingHod ? "Removing..." : "Remove"}
                          </button>
                        </div>
                       )}
                    </div>
                  ) : (
                    isAdmin ? (
                      <button
                        onClick={() => handleAssignClick(dept)}
                        className={`w-full sm:w-auto font-bold py-2 px-4 rounded-lg transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                      >
                        Assign HOD
                      </button>
                    ) : (
                      <span className="text-xs font-medium opacity-50 px-4">Not Assigned</span>
                    )
                  )}
                </li>
              )})}
            </ul>
          </div>
        )}

        {targetDepartment && (
          <div className={`mt-8 p-6 rounded-lg shadow-md border transition-colors ${getCardThemeClasses(appTheme)}`}>
            <h3 className="text-xl font-semibold mb-4">
              Assign HOD for <span className="text-blue-500">{targetDepartment.name}</span>
            </h3>
            <div className="flex flex-col gap-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">Important Role Consequence:</p>
                  <p className="opacity-80">
                    Assigning a <strong>Teacher</strong> as HOD will promote them and grant full administrative access to this department. 
                    Assigning an <strong>Admin</strong> will link them as HOD without changing their Admin role.
                    {targetDepartment.hod && <span className="block mt-1 text-red-500 font-bold italic">Note: The current HOD will be demoted to Teacher.</span>}
                  </p>
                </div>
              </div>
              <Select
                options={teachers}
                value={selectedTeacher}
                onChange={setSelectedTeacher}
                placeholder="Search for a teacher by name or email..."
                isLoading={isLoadingTeachers}
                isClearable
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    borderColor: "rgba(128,128,128,0.3)",
                    color: "inherit"
                  })
                }}
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setTargetDepartment(null)}
                  className="bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-inherit font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAssignment}
                  disabled={!selectedTeacher || isAssigning}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                  {isAssigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodManagement;
