import React, { useEffect, useState } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useNavigate } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";

import {
  UserCircle,
  Mail,
  Building2,
  ListTree,
  Clock,
  Trophy,
  Award,
  Briefcase, Edit, Camera, Sparkles
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser as updateAuthUser } from "@/redux/authSlice";
import { getHODProfile, updateUserProfile } from "@/services/userService";
import { getHODOverview, getTeacherOverview } from "@/services/statsService";
import useQuizLeaderboard from "@/hooks/useQuizLeaderboard";
import UserApprovalList from "../UserApprovalList";
import SubjectPage from "../SubjectPage";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TeacherInsights from "@/components/dashboard/TeacherInsights";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmailManager from "@/components/settings/EmailManager";
import InfoItem from "@/components/ui/InfoItem";
import Signup from "@/pages/Signup";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

const HODDashboard = ({ userId, isViewingOther, targetUser }) => {
  const authUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const activeUserId = userId || authUser?._id;
  const activeUserObj = targetUser || authUser;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null);
  const { appTheme } = useTheme();
  const canEdit = !isViewingOther;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // Stats and approvals state
  const [overview, setOverview] = useState(null);
  const [totalSemesters, setTotalSemesters] = useState(0);

  const [teacherQuizStats, setTeacherQuizStats] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const {
    leaderboard,
    page: leaderboardPage,
    setPage: setLeaderboardPage,
    totalPages: leaderboardTotalPages,
  } = useQuizLeaderboard(selectedQuiz);

  useEffect(() => {
    const fetchHODData = async () => {
      setLoading(true);
      try {
        const [profileRes, overviewRes, teacherOverviewRes] = await Promise.all(
          [
            getHODProfile(activeUserId),
            getHODOverview(isViewingOther ? activeUserId : null)
              .catch(() => ({ 
                teachers: 0,
                students: 0,
                quizCount: 0,
                totalSubmissions: 0,
                avgScore: 0,
              })),
            getTeacherOverview(isViewingOther ? activeUserId : null)
              .catch(() => ({ quizStats: [] })),
          ],
        );

        // Set profile state
        setProfile(profileRes);
        setDetails(profileRes?.user);

        // Set stats and approvals state
        setOverview(overviewRes);

        const stats = teacherOverviewRes?.quizStats || [];
        setTeacherQuizStats(stats);
        if (stats.length > 0) {
          setSelectedQuiz(stats[0]);
        }
      } catch (err) {
        console.error("Error fetching HOD data:", err);
      } finally {
        setLoading(false);
      }
    };
    if (activeUserId) {
      fetchHODData();
    } else {
      setLoading(false);
    }
  }, [activeUserId, refreshKey]);

  const handleUpdateProfile = async (payload) => {
    setUpdating(true);
    try {
      const data = await updateUserProfile(activeUserId, payload);

      if (!isViewingOther) {
        dispatch(updateAuthUser(data.user));
      }

      setDetails(data.user);
      setProfile(prev => ({ ...prev, user: data.user, ...data }));

      setIsEditing(false);
      setRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Profile updated successfully! 🎉" }));
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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (!overview || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-inherit opacity-70 font-medium">Failed to load HOD dashboard data.</p>
      </div>
    );
  }

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

  const barData = {
    labels: ["Teachers", "Students", "Quizzes", "Submissions"],
    datasets: [
      {
        label: "Counts",
        data: [
          overview.teachers,
          overview.students,
          overview.quizCount,
          overview.totalSubmissions,
        ],
        backgroundColor: ["#4e79a7", "#59a14f", "#f28e2b", "#e15759"],
      },
    ],
  };

  // Safely extract nested data if the backend saved it directly to the User object via strict: true
  const hodData = profile?.hodData || details?.hodData || profile || {};
  const teacherData = profile?.teacherData || details?.teacherData || profile || {};

  const pieData = {
    labels: ["Average Score", "Remaining"],
    datasets: [
      {
        data: [overview.avgScore, 100 - overview.avgScore],
        backgroundColor: ["#76b7b2", "#bab0ab"],
      },
    ],
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
      <DashboardHeader
        icon={Building2}
        title={
          isViewingOther
            ? `${activeUserObj?.name}'s Dashboard`
            : `Welcome back, ${activeUserObj?.name?.split(" ")[0] || "HOD"}! 🎓`
        }
        subtitle={
          isViewingOther
            ? "Review their department's performance and oversight metrics."
            : "Oversee department statistics, manage staff approvals, and review academic performance."
        }
        gradientClass="from-purple-600 to-indigo-800"
      />

      <div className={`p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
            <UserCircle className="text-current opacity-80 w-7 h-7" /> Profile Details
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/dashboard/attendance')} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95">
              <Camera className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Dept Attendance</span>
            </button>
            <button onClick={() => navigate('/ai-hub?settings=true')} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline">Set AI API</span>
            </button>
            {canEdit && (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95">
                <Edit className="w-4 h-4 text-blue-500" />
                <span className="hidden sm:inline ">Edit Profile</span>
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem icon={UserCircle} label="Full Name" value={details?.name} colorClass="text-current opacity-80" />
          <InfoItem icon={Mail} label="Email" value={details?.email} colorClass="text-current opacity-80" />
          <InfoItem icon={Building2} label="Department" value={details?.department?.name} colorClass="text-current opacity-80" />
          <InfoItem icon={ListTree} label="Dept Semesters" value={hodData?.semesters || "N/A"} colorClass="text-current opacity-80" />
          <InfoItem icon={Clock} label="Tenure" value={hodData?.tenure ? `${hodData.tenure} years` : "N/A"} colorClass="text-current opacity-80" />
          <InfoItem icon={Trophy} label="Achievements" value={hodData?.achievements || "N/A"} colorClass="text-current opacity-80" />
          <InfoItem icon={Award} label="Qualifications" value={teacherData?.qualifications || "N/A"} colorClass="text-current opacity-80" />
          <InfoItem icon={Briefcase} label="Experience" value={teacherData?.experience ? `${teacherData.experience} years` : "N/A"} colorClass="text-current opacity-80" />
        </div>
      </div>

      {/* Subject Management Section */}
      {!isEditing && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-0"> 
          <SubjectPage embedded={true} targetUser={activeUserObj} />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className={`lg:col-span-2 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
          <h2 className="text-xl font-bold mb-4 text-inherit">
            📌 Department Overview
          </h2>
          <Bar data={barData} />
        </div>
        <div className={`p-6 rounded-2xl shadow-sm border flex flex-col items-center justify-center transition-colors ${getCardThemeClasses(appTheme)}`}>
          <h2 className="text-xl font-bold mb-4 self-start text-inherit">
            📈 Average Quiz Score
          </h2>
          <div className="w-48 h-48">
            <Doughnut
              data={pieData}
              options={{ maintainAspectRatio: false, responsive: true }}
            />
          </div>
          <p className="text-lg font-medium mt-4">
            Avg Score: {overview.avgScore.toFixed(2)}%
          </p>
        </div>
      </div>

      {teacherQuizStats.length > 0 && (
        <div className="flex flex-col">
          <TeacherInsights
            quizStats={teacherQuizStats}
            selectedQuiz={selectedQuiz}
            setSelectedQuiz={setSelectedQuiz}
            leaderboard={leaderboard}
          />
          {leaderboardTotalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                disabled={leaderboardPage === 1}
                className="px-4 py-2 bg-black/5 dark:bg-white/5 text-inherit rounded-lg shadow-sm border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-inherit opacity-80">
                Page {leaderboardPage} of {leaderboardTotalPages}
              </span>
              <button
                onClick={() => setLeaderboardPage(p => Math.min(leaderboardTotalPages, p + 1))}
                disabled={leaderboardPage === leaderboardTotalPages}
                className="px-4 py-2 bg-black/5 dark:bg-white/5 text-inherit rounded-lg shadow-sm border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Approvals Section */}
      <UserApprovalList />
    </div>
  );
};

export default HODDashboard;
