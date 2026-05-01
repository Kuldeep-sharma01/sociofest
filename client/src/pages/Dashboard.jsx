// /pages/Dashboard.jsx
import React, { useEffect, useState } from "react";

import { useSelector } from "react-redux";
import { useSearchParams, useLocation, Navigate } from "react-router-dom";

import { useTheme } from "@/context/ThemeContext";
import { canViewOtherDashboard } from "@/utils/roleUtils";
// Import the actual, full-featured dashboard components
import AdminDashboard from "./dashboards/AdminDashboard";
import StudentDashboard from "./dashboards/StudentDashboard";
import HODDashboard from "./dashboards/HODDashboard";
import TeacherDashboard from "./dashboards/TeacherDashboard";
import SellerDashboard from "./dashboards/SellerDashboard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { getUserById } from "@/services/userService";

export const Dashboard = () => {
  const user = useSelector((state) => state.auth.user);
  const { appTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const targetUserId = searchParams.get("userId");

  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    if (targetUserId && targetUserId !== user?._id) {
      setLoading(true);
      getUserById(targetUserId)
        .then((data) => setTargetUser(data))
        .catch((err) => {
          console.error("Failed to load target user", err);
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to load requested user profile. ❌" }));
        })
        .finally(() => setLoading(false));
    } else {
      setTargetUser(null);
    }
  }, [targetUserId, user]);

  if (loading) {
    return location.pathname === '/' ? null : (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (!user) {
    return location.pathname === '/' ? null : (
      <Navigate to="/login" state={{ from: location }} replace />
    );
  }

  const activeUser = targetUser || user;
  const isViewingOther = !!targetUser && targetUser._id !== user._id;

  // Restrict access to other users' dashboards based on hierarchical roles
  if (isViewingOther && !canViewOtherDashboard(user.role, activeUser.role)) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center">
        <h2 className="text-3xl font-bold text-red-500">Access Denied</h2>
        <p className="text-inherit opacity-70 font-medium">
          You do not have permission to view this dashboard.
        </p>
      </div>
    );
  }

  switch (activeUser.role) {
    case "Admin":
      return (
        <AdminDashboard
          userId={activeUser._id}
          isViewingOther={isViewingOther}
          targetUser={activeUser}
        />
      );
    case "HOD":
      return (
        <HODDashboard
          userId={activeUser._id}
          isViewingOther={isViewingOther}
          targetUser={activeUser}
        />
      );
    case "Teacher":
      return (
        <TeacherDashboard
          userId={activeUser._id}
          isViewingOther={isViewingOther}
          targetUser={activeUser}
        />
      );
    case "Student":
      return (
        <StudentDashboard
          userId={activeUser._id}
          isViewingOther={isViewingOther}
          targetUser={activeUser}
        />
      );
    case "Seller":
      return (
        <SellerDashboard
          userId={activeUser._id}
          isViewingOther={isViewingOther}
          targetUser={activeUser}
        />
      );
    default :
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold">Error</h1>
          <p>No dashboard is available for your user role.</p>
        </div>
      );
  }
};

export default Dashboard;
