import React, { useEffect, useState, useRef } from "react";

import { getAllUsers, updateUserRole, updateUserStatus, updateStudentSemester, bulkUpdateUserStatus, bulkUpdateUserSemester, bulkUploadUsers } from "@/services/userService";
import { useSelector } from "react-redux";
import {
  CheckCircle,
  XCircle,
  Users,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Search,
  Plus,
  Minus,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import ErrorAlert from "@/components/ui/ErrorAlert";
import UserCard from "@/components/ui/UserCard";
import EmptyState from "@/components/ui/EmptyState";
import UniversalBadge from "@/components/ui/UniversalBadge";
import { useTheme } from "@/context/ThemeContext";
import StatusBadge from "@/components/ui/StatusBadge";
import { getPrimaryEmail } from "@/utils/userUtils";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { getBannerThemeClasses, getCardThemeClasses, getPrimaryButtonClasses, getOptionClasses } from "@/utils/themeUtils";

export default function UserApprovalList() {
  const user = useSelector((state) => state.auth.user);
  const [allUsers, setAllUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("");
   const { appTheme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [rejectModal, setRejectModal] = useState({ open: false, targetId: null, bulk: false, reason: "" });

  // ✅ Use a component-level mounted ref for the post-upload refresh
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const fetchUsers = async (params = {}, signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await getAllUsers(params, signal);
      console.log("Fetched Users:", data);
      if (signal?.aborted) return;
      const unwrappedData = data?.data || data;
      setAllUsers(Array.isArray(unwrappedData) ? unwrappedData : (unwrappedData?.users || []));
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to load users ❌" }));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = {};
    if (roleFilter) params.role = roleFilter;
    fetchUsers(params, controller.signal);
    setSelectedUsers([]); // Clear selection when role filter changes
    return () => controller.abort();
  }, [roleFilter]);

  useEffect(() => {
    setSelectedUsers([]);
  }, [statusFilter]);

  const updateStatus = async (id, newStatus, reason = null) => {
    try {
      await updateUserStatus(id, { status: newStatus, rejectionReason: reason });
      setAllUsers((prev) =>
        prev.map((u) =>
          u._id === id
            ? { ...u, status: newStatus, rejectionReason: reason }
            : u,
        ),
      );
      setSelectedUsers((prev) => prev.filter((userId) => userId !== id));
      window.dispatchEvent(new CustomEvent("showToast", { detail: `User updated to ${newStatus} ✅` }));
    } catch (err) {
      console.error(`Error updating user status to ${newStatus}:`, err);
      const msg = `Failed to update user to ${newStatus}.`;
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const updateSemester = async (id, action) => {
    try {
      const res = await updateStudentSemester(id, action);
      const updatedData = res?.data || res;
      setAllUsers((prev) =>
        prev.map((u) =>
          u._id === id
            ? { ...u, semester: updatedData.semester, subjects: updatedData.subjects }
            : u,
        ),
      );
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Semester updated ✅` }));
    } catch (err) {
      console.error(`Error updating semester:`, err);
      const msg = err.response?.data?.message || `Failed to update semester.`;
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const handleBulkUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ✅ Validate file type client-side before sending
    const ALLOWED_TYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    const isValidType = ALLOWED_TYPES.includes(file.type) || file.name.endsWith('.csv');
    const MAX_SIZE_MB = 5;

    if (!isValidType) {
      setUploadError("Only CSV files are allowed.");
      event.target.value = null;
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`File size must be under ${MAX_SIZE_MB}MB.`);
      event.target.value = null;
      return;
    }

    setUploadError("");
    setUploadResult(null);
    setUploading(true);

    try {
      const res = await bulkUploadUsers(file);
      const result = res?.data || res;
      
      if (!isMounted.current) return;
      setUploadResult(result);
      setError("");
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Bulk upload complete ✅" }));
      
      const refreshController = new AbortController();
      await fetchUsers({}, refreshController.signal);
    } catch (err) {
      console.error("Bulk upload failed:", err);
      if (!isMounted.current) return;
      const msg = err.response?.data?.message || "Bulk upload failed. Please check the CSV and try again.";
      setUploadError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      if (isMounted.current) setUploading(false);
      event.target.value = null;
    }
  };

  const approveUser = (id) => updateStatus(id, "Approved");
  const blockUser = (id) => updateStatus(id, "Blocked");

  const rejectUser = (id) => {
    setRejectModal({ open: true, targetId: id, bulk: false, reason: "" });
  };

  const confirmReject = () => {
    if (!rejectModal.reason.trim()) return;
    if (rejectModal.bulk) bulkUpdateStatus("Rejected", rejectModal.reason);
    else updateStatus(rejectModal.targetId, "Rejected", rejectModal.reason);
    setRejectModal({ open: false, targetId: null, bulk: false, reason: "" });
  };

  const toggleSelectUser = (id) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((uId) => uId !== id) : [...prev, id],
    );
  };

  const canManage = (targetUser) => {
    if (!user || !targetUser) return false;
    if (String(user._id) === String(targetUser._id)) return false; // Prevent managing oneself
    if (user.role === "Admin") return true; // Admins can manage everyone else
    if (user.role === "HOD")
      return targetUser.role === "Student" || targetUser.role === "Teacher";
    if (user.role === "Teacher")
      return targetUser.role === "Student";
    return false;
  };

  const canBlockTarget = (targetUser) => {
    if (user?.role === "Teacher" && targetUser?.role === "Teacher")
      return false;
    return true;
  };

  // Filter locally by status
  const statusFilteredUsers =
    statusFilter === "All"
      ? allUsers
      : allUsers.filter((u) => u.status === statusFilter);

  // Advanced multi-term keyword searching across all deep contextual properties
  const filteredUsers = statusFilteredUsers.filter((u) => {
    if (!searchQuery) return true;
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    const searchables = [
      u.name,
      getPrimaryEmail(u),
      u.role,
      u.department?.name,
      u.semester ? `semester ${u.semester} sem ${u.semester}` : "",
      u.rollNumber ? `roll ${u.rollNumber}` : "",
      u.subjects ? u.subjects.map((s) => s.name).join(" ") : "",
      u.subjects
        ? "subject " + u.subjects.map((s) => s.name).join(" subject ")
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // ✅ Use word-boundary aware matching with a regex
    const matchesTerm = (haystack, term) => {
      try {
        return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack);
      } catch { return haystack.includes(term); }
    };

    return terms.every((term) => matchesTerm(searchables, term));
  });

  const toggleSelectAll = () => {
    const manageableUsers = filteredUsers.filter(canManage).map((u) => u._id);
    const allSelected =
      manageableUsers.length > 0 &&
      manageableUsers.every((id) => selectedUsers.includes(id));

    if (allSelected) {
      setSelectedUsers((prev) =>
        prev.filter((id) => !manageableUsers.includes(id)),
      );
    } else {
      setSelectedUsers((prev) => [...new Set([...prev, ...manageableUsers])]);
    }
  };

  const bulkUpdateStatus = async (newStatus, reason = null) => {
    if (selectedUsers.length === 0) return;
    try {
      await bulkUpdateUserStatus(selectedUsers, newStatus, reason);
      setAllUsers((prev) =>
        prev.map((u) => {
          if (!selectedUsers.includes(u._id)) return u;
          const updated = { ...u, status: newStatus };
          if (newStatus === "Rejected") {
            updated.rejectionReason = reason;
          }
          return updated;
        }),
      );
      setSelectedUsers([]);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Bulk status update complete ✅` }));
    } catch (err) {
      console.error(`Error bulk updating to ${newStatus}:`, err);
      const msg = `Failed to process bulk action.`;
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const bulkUpdateSemester = async (action) => {
    if (selectedUsers.length === 0) return;

    const selectedUsersData = allUsers.filter((u) =>
      selectedUsers.includes(u._id),
    );
    if (selectedUsersData.some((u) => u.role !== "Student")) {
      setError("Semester updates can only be applied to Students.");
      return;
    }

    try {
      const res = await bulkUpdateUserSemester(selectedUsers, action);
      const result = res?.data || res;
      const results = result?.results || [];

      setAllUsers((prev) =>
        prev.map((u) => {
          if (selectedUsers.includes(u._id) && u.role === "Student") {
            const updated = results.find((r) => String(r.userId) === String(u._id));
            if (updated) {
              return {
                ...u,
                semester: updated.semester,
                subjects: updated.subjects,
              };
            }
          }
          return u;
        }),
      );
      setSelectedUsers([]);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Bulk semester update complete ✅` }));
    } catch (err) {
      console.error(`Error bulk updating semester:`, err);
      const msg = `Failed to process bulk semester update.`;
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const bulkApprove = () => bulkUpdateStatus("Approved");
  const bulkBlock = () => bulkUpdateStatus("Blocked");
  const bulkReject = () => {
    setRejectModal({ open: true, targetId: null, bulk: true, reason: "" });
  };

  // ✅ Derive bulk action eligibility only from the currently visible filtered set
  const selectedAndVisible = filteredUsers.filter((u) => selectedUsers.includes(u._id));
  const hasPendingSelected = selectedAndVisible.some((u) => u.status === "Pending");
  const hasApprovedSelected = selectedAndVisible.some((u) => u.status === "Approved");
  const hasBlockedSelected = selectedAndVisible.some((u) => u.status === "Blocked");
  const allStudentsSelected = selectedAndVisible.length > 0 && selectedAndVisible.every((u) => u.role === "Student");

  return (
    <div className="w-full mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-indigo-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <Users className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            User Management
          </h1>
          <p className="text-blue-100 mt-2 text-base md:text-lg font-medium max-w-xl">
            Review registrations, manage statuses, and quickly update academic
            semesters.
          </p>
        </div>
      </div>

      {allUsers.length > 0 && <ErrorAlert message={error} />}

      {/* Filter Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-black/5 dark:bg-white/5 p-4 rounded-xl shadow-sm border border-inherit/30 backdrop-blur-sm transition-colors">
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {allUsers.length > 0 && (
            <button
              onClick={() => setStatusFilter("All")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                statusFilter === "All"
                  ? `${getPrimaryButtonClasses(appTheme)}`
                  : "bg-transparent text-inherit border border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              All
            </button>
          )}
          {allUsers.some((u) => u.status === "Pending") && (
            <button
              onClick={() => setStatusFilter("Pending")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                statusFilter === "Pending"
                  ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30"
                  : "bg-transparent text-inherit border border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <UserCheck className="w-4 h-4 inline mr-2" />
              Pending
            </button>
          )}
          {allUsers.some((u) => u.status === "Approved") && (
            <button
              onClick={() => setStatusFilter("Approved")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                statusFilter === "Approved"
                  ? "bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30"
                  : "bg-transparent text-inherit border border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Approved
            </button>
          )}
          {allUsers.some((u) => u.status === "Rejected") && (
            <button
              onClick={() => setStatusFilter("Rejected")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                statusFilter === "Rejected"
                  ? "bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30"
                  : "bg-transparent text-inherit border border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <UserX className="w-4 h-4 inline mr-2" />
              Rejected
            </button>
          )}
          {allUsers.some((u) => u.status === "Blocked") && (
            <button
              onClick={() => setStatusFilter("Blocked")}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${
                statusFilter === "Blocked"
                  ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30"
                  : "bg-transparent text-inherit border border-inherit/30 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Blocked
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Smart search (e.g. 'sem 4', 'english')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-inherit/30 focus:ring-2 focus:ring-current outline-none text-sm text-inherit bg-transparent"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-inherit/30 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-inherit bg-black/5 dark:bg-white/5"
          >
          <option value="" className={getOptionClasses(appTheme, isDark)}>All Roles</option>
          <option value="Student" className={getOptionClasses(appTheme, isDark)}>Student</option>
          <option value="Teacher" className={getOptionClasses(appTheme, isDark)}>Teacher</option>
          {(user?.role === "Admin" || user?.role === "HOD" || user?.role === "Teacher") && <option value="HOD" className={getOptionClasses(appTheme, isDark)}>HOD</option>}
          {user?.role === "Admin" && <option value="Admin" className={getOptionClasses(appTheme, isDark)}>Admin</option>}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        {(user?.role === "Admin" || user?.role === "HOD") && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="bulkUploadFile"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all shadow-sm cursor-pointer ${getPrimaryButtonClasses(appTheme)}`}
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </label>
            <input
              id="bulkUploadFile"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleBulkUpload}
              disabled={uploading}
            />
            {uploading && (
              <span className="text-sm text-blue-600 dark:text-blue-300">Uploading...</span>
            )}
          </div>
        )}

        {uploadResult && (
          <div className="w-full md:w-auto rounded-xl border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 p-3 text-sm shadow-sm font-medium">
            Bulk upload completed: {uploadResult.summary?.createdCount || 0} created, {uploadResult.summary?.updatedCount || 0} updated.
            {uploadResult.summary?.errors?.length > 0 && (
              <div className="mt-2">
                <strong>Errors:</strong>
                <ul className="list-disc list-inside mt-1 text-xs text-red-700">
                  {uploadResult.summary.errors.slice(0, 3).map((err, idx) => (
                    <li key={idx}>{`Row ${Number(err.row) || '?'}: ${String(err.message || 'Unknown error').slice(0, 120)}`}</li>
                  ))}
                  {uploadResult.summary.errors.length > 3 && (
                    <li>And {uploadResult.summary.errors.length - 3} more.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <div className="w-full md:w-auto rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 p-3 text-sm shadow-sm font-medium">
            {uploadError}
          </div>
        )}
      </div>

      {/* Mass Update & Bulk Actions UI */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl shadow-sm border mt-4 mb-4 transition-all ${getCardThemeClasses(appTheme)}`}>
          <div className="flex items-center gap-3">
            {(() => {
              const manageableVisibleUsers = filteredUsers.filter(canManage);
              const isAllManageableVisibleSelected =
                manageableVisibleUsers.length > 0 &&
                manageableVisibleUsers.every((u) =>
                  selectedUsers.includes(u._id),
                );
              return (
                <input
                  type="checkbox"
                  checked={isAllManageableVisibleSelected}
                  onChange={toggleSelectAll}
                  disabled={manageableVisibleUsers.length === 0}
                  className="w-5 h-5 rounded text-current focus:ring-current cursor-pointer border-inherit/50"
                  id="selectAll"
                />
              );
            })()}
            <label
              htmlFor="selectAll"
              className="font-bold opacity-90 cursor-pointer flex items-center gap-2"
            >
              Select All Manageable
            </label>
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 animate-in fade-in zoom-in-95 duration-300 mt-4 md:mt-0 w-full md:w-auto">
              <span className={`font-bold px-3 py-1.5 rounded-full text-sm shadow-sm flex items-center gap-2 shrink-0 ${getPrimaryButtonClasses(appTheme)}`}>
                <Users className="w-4 h-4" /> {selectedUsers.length} Selected
              </span>

              <div className="flex flex-wrap items-center gap-2 bg-black/5 dark:bg-white/5 p-1.5 rounded-lg shadow-sm border border-inherit/30 w-full sm:w-auto">
                <span className="text-xs font-bold opacity-60 uppercase tracking-wider ml-2 mr-1 hidden sm:block">
                  Mass Update:
                </span>

                {hasPendingSelected && (
                  <>
                    <button
                      onClick={bulkApprove}
                      className="bg-green-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-600 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={bulkReject}
                      className="bg-red-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-600 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {hasApprovedSelected &&
                  selectedAndVisible
                    .filter((u) => u.status === "Approved")
                    .every(canBlockTarget) && (
                    <button
                      onClick={bulkBlock}
                      className="bg-orange-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-orange-600 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Lock className="w-4 h-4" /> Block
                    </button>
                  )}
                {hasBlockedSelected &&
                  selectedAndVisible
                    .filter((u) => u.status === "Blocked")
                    .every(canBlockTarget) && (
                    <button
                      onClick={bulkApprove}
                      className="bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-600 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Unlock className="w-4 h-4" /> Unblock
                    </button>
                  )}
                {allStudentsSelected && (
                  <>
                    <div className="w-px h-6 bg-current opacity-30 mx-1 hidden sm:block"></div>
                    <button
                      onClick={() => bulkUpdateSemester("increment")}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                      title="Mass Increase Semester"
                    >
                      <Plus className="w-4 h-4" /> Sem
                    </button>
                    <button
                      onClick={() => bulkUpdateSemester("decrement")}
                      className="bg-black/10 dark:bg-white/10 text-inherit border border-inherit/30 px-3 py-1.5 rounded-md text-sm font-bold hover:bg-black/20 dark:hover:bg-white/20 flex items-center gap-1.5 transition-colors"
                      title="Mass Decrease Semester"
                    >
                      <Minus className="w-4 h-4" /> Sem
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users List */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error && allUsers.length === 0 ? (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 p-6 rounded-xl flex flex-col items-center justify-center gap-3 shadow-sm animate-in fade-in text-center">
          <AlertCircle className="w-8 h-8 shrink-0 text-inherit" />
          <p className="font-medium text-base">{error}</p>
        </div>
      ) : allUsers.length === 0 ? (
        <EmptyState icon={Users} title="No users found." className="my-8" />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No users match your search or filters."
          className="my-8"
        />
      ) : (
        <div className="overflow-y-auto max-h-[70vh] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full flex flex-col gap-4 pr-1">
          {filteredUsers.map((u) => {
            const manageable = canManage(u);
            return (
              <UserCard
                key={u._id}
                user={u}
                to={`/dashboard?userId=${u._id}`}
                avatarSize="w-12 h-12 text-lg"
                className={`p-4 ${selectedUsers.includes(u._id) ? "border-blue-400 ring-1 ring-blue-100" : ""}`}
                leftElement={
                  manageable && (
                    <div className="flex items-center justify-center pl-1 pr-2 shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u._id)}
                        onChange={() => toggleSelectUser(u._id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  )
                }
                subtitle={
                  <>
                    <span className="block text-inherit opacity-70 text-sm truncate">
                      {getPrimaryEmail(u)}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">{u.role}</span>
                      <StatusBadge status={u.status} />
                    </div>
                    {u.department && (
                      <div className="text-inherit opacity-60 text-xs mt-1.5 flex items-center flex-wrap gap-1 whitespace-normal">
                        <span>Department: {u.department.name}</span>
                        {u.semester && <span> • Sem {u.semester}</span>}
                        {u.rollNumber ? ` • Roll: ${u.rollNumber}` : ""}
                        {u.subjects?.length > 0
                          ? ` • Subjects: ${u.subjects.map((s) => `${s.name}`).join(", ")}`
                          : ""}
                      </div>
                    )}
                    {u.status === "Rejected" && u.rejectionReason && (
                      <p className="text-red-500 text-sm mt-2 font-medium">
                        <strong>Reason:</strong> {u.rejectionReason}
                      </p>
                    )}
                    {String(user?._id) === String(u._id) && (
                      <p className="text-blue-500 text-xs font-bold mt-2">
                        (This is your account)
                      </p>
                    )}
                  </>
                }
                rightElement={
                  <div
                    className="flex flex-col w-full sm:w-auto gap-2 rounded-lg shrink-0"
                    onClick={(e) => e.preventDefault()}
                  >
                    {manageable && u.role === "Student" && u.semester && (
                      <div className="flex w-full sm:w-auto justify-between sm:justify-center gap-2 bg-black/5 dark:bg-white/5 rounded-lg p-1 border border-inherit/30 shrink-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            updateSemester(u._id, "decrement");
                          }}
                          className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded text-inherit opacity-70 hover:opacity-100 transition-colors shadow-sm border border-inherit/30 flex-1 sm:flex-none flex items-center justify-center"
                          title="Decrease Semester"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className="flex items-center justify-center px-2">
                           <UniversalBadge text={`Sem ${u.semester}`} className="bg-transparent border-none shadow-none text-sm" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            updateSemester(u._id, "increment");
                          }}
                          className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded text-inherit opacity-70 hover:opacity-100 transition-colors shadow-sm border border-inherit/30 flex-1 sm:flex-none flex items-center justify-center"
                          title="Increase Semester"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {canManage(u) && manageable && (
                      <>
                        {u.status === "Pending" && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                approveUser(u._id);
                              }}
                              className="flex-1 sm:flex-none border border-green-500/50 hover:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span className="ml-1.5">
                                Approve
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                rejectUser(u._id);
                              }}
                              className="flex-1 sm:flex-none border border-red-500/50 hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                              <XCircle className="w-4 h-4" />
                              <span className="ml-1.5">
                                Reject
                              </span>
                            </button>
                          </div>
                        )}
                        {u.status === "Approved" && canBlockTarget(u) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              blockUser(u._id);
                            }}
                            className="w-full sm:w-auto border border-orange-500/50 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <Lock className="w-4 h-4" />
                            <span className="ml-1.5">Block</span>
                          </button>
                        )}
                        {u.status === "Blocked" && canBlockTarget(u) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              approveUser(u._id);
                            }}
                            className="w-full sm:w-auto border border-green-500/50 hover:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center p-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            <Unlock className="w-4 h-4" />
                            <span className="ml-1.5">Unblock</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {/* Reject Modal Overlay */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 border border-inherit/30 ${getCardThemeClasses(appTheme)} animate-in zoom-in-95 duration-200`}>
            <h3 className="font-bold text-lg text-inherit flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Reason for Rejection
            </h3>
            <textarea
              className="w-full border border-inherit/30 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-black/5 dark:bg-white/5 text-inherit"
              rows={3}
              placeholder="Enter rejection reason..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal(p => ({ ...p, reason: e.target.value }))}
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-2">
              <button onClick={() => setRejectModal(p => ({ ...p, open: false }))}
                className="px-4 py-2 rounded-lg border border-inherit/30 font-semibold text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit transition-colors">Cancel</button>
              <button onClick={confirmReject} disabled={!rejectModal.reason.trim()}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-50 transition-colors shadow-sm">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
