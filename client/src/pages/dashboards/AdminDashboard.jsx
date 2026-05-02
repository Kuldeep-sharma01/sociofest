import React, { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";
import {
  Users,
  FileQuestion,
  CalendarDays,
  ShieldCheck,
  UserCircle,
  Mail,
  Settings,
  Edit,
  Sparkles,
  Camera,
  MapPin,
  Phone,
  Calendar,
  Award,
  Briefcase,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser as updateAuthUser } from "@/redux/authSlice";
import { updateUserProfile } from "@/services/userService";
import UserApprovalList from "../UserApprovalList";
import SubjectPage from "../SubjectPage";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import RoleDistributionChart from "@/components/dashboard/RoleDistributionChart";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useTheme } from "@/context/ThemeContext";
import InfoItem from "@/components/ui/InfoItem";
import EmailManager from "@/components/settings/EmailManager";
import Signup from "@/pages/Signup";
import { getCardThemeClasses, getOptionClasses } from "@/utils/themeUtils";
import adminService from "@/services/adminService";

const AdminDashboard = ({ userId, isViewingOther, targetUser }) => {
  const authUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeUserId = userId || authUser?._id;
  const activeUserObj = targetUser || authUser;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [ffmpegConfig, setFfmpegConfig] = useState({
    maxBuffer: 1073741824,
    preset: "ultrafast",
    crf: "28",
    timeout: 0,
    enableHls: true,
  });
  const [configLoading, setConfigLoading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);

  const [updating, setUpdating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { appTheme, isDark } = useTheme();

  const canEdit = !isViewingOther || authUser?.role === "Admin";

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const statsData = await adminService.getSystemStats();
        setStats(statsData);
        const configData = await adminService.getFfmpegConfig();
        setFfmpegConfig(configData);
      } catch (err) {
        console.error("Error loading admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    if (activeUserId) fetchAdminData();
  }, [activeUserId, refreshKey]);

  const handleUpdateProfile = async (payload) => {
    setUpdating(true);
    try {
      const data = await updateUserProfile(activeUserId, payload);
      if (!isViewingOther) {
        dispatch(updateAuthUser(data.user));
      }
      setRefreshKey((k) => k + 1);
      setIsEditing(false);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Profile updated successfully! 🎉",
        }),
      );
    } catch (err) {
      console.error("Error updating profile:", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to update profile. ❌",
        }),
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleEmailUpdate = (updatedUser) => {
    if (!isViewingOther) {
      dispatch(updateAuthUser(updatedUser));
    }
  };

  if (loading)
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <LoadingSkeleton count={3} />
      </div>
    );

  if (isEditing) {
    return (
      <div className="flex flex-col">
        <Signup
          isEditMode={true}
          initialData={{ user: activeUserObj }}
          onSave={handleUpdateProfile}
          onCancel={() => setIsEditing(false)}
          isUpdating={updating}
        />
        <div className="max-w-xl mx-auto w-full px-4 sm:px-6 mb-10 mt-4">
          <div
            className={`p-6 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <EmailManager user={activeUserObj} setUser={handleEmailUpdate} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
      <DashboardHeader
        icon={ShieldCheck}
        title={
          isViewingOther
            ? `${activeUserObj?.name}'s Dashboard`
            : `Welcome back, ${activeUserObj?.name?.split(" ")[0] || "Admin"}! 🛠️`
        }
        subtitle={
          isViewingOther
            ? "Review their administrative oversight details."
            : "Manage the entire SocioFest ecosystem efficiently from your command center."
        }
        gradientClass="from-slate-800 to-gray-900"
      />

      <div
        className={`p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
            <UserCircle className="text-current opacity-80 w-7 h-7" /> Profile Details
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/dashboard/attendance")}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
            >
              <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline ">Attendance System</span>
            </button>
            <button
              onClick={() => navigate("/ai-hub?settings=true")}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline">Set AI API</span>
            </button>
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
              >
                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline ">Edit Profile</span>
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <InfoItem
            icon={UserCircle}
            label="Full Name"
            value={activeUserObj?.name}
            colorClass="text-inherit opacity-80"
          />
          <InfoItem
            icon={Mail}
            label="Email"
            value={activeUserObj?.email}
            colorClass="text-inherit opacity-80"
          />
          {activeUserObj?.location && (
            <InfoItem
              icon={MapPin}
              label="Location"
              value={activeUserObj.location}
              colorClass="text-inherit opacity-80"
            />
          )}
          {activeUserObj?.contactNumber && (
            <InfoItem
              icon={Phone}
              label="Contact"
              value={activeUserObj.contactNumber}
              colorClass="text-inherit opacity-80"
            />
          )}
          {activeUserObj?.dob && (
            <InfoItem
              icon={Calendar}
              label="Birthday"
              value={new Date(activeUserObj.dob).toLocaleDateString()}
              colorClass="text-inherit opacity-80"
            />
          )}
        </div>
        {activeUserObj?.bio && (
          <div className="mt-4 pt-4 border-t border-inherit/30">
            <h4 className="text-sm font-bold opacity-80 mb-1 text-inherit">Bio</h4>
            <p className="text-inherit font-medium">{activeUserObj.bio}</p>
          </div>
        )}
        {activeUserObj?.skills?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-inherit/30">
            <h4 className="text-sm font-bold opacity-80 mb-2 text-inherit">Skills</h4>
            <div className="flex flex-wrap gap-2">
              {activeUserObj.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit text-sm font-medium rounded-full">{skill}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statistics Overview */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoItem
          icon={Users}
          label="Total Students"
          value={stats.students || 0}
          colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
        />
        <InfoItem
          icon={ShieldCheck}
          label="Total Teachers"
          value={stats.teachers || 0}
          colorClass="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
        />
        <InfoItem
          icon={FileQuestion}
          label="Total Quizzes"
          value={stats.quizzes || 0}
          colorClass="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
        />
        <InfoItem
          icon={CalendarDays}
          label="Upcoming Events"
          value={stats.events || 0}
          colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
        />
      </section>

      {/* FFmpeg Config Section */}
      {!isViewingOther && (
        <section
          className={`mt-8 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-inherit">
                Media Engine Configuration
              </h2>
              <p className="text-sm text-inherit opacity-70">
                Dynamically adjust backend video processing limits. Changes take
                effect immediately without server restart.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 text-inherit">
                Max Buffer Size (Bytes)
              </label>
              <input
                type="number"
                value={ffmpegConfig.maxBuffer}
                onChange={(e) =>
                  setFfmpegConfig({
                    ...ffmpegConfig,
                    maxBuffer: parseInt(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-red-500 outline-none"
              />
              <p className="text-xs opacity-60 mt-1">
                Default: 1073741824 (1GB). Prevents crashes on massive 4K files.
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 text-inherit">
                Processing Preset
              </label>
              <select
                value={ffmpegConfig.preset}
                onChange={(e) =>
                  setFfmpegConfig({ ...ffmpegConfig, preset: e.target.value })
                }
                className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-black/5 dark:bg-white/5 text-inherit"
              >
                <option
                  value="ultrafast"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Ultrafast (Best for Web Servers)
                </option>
                <option
                  value="superfast"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Superfast
                </option>
                <option
                  value="veryfast"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Veryfast
                </option>
                <option
                  value="fast"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Fast
                </option>
                <option
                  value="medium"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Medium (Better compression, slower)
                </option>
                <option
                  value="slow"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Slow
                </option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 text-inherit">
                CRF (Quality)
              </label>
              <input
                type="number"
                value={ffmpegConfig.crf}
                onChange={(e) =>
                  setFfmpegConfig({ ...ffmpegConfig, crf: e.target.value })
                }
                className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-red-500 outline-none"
              />
              <p className="text-xs opacity-60 mt-1">
                Default: 28. Lower is higher quality. Range: 0-51.
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 text-inherit">
                Timeout Limit (ms)
              </label>
              <input
                type="number"
                value={ffmpegConfig.timeout}
                onChange={(e) =>
                  setFfmpegConfig({
                    ...ffmpegConfig,
                    timeout: parseInt(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-red-500 outline-none"
              />
              <p className="text-xs opacity-60 mt-1">
                Default: 0 (No timeout). Set to kill stuck processes.
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 text-inherit">
                HLS Chunking & Streaming
              </label>
              <select
                value={ffmpegConfig.enableHls !== false ? "true" : "false"}
                onChange={(e) =>
                  setFfmpegConfig({
                    ...ffmpegConfig,
                    enableHls: e.target.value === "true",
                  })
                }
                className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-black/5 dark:bg-white/5 text-inherit"
              >
                <option
                  value="true"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Enabled (HLS + MP4 Fallback)
                </option>
                <option
                  value="false"
                  className={getOptionClasses(appTheme, isDark)}
                >
                  Disabled (Simple MP4 Upload Only)
                </option>
              </select>
              <p className="text-xs opacity-60 mt-1">
                Turn off to skip HLS processing and save CPU.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={async () => {
                setConfigLoading(true);
                try {
                  await adminService.updateFfmpegConfig(ffmpegConfig);
                  window.dispatchEvent(
                    new CustomEvent("showToast", {
                      detail: "Media Engine config updated! ⚙️",
                    }),
                  );
                } catch (e) {
                  window.dispatchEvent(
                    new CustomEvent("showToast", {
                      detail: "Failed to update config. ❌",
                    }),
                  );
                } finally {
                  setConfigLoading(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-sm"
            >
              {configLoading ? "Saving..." : "Save Engine Settings"}
            </button>
          </div>
        </section>
      )}

      {/* User Role Distribution Chart */}
      <section
        className={`mt-6 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <h2 className="text-xl font-bold mb-4 text-inherit">
          User Role Distribution
        </h2>
        <RoleDistributionChart stats={stats} />
      </section>

      {/* Subject Management Overview */}
      {!isViewingOther && (
        <section className="mt-8 relative z-0">
          <SubjectPage embedded={true} targetUser={activeUserObj} />
        </section>
      )}

      <UserApprovalList />
    </div>
  );
};

export default AdminDashboard;
