// @refresh reset
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "@/redux/authSlice";
import {
  LayoutDashboard,
  Home,
  FileText,
  ClipboardList,
  User,
  MessageCircle,
  Bell,
  MonitorPlay,
  Bot,
  BellOff,
  Palette,
  Users,
  ShoppingBag,
  Code,
  BookImage,
  ClipboardCheck,
  BookOpen,
  UserCheck,
  Shield,
  Settings,
  Wifi,
  CreditCard,
  Camera,
  Activity,
  BrainCircuit,
  CheckSquare,
  Box
} from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import { useTheme, THEMES } from "@/context/ThemeContext";
import UniversalSidebar from "@/components/ui/UniversalSidebar";
import { getUnreadCount } from "@/services/chatService";
import { API_URL } from "@/config/constants";
import { updateUserProfile } from "@/services/userService";
import { getPublicSystemSettings } from "@/services/systemSettingsService";
import { getCardThemeClasses, getPrimaryButtonClasses, get3DCardClasses, getGlassyClasses } from "@/utils/themeUtils";

const Sidebar = ({ sidebar }) => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const socket = useSocket();
  const { appTheme, setAppTheme, is3DMode, toggle3DMode, isDark } = useTheme();
  const [unreadCounts, setUnreadCounts] = useState({
    chat: 0,
    notices: 0,
    activities: 0,
  });
  const [sysSettings, setSysSettings] = useState(null);
  const [navConfig, setNavConfig] = useState([]);

  const locationRef = useRef(location.pathname);
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Fetch Admin's dynamic navigation layout and feature toggles
    getPublicSystemSettings().then((s) => {
      if (s) {
        setSysSettings(s);
        if (s.navigationConfig) setNavConfig(s.navigationConfig);
      }
    }).catch(() => console.log("Using default nav order"));
  }, []);

  useEffect(() => {
    if (!user?._id || !socket) return;

    const fetchUnreadCount = async () => {
      try {
        const chatData = await getUnreadCount();
        setUnreadCounts((prev) => ({ ...prev, chat: chatData.count || 0 }));
        
        // Fetch unread system notifications for the Activities badge
        const notifsRes = await fetch(`${API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (notifsRes.ok) {
          const resData = await notifsRes.json();
          const allNotifs = Array.isArray(resData) ? resData : (resData.notifications || resData.data || []);
          
          // Filter: only count notifications that are NOT read and NOT dismissed
          const dismissed = JSON.parse(localStorage.getItem(`dismissed_notifs_${user._id}`)) || [];
          const unreadCount = allNotifs.filter(n => !n.isRead && !dismissed.includes(n._id)).length;
          
          setUnreadCounts((prev) => ({ ...prev, activities: unreadCount }));
        }

      } catch (err) {
        console.error("Failed to load sidebar unread count", err);
      }
    };

    fetchUnreadCount();
    window.addEventListener("messagesRead", fetchUnreadCount);

    const handleMessageReceived = (newMessageReceived) => {
      // Use window.location to check path without triggering re-renders on route change
      if (!locationRef.current.startsWith("/chat")) {
        setUnreadCounts((prev) => ({ ...prev, chat: prev.chat + 1 }));
      }
    };

    const handleNewActivity = () => {
      if (!locationRef.current.startsWith("/activities")) {
        setUnreadCounts((prev) => ({
          ...prev,
          activities: (prev.activities || 0) + 1,
        }));
      }
    };

    const handleNewNotice = () => {
      if (locationRef.current !== "/notice-board") {
        setUnreadCounts((prev) => ({
          ...prev,
          notices: (prev.notices || 0) + 1,
        }));
      }
    };

    const handleNotification = () => {
      if (!locationRef.current.startsWith("/activities")) {
        setUnreadCounts((prev) => ({
          ...prev,
          activities: (prev.activities || 0) + 1,
        }));
      }
    };

    const handleRemoveActivity = () => {
      setUnreadCounts((prev) => ({
        ...prev,
        activities: Math.max(0, (prev.activities || 0) - 1),
      }));
    };

    const handleRemoveNotice = () => {
      setUnreadCounts((prev) => ({
        ...prev,
        notices: Math.max(0, (prev.notices || 0) - 1),
      }));
    };

    socket.on("message received", handleMessageReceived);
    socket.on("new activity", handleNewActivity);
    socket.on("new notice", handleNewNotice);
    socket.on("notification", handleNotification);
    socket.on("remove activity", handleRemoveActivity);
    socket.on("remove notice", handleRemoveNotice);

    return () => {
      window.removeEventListener("messagesRead", fetchUnreadCount);
      socket.off("message received", handleMessageReceived);
      socket.off("new activity", handleNewActivity);
      socket.off("new notice", handleNewNotice);
      socket.off("notification", handleNotification);
      socket.off("remove activity", handleRemoveActivity);
      socket.off("remove notice", handleRemoveNotice);
    };
  }, [user?._id, socket]);

  useEffect(() => {
    if (location.pathname.startsWith("/chat")) {
      setUnreadCounts((prev) => ({ ...prev, chat: 0 }));
    }
    if (location.pathname.startsWith("/activities")) {
      setUnreadCounts((prev) => ({ ...prev, activities: 0 }));
    }
    if (location.pathname === "/notice-board") {
      setUnreadCounts((prev) => ({ ...prev, notices: 0 }));
    }
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const handleToggleDnd = async () => {
    try {
      const newDndStatus = !user.isDnd;
      const data = await updateUserProfile(user._id, { isDnd: newDndStatus });
      dispatch(updateUser(data.user || data));
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: newDndStatus ? "DND enabled 🌙" : "DND disabled ☀️",
        }),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Failed to update status" }),
      );
    }
  };

  const menuItems = [
{
      icon: Home,
      label: "Home Feed",
      path: "/",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    
    {
      icon: MessageCircle,
      label: "Chat",
      path: "/chat",
      badge: unreadCounts.chat,
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/dashboard",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: Bot,
      label: "AI Hub",
      path: "/ai-hub",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: MonitorPlay,
      label: "Study Hub",
      path: "/study-hub",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: Bell,
      label: "Activities",
      path: "/activities",
      badge: unreadCounts.activities,
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: ClipboardCheck,
      label: "Attendance",
      path: "/attendance",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: ShoppingBag,
      label: "Marketplace",
      path: "/marketplace",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: User,
      label: "My Profile",
      path: `/profile`,
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: FileText,
      label: "Notice Board",
      path: "/notice-board",
      badge: unreadCounts.notices,
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: BookImage,
      label: "Gallery",
      path: "/ai-gallery",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
    {
      icon: Code,
      label: "Compiler",
      path: "/compiler",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    },
  ];

  if (user && !user.faceEncodingVector) {
    menuItems.push({
      icon: Camera,
      label: "Setup Face ID",
      path: "/dashboard/mark-attendance",
      roles: ["Student", "Teacher", "Admin", "HOD", "Seller"],
    });
  }

  const roleSpecificItems = {
    Student: [
      (user?.faceEncodingVector ? { icon: Camera, label: "Mark Attendance", path: "/dashboard/mark-attendance" } : null),
      { icon: BookOpen, label: "My Curriculum", path: "/dashboard/curriculum" },
    ].filter(Boolean),
    Teacher: [
      {
        icon: ClipboardList,
        label: "Quiz Editor",
        path: "/teacher/quiz-editor",
      },
      (user?.faceEncodingVector ? { icon: Camera, label: "Mark Attendance", path: "/dashboard/mark-attendance" } : null),
      { icon: BookOpen, label: "Curriculum", path: "/dashboard/curriculum" },
    ].filter(Boolean),
    Admin: [
      {
        icon: ClipboardList,
        label: "Quiz Editor",
        path: "/teacher/quiz-editor",
      },
      { icon: CheckSquare, label: "Approvals", path: "/user-approvals" },
      { icon: Shield, label: "HOD Mgmt", path: "/admin/hod-management" },
      { icon: Users, label: "Teachers", path: "/dashboard/teachers" },
      { icon: Wifi, label: "WiFi Config", path: "/dashboard/admin/wifi-config" },
      { icon: CreditCard, label: "Monetization", path: "/monetization" },
      { icon: Activity, label: "Analytics", path: "/dashboard/analytics" },
      { icon: BrainCircuit, label: "Dropout AI", path: "/dashboard/dropout-predict" },
      { icon: Settings, label: "System Settings", path: "/admin/settings" },
    ],
    HOD: [
      {
        icon: ClipboardList,
        label: "Quiz Editor",
        path: "/teacher/quiz-editor",
      },
      (user?.faceEncodingVector ? { icon: Camera, label: "Mark Attendance", path: "/dashboard/mark-attendance" } : null),
      { icon: BookOpen, label: "Curriculum", path: "/dashboard/curriculum" },
      { icon: CheckSquare, label: "Approvals", path: "/user-approvals" },
      { icon: Users, label: "Teachers", path: "/dashboard/teachers" },
      { icon: Activity, label: "Analytics", path: "/dashboard/analytics" },
      { icon: BrainCircuit, label: "Dropout AI", path: "/dashboard/dropout-predict" },
    ].filter(Boolean),
    Seller: []
  };

  if (!user) return null;

  const userRole = user.role?.toLowerCase() || "";
  const matchedRoleKey = Object.keys(roleSpecificItems).find(k => k.toLowerCase() === userRole);

  // Filter by role first
  let roleFilteredItems = [
    ...menuItems.filter((item) => item.roles.map(r => r.toLowerCase()).includes(userRole)),
    ...(matchedRoleKey ? roleSpecificItems[matchedRoleKey] : []),
  ];

  // 1. Map system-wide feature toggles to items
  const featureToggleMap = {
    "/chat": "chatEnabled",
    "/ai-hub": "aiEnabled",
    "/attendance": "attendanceEnabled",
    "/marketplace": "marketplaceEnabled",
    "/compiler": "compilerEnabled",
    "/notice-board": "notificationsEnabled",
    "/activities": "notificationsEnabled",
  };

  // Then apply Admin's dynamic sorting and visibility rules
  if (navConfig && navConfig.length > 0) {
    roleFilteredItems = roleFilteredItems.map(item => {
      const config = navConfig.find(c => c.path === item.path);
      const featureKey = featureToggleMap[item.path];
      
      // Feature is visible only if:
      // 1. Admin hasn't manually hidden it in navConfig AND
      // 2. Global service control (if any) is enabled
      const isFeatureEnabled = featureKey ? (sysSettings?.serviceControls?.[featureKey] !== false) : true;
      const isVisibleInNav = config ? (config.visible !== false) : true;

      return { 
        ...item, 
        visible: isVisibleInNav && isFeatureEnabled, 
        order: config ? config.order : 99 
      };
    }).filter(item => item.visible).sort((a, b) => a.order - b.order);
  } else if (sysSettings?.serviceControls) {
    // Fallback if navConfig is empty but serviceControls exist
    roleFilteredItems = roleFilteredItems.filter(item => {
      const featureKey = featureToggleMap[item.path];
      return featureKey ? (sysSettings.serviceControls[featureKey] !== false) : true;
    });
  }

  return (
    <UniversalSidebar
      isOpen={sidebar}
      className={`flex flex-col z-50 shadow-2xl sm:shadow-lg duration-300 sm:m-1 rounded-r-2xl sm:rounded-xl relative h-full sm:h-[calc(100vh-80px)] ${getGlassyClasses(isDark)} ${sidebar ? "w-64 sm:w-56 overflow-visible border-r border-white/10 sm:border-none" : "sm:w-16 w-0 overflow-hidden sm:overflow-visible border-transparent"}`}
    >
      {sidebar && (
        <div className="">
          <h2 className="text-lg ml-4 mt-3 font-semibold opacity-80 mb-2">
            Menu
          </h2>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full flex flex-col gap-1 p-2 scrollbar-hide">
        {roleFilteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <div key={item.path} className="relative w-full">
              <Link
                to={item.path}
                className={`sidebar-link flex-wrap ${sidebar ? "flex" : "hidden sm:flex justify-center"} w-full items-center gap-3 px-3 py-3 rounded-lg transition-all hover:no-underline ${
                  active
                    ? "bg-black/10 dark:bg-white/10 font-bold shadow-sm"
                    : `hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100`
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebar && (
                  <span className="font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {item.badge > 0 && (
                  <span
                    className="absolute top-2 right-2 px-1.5 bg-red-500 text-white text-[10px] font-light rounded-full  p-0.5 m-0.5 z-10"
                    style={{
                      transform: sidebar
                        ? "translate(40%, -40%)"
                        : "translate(60%, -60%)",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Bottom Settings Section */}
      <div className="mt-auto p-2 border-t border-inherit flex flex-col gap-1">
        {/* DND Toggle */}
        <button
          onClick={handleToggleDnd}
          className={`w-full flex items-center ${sidebar ? "px-3 justify-start gap-3" : "justify-center"} py-3 rounded-lg transition-all ${
            user?.isDnd
              ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold"
              : "hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
          }`}
          title={user?.isDnd ? "Disable DND" : "Enable DND"}
        >
          <BellOff className="w-5 h-5 flex-shrink-0" />
          {sidebar && (
            <span className="font-medium whitespace-nowrap">
              {user?.isDnd ? "DND Active" : "DND Off"}
            </span>
          )}
        </button>

        {/* Global Theme Selector */}
        <div
          className={`relative w-full flex items-center ${sidebar ? "px-3 justify-start gap-3" : "justify-center"} py-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 transition-all group overflow-visible cursor-pointer`}
        >
          <Palette className="w-5 h-5 flex-shrink-0 pointer-events-none" />
          {sidebar && (
            <span className="font-medium whitespace-nowrap pointer-events-none">
              Theme
            </span>
          )}

          {/* Dropdown Menu (Hover Triggered to the right) */}
          <div
            className={`absolute bottom-0 left-full ml-2 w-56 ${getCardThemeClasses(appTheme, is3DMode)} backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-bottom-left scale-95 group-hover:scale-100 z-50 overflow-hidden flex flex-col p-1`}
          >
            <div className="px-3 py-2 text-xs font-bold text-inherit opacity-60 uppercase tracking-wider border-b border-white/10 mb-1">
              App Appearance
            </div>
            
            {/* 3D Mode Toggle inside Theme Selector */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle3DMode(); }}
              className={`flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg text-sm transition-all ${is3DMode ? "bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20" : "hover:bg-white/10 opacity-80"}`}
            >
              <div className="flex items-center gap-2">
                <Box size={14} /> 3D Mode
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${is3DMode ? "bg-white/30" : "bg-white/10"}`}>
                <div className={`absolute top-1 left-1 w-2 h-2 rounded-full bg-white transition-transform ${is3DMode ? "translate-x-4" : ""}`} />
              </div>
            </button>

            <div className="h-px bg-white/10 my-1" />

            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setAppTheme(theme.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${appTheme === theme.id ? "bg-indigo-500/20 text-indigo-400 font-bold" : "text-inherit opacity-80 hover:opacity-100 hover:bg-white/5"}`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Copyright & Credits */}
      {sidebar && (
        <div className="mt-3 mb-2 px-2 text-[10px] text-inherit opacity-40 text-center leading-relaxed transition-opacity duration-300 select-none">
          <p className="font-bold tracking-wide uppercase">© {new Date().getFullYear()} SocioFest</p>
          <p className="font-medium mt-1">Master Creator: Kuldeep Sharma</p>
          <p className="text-[9px] opacity-80">In collaboration with Anmol Bhatnagar & Ankush Rajput</p>
        </div>
      )}
    </UniversalSidebar>
  );
};

export default Sidebar;
