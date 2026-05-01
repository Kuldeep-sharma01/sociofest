import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle,
  Mail,
  Building2,
  Award,
  Briefcase,
  Edit,
  Camera,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser as updateAuthUser } from "@/redux/authSlice";
import {
  getTeacherProfile,
  updateUserProfile,
  getDepartmentHODKeys,
} from "@/services/userService";
import { getTeacherOverview } from "@/services/statsService";
import useQuizLeaderboard from "@/hooks/useQuizLeaderboard";
import UserApprovalList from "../UserApprovalList";
import SubjectPage from "../SubjectPage";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TeacherInsights from "@/components/dashboard/TeacherInsights";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmailManager from "@/components/settings/EmailManager";
import InfoItem from "@/components/ui/InfoItem";
import { useTheme } from "@/context/ThemeContext";
import Signup from "@/pages/Signup";
import { getCardThemeClasses } from "@/utils/themeUtils";

const TeacherDashboard = ({ userId, isViewingOther, targetUser }) => {
  const authUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const activeUserId = userId || authUser?._id;
  const activeUserObj = targetUser || authUser;
  const navigate = useNavigate();
  const { appTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null); // For the user object inside profile

  // Edit mode state, adapted from UserProfile.jsx
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Stats State
  const [quizStats, setQuizStats] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const {
    leaderboard,
    page: leaderboardPage,
    setPage: setLeaderboardPage,
    totalPages: leaderboardTotalPages,
  } = useQuizLeaderboard(selectedQuiz);
  const [totalSemesters, setTotalSemesters] = useState(0);

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const [profileRes, overviewRes] = await Promise.all([
          getTeacherProfile(activeUserId),
          getTeacherOverview(isViewingOther ? activeUserId : null).catch(
            () => ({ quizStats: [] }),
          ),
        ]);

        setProfile(profileRes || null);
        setDetails(profileRes?.user || null);

        const stats = overviewRes?.quizStats || [];
        setQuizStats(stats);
        if (stats.length > 0) {
          setSelectedQuiz(stats[0]);
        }

        if (profileRes?.user?.department?.name) {
          // Fetch department config asynchronously to prevent dashboard blocking
          getDepartmentHODKeys(profileRes.user.department.name)
            .then((res) => setTotalSemesters(Number(res.Semesters)))
            .catch(() => setTotalSemesters(0));
        }
      } catch (err) {
        console.error("Error fetching teacher data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (activeUserId) {
      fetchTeacherData();
    } else {
      setLoading(false);
    }
  }, [activeUserId, refreshKey]);

  const hodDept = authUser?.department?._id || authUser?.department;
  const targetDept =
    activeUserObj?.department?._id || activeUserObj?.department;
  const isSameDept =
    hodDept && targetDept && String(hodDept) === String(targetDept);
  const canEdit =
    !isViewingOther ||
    authUser?.role === "Admin" ||
    (authUser?.role === "HOD" && isSameDept);

  const handleUpdateProfile = async (payload) => {
    setUpdating(true);
    try {
      const data = await updateUserProfile(activeUserId, payload);

      if (!isViewingOther) {
        dispatch(updateAuthUser(data.user));
      }

      setDetails(data.user);
      setProfile((prev) => ({ ...prev, user: data.user, ...data }));

      setIsEditing(false);
      setRefreshKey((k) => k + 1);
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
    setDetails(updatedUser);
    setProfile((prev) => ({ ...prev, user: updatedUser }));
    if (!isViewingOther) {
      dispatch(updateAuthUser(updatedUser));
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col">
        <Signup
          isEditMode={true}
          initialData={profile}
          onSave={handleUpdateProfile}
          onCancel={() => setIsEditing(false)}
          isUpdating={updating}
        />
        <div className="max-w-xl mx-auto w-full px-4 sm:px-6 mb-10 mt-4">
          <div className="bg-black/5 dark:bg-white/5 p-6 rounded-xl shadow-sm border border-inherit/30">
            <EmailManager user={details} setUser={handleEmailUpdate} />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  const teacherData = profile?.teacherData || details?.teacherData || profile || {};

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
      <DashboardHeader
        icon={Briefcase}
        title={
          isViewingOther
            ? `${activeUserObj?.name}'s Dashboard`
            : `Welcome back, ${activeUserObj?.name?.split(" ")[0] || "Teacher"}! 🎓`
        }
        subtitle={
          isViewingOther
            ? "Here is a snapshot of their teaching activities and assignments."
            : "Manage your courses, track student progress, and review your impact."
        }
        gradientClass="from-blue-600 to-indigo-700"
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
              <span className="hidden sm:inline ">Manage Attendance</span>
            </button>
            <button
              onClick={() => navigate("/ai-hub?settings=true")}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline ">Set AI API</span>
            </button>
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
              >
                <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem
            icon={UserCircle}
            label="Full Name"
            value={details?.name}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Mail}
            label="Email"
            value={details?.email}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Building2}
            label="Department"
            value={details?.department?.name}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Award}
            label="Qualifications"
            value={teacherData?.qualifications}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Briefcase}
            label="Experience"
            value={teacherData?.experience ? `${teacherData.experience} years` : "N/A"}
            colorClass="text-current opacity-80"
          />
          {details?.location && (
            <InfoItem
              icon={MapPin}
              label="Location"
              value={details.location}
              colorClass="text-current opacity-80"
            />
          )}
        </div>
      </div>

      {!isEditing && profile?.subjects && (
        <div className="mt-6 relative z-0">
          <SubjectPage embedded={true} targetUser={activeUserObj} />
        </div>
      )}

      <div className="flex flex-col">
        <TeacherInsights
          quizStats={quizStats}
          selectedQuiz={selectedQuiz}
          setSelectedQuiz={setSelectedQuiz}
          leaderboard={leaderboard}
        />
        {leaderboardTotalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-4">
            <button
              onClick={() => setLeaderboardPage((p) => Math.max(1, p - 1))}
              disabled={leaderboardPage === 1}
              className="px-4 py-2 bg-black/5 dark:bg-white/5 text-inherit rounded-lg shadow-sm border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-inherit opacity-80">
              Page {leaderboardPage} of {leaderboardTotalPages}
            </span>
            <button
              onClick={() =>
                setLeaderboardPage((p) =>
                  Math.min(leaderboardTotalPages, p + 1),
                )
              }
              disabled={leaderboardPage === leaderboardTotalPages}
              className="px-4 py-2 bg-black/5 dark:bg-white/5 text-inherit rounded-lg shadow-sm border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <UserApprovalList />
    </div>
  );
};

export default TeacherDashboard;
