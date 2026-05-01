import React, { useEffect, useState } from "react";

import {
  UserCircle,
  Mail,
  Building2,
  GraduationCap,
  Hash,
  Edit,
  Camera,
  Phone,
  Calendar,
  MapPin,
  Sparkles
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "@/redux/authSlice";
import { getStudentProfile, updateUserProfile } from "@/services/userService";
import { getCertificatesByStudent, downloadCertificate } from "@/services/certificateService";
import { getStudentOverview } from "@/services/statsService";
import SubjectPage from "../SubjectPage";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StudentPerformance from "@/components/dashboard/StudentPerformance";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmailManager from "@/components/settings/EmailManager";
import InfoItem from "@/components/ui/InfoItem";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";
import Signup from "@/pages/Signup";

const StudentDashboard = ({ userId, isViewingOther, targetUser }) => {
  const authUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  const activeUserId = userId || authUser?._id;
  const activeUserObj = targetUser || authUser;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [details, setDetails] = useState(null); // For the user object inside profile
  const [quizHistory, setQuizHistory] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [events, setEvents] = useState([]);

  // Edit mode state, adapted from UserProfile.jsx
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { appTheme } = useTheme();

  useEffect(() => {
    const fetchStudentData = async () => {
      setLoading(true);
      try {
        const [profileRes, overviewRes, certsRes] = await Promise.all([
          getStudentProfile(activeUserId),
          getStudentOverview(isViewingOther ? activeUserId : null).catch(() => ({
            quizHistory: [],
            upcomingEvents: [],
          })),
          getCertificatesByStudent(activeUserId).catch(() => []),
        ]);

        setProfile(profileRes);
        setDetails(profileRes?.user);
        setQuizHistory(overviewRes?.quizHistory || []);
        setEvents(overviewRes?.upcomingEvents || []);
        setCertificates(certsRes || []);
      } catch (err) {
        console.error("Failed to load student dashboard data:", err);
      }
      setLoading(false);
    };

    if (activeUserId) {
      fetchStudentData();
    } else {
      setLoading(false);
    }
  }, [activeUserId, refreshKey]);

  // Handle hash scrolling
  useEffect(() => {
    if (!loading && location.hash) {
      setTimeout(() => {
        const id = location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [loading, location.hash]);

  // Securely download the Python-generated PDF using Axios and Auth Headers
  // This function is now correctly using the imported service
  const handleDownloadCertificate = async (certId, title) => {
    try {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Generating certificate... ⏳" }));
      await downloadCertificate(certId);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Certificate downloaded! 🎉" }),
      );
    } catch (err) {
      console.error("Certificate download failed:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to download certificate. ❌";

      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: errorMsg,
        }),
      );
    } finally {
      setUpdating(false);
    }
  };

  const hodDept = authUser?.department?._id || authUser?.department;
  const targetDept =
    activeUserObj?.department?._id || activeUserObj?.department;
  const isSameDept =
    hodDept && targetDept && String(hodDept) === String(targetDept);
  const canEdit =
    !isViewingOther ||
    authUser?.role === "Admin" ||
    ((authUser?.role === "HOD" || authUser?.role === "Teacher") && isSameDept);


  const handleUpdateProfile = async (payload) => {
    setUpdating(true);
    try {
      const data = await updateUserProfile(activeUserId, payload);

      if (!isViewingOther) {
        dispatch(updateUser(data.user));
      }

      // Refresh local state
      setDetails(data.user);
      setProfile(prev => ({ ...prev, user: data.user }));

      setIsEditing(false);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Profile updated successfully! 🎉" }));
    } catch (err) {
      console.error("Error updating profile:", err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to update profile. ❌",
        }),
      );
    }
  };

  const handleEmailUpdate = (updatedUser) => {
    setDetails(updatedUser);
    setProfile((prev) => ({ ...prev, user: updatedUser }));
    if (!isViewingOther) {
      dispatch(updateUser(updatedUser));
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

  const studentData = profile?.studentData || details?.studentData || profile || {};

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
      <DashboardHeader
        icon={GraduationCap}
        title={
          isViewingOther
            ? `${activeUserObj?.name}'s Dashboard`
            : `Welcome back, ${activeUserObj?.name?.split(" ")[0] || "Student"}! 🎓`
        }
        subtitle={
          isViewingOther
            ? "Explore their academic journey, achievements, and active courses."
            : "Here is your personal academic hub. Track your progress, courses, and upcoming events!"
        }
        gradientClass="from-blue-600 to-indigo-700"
      />

      {/* --- NEW Profile Header --- */}
      <div className={`p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
            <UserCircle className="text-current opacity-80 w-7 h-7" /> Profile Details
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/dashboard/attendance')} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95">
              <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline ">Smart Attendance</span>
            </button>
            <button onClick={() => navigate('/ai-hub?settings=true')} className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95">
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem icon={UserCircle} label="Full Name" value={details?.name} colorClass="text-current opacity-80" />
          <InfoItem icon={Mail} label="Email" value={details?.email} colorClass="text-current opacity-80" />
          <InfoItem icon={Building2} label="Department" value={details?.department?.name} colorClass="text-current opacity-80" />
          <InfoItem icon={GraduationCap} label="Semester" value={studentData?.semester} colorClass="text-current opacity-80" />
          <InfoItem icon={Hash} label="Roll Number" value={studentData?.rollNumber} colorClass="text-current opacity-80" />
          {details?.location && <InfoItem icon={MapPin} label="Location" value={details.location} colorClass="text-current opacity-80" />}
          {details?.contactNumber && <InfoItem icon={Phone} label="Contact" value={details.contactNumber} colorClass="text-current opacity-80" />}
          {details?.dob && <InfoItem icon={Calendar} label="Birthday" value={new Date(details.dob).toLocaleDateString()} colorClass="text-current opacity-80" />}
        </div>
        {details?.bio && (
          <div className="mt-4 pt-4 border-t border-inherit/30">
            <h4 className="text-sm font-bold opacity-80 mb-1 text-inherit">Bio</h4>
            <p className="text-inherit font-medium">{details.bio}</p>
          </div>
        )}
        {details?.skills?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-inherit/30">
            <h4 className="text-sm font-bold opacity-80 mb-2 text-inherit">Skills</h4>
            <div className="flex flex-wrap gap-2">
              {details.skills.map((skill, i) => (
                <span key={i} className="px-3 py-1 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit text-sm font-medium rounded-full">{skill}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* My Subjects Section */}
      {!isEditing && profile?.subjects && (
        <div id="subjects" className="relative z-0 scroll-mt-20">
          <SubjectPage embedded={true} targetUser={activeUserObj} />
        </div>
      )}

      <StudentPerformance
        quizHistory={quizHistory}
        certificates={certificates}
        events={events}
        handleDownloadCertificate={handleDownloadCertificate}
        loading={loading}
      />
    </div>
  );
};

export default StudentDashboard;
