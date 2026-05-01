// @refresh reset
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  Search,
  Moon,
  Sun,
  Bot,
  Mic,
  Palette,
  MonitorPlay,
  FileText,
  Bell,
  Users,
  MessageCircle,
  LayoutDashboard,
  Check,
  Settings,
  UserCircle,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "@/redux/authSlice";
import { logoutUser } from "@/services/userService";
import { useSocket } from "@/context/SocketContext";
import { useTheme, THEMES } from "@/context/ThemeContext";
import { getUnreadCount } from "@/services/chatService";
import { useMicVolume } from "../hooks/useMicVolume";
import FullscreenMediaModal from "./ui/FullscreenMediaModal";
import { globalSearch } from "@/services/searchService";
import {
  getNavbarThemeClasses,
  getOptionClasses,
  getPrimaryButtonClasses,
  getCardThemeClasses,
} from "@/utils/themeUtils";
import UserInfo from "@/components/ui/UserInfo";
import UniversalBadge from "@/components/ui/UniversalBadge";
const logo = "/sociofest_transparent_logo.png";

const NavLink = ({ to, children, title, onClick }) => (
  <Link
    to={to}
    title={title}
    className="flex items-center justify-center gap-1.5
      shrink-0
      px-3 py-2 md:px-4
      text-sm md:text-base
      rounded-xl
      font-semibold text-inherit hover:bg-black/5 dark:hover:bg-white/5 opacity-90 hover:opacity-100
      transition-all duration-300 ease-out
      hover:-translate-y-0.5 hover:shadow-md
      active:scale-95
      focus:outline-none
      hover:no-underline
    "
  >
    {children}
  </Link>
);

const Navbar = ({ setSidebar, open }) => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const { isDark, toggleTheme, appTheme, setAppTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState(
    localStorage.getItem("aiSpeechLang") || "en-US",
  );
  const micVolume = useMicVolume(isListening);
  const [unreadCounts, setUnreadCounts] = useState({
    chat: 0,
    notices: 0,
    activities: 0,
  });
  
  // Quick Search Dropdown States
  const [quickResults, setQuickResults] = useState(null);
  const [showQuickResults, setShowQuickResults] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);

  // Global Upload Tracking
  const [globalProgress, setGlobalProgress] = useState(0);
  const [showGlobalProgress, setShowGlobalProgress] = useState(false);
  const prevProgressRef = useRef(0);
  const isDismissedRef = useRef(false);

  // Custom Toast Notification State
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);
  const hasWelcomed = useRef(false);

  const recognitionRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 4000);
  };

  const locationRef = useRef(location.pathname);
  useEffect(() => {
    locationRef.current = location.pathname;
    setShowQuickResults(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (desktopSearchRef.current && !desktopSearchRef.current.contains(e.target) &&
          mobileSearchRef.current && !mobileSearchRef.current.contains(e.target)) {
        setShowQuickResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced Quick Search
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setQuickResults(null);
      setShowQuickResults(false);
      return;
    }
    const delayFn = setTimeout(async () => {
      const isMediaLink = /youtube\.com|youtu\.be/i.test(searchQuery) || /\.(mp4|webm|ogg|mov|mkv|m3u8|jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i.test(searchQuery);
      if (isMediaLink) return;
      try {
        const res = await globalSearch(searchQuery, true);
        setQuickResults(res);
        setShowQuickResults(true);
      } catch (error) {}
    }, 300);
    return () => clearTimeout(delayFn);
  }, [searchQuery, user]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Listen for custom global toast events from any component
  useEffect(() => {
    const handleCustomToast = (e) => showToast(e.detail);
    window.addEventListener("showToast", handleCustomToast);
    return () => window.removeEventListener("showToast", handleCustomToast);
  }, []);

  useEffect(() => {
    const handleGlobalProgress = (e) => {
      const { progress } = e.detail;
      if (progress < prevProgressRef.current || progress === 0)
        isDismissedRef.current = false;
      prevProgressRef.current = progress;
      setGlobalProgress(progress);
      if (!isDismissedRef.current) setShowGlobalProgress(true);
      if (progress >= 100) {
        setTimeout(() => {
          setShowGlobalProgress(false);
          setTimeout(() => {
            setGlobalProgress(0);
            prevProgressRef.current = 0;
          }, 300);
        }, 3000);
      }
    };
    window.addEventListener("globalUploadProgress", handleGlobalProgress);
    return () =>
      window.removeEventListener("globalUploadProgress", handleGlobalProgress);
  }, []);

  // Global Socket Listener for Notifications
  useEffect(() => {
    if (!user?._id || !socket) return;

    // Display Welcome Toast on initial load/login
    if (!hasWelcomed.current) {
      showToast(`Welcome back, ${user.name}! 👋`);
      hasWelcomed.current = true;
    }

    const fetchUnreadCount = () => {
      getUnreadCount()
        .then((data) => {
          setUnreadCounts((prev) => ({ ...prev, chat: data.count || 0 }));
        })
        .catch((err) =>
          console.error("Failed to load sidebar unread count", err),
        );
    };
    fetchUnreadCount();
    window.addEventListener("messagesRead", fetchUnreadCount);

    // Request browser notification permission
    // if (
    //   Notification.permission !== "granted" &&
    //   Notification.permission !== "denied"
    // ) {
    //   Notification.requestPermission();
    // }

    const handleMessageReceived = (newMessageReceived) => {
      // Use window.location to check path without triggering re-renders on route change
      if (!locationRef.current.startsWith("/chat")) {
        setUnreadCounts((prev) => ({ ...prev, chat: prev.chat + 1 }));
      }
    };
    // socket.on("message received", (newMessage) => {
    //   // Browser Notification
    //   // Only notify if NOT on chat page (Chat.jsx handles it there to avoid duplicates & adds smart switching)
    //   if (
    //     Notification.permission === "granted" &&
    //     !location.pathname.startsWith("/chat")
    //   ) {
    //     const notification = new Notification(
    //       `New message from ${newMessage.sender?.name || "Someone"}`,
    //       {
    //         body: newMessage.content || "Sent an attachment",
    //         icon: newMessage.sender?.profilePicture || "/vite.svg", // Use profile pic or default
    //       },
    //     );
    //     notification.onclick = () => {
    //       window.focus();
    //       navigate(`/chat?userId=${newMessage.sender._id}`);
    //     };
    //   }
    // });
    const handleNotification = (data) => {
      if (!userRef.current?.isDnd) showToast(data.message);
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

    const handleAccountBlocked = () => {
      showToast("Your account has been blocked or rejected. Logging out... 🛑");
      setTimeout(() => {
        dispatch(logout());
        navigate("/login");
      }, 2000);
    };

    socket.on("message received", handleMessageReceived);
    socket.on("notification", handleNotification);
    socket.on("remove activity", handleRemoveActivity);
    socket.on("remove notice", handleRemoveNotice);
    socket.on("account blocked", handleAccountBlocked);

    return () => {
      window.removeEventListener("messagesRead", fetchUnreadCount);
      socket.off("message received", handleMessageReceived);
      socket.off("notification", handleNotification);
      socket.off("remove activity", handleRemoveActivity);
      socket.off("remove notice", handleRemoveNotice);
      socket.off("account blocked", handleAccountBlocked);
    };
  }, [user?._id, socket]);

  const toggleVoiceSearch = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
      return;
    }
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = speechLang;
      recognition.interimResults = true; // Show words as they are spoken

      recognition.onstart = () => {
        setIsListening(true);
        showToast("Listening... Speak now 🎤");
      };

      recognition.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setSearchQuery(final + interim);

        if (final.trim()) {
          // Brief pause allows the user to see the finalized text before it auto-submits
          setTimeout(() => {
            const query = final.trim();
            const isYoutube = /youtube\.com|youtu\.be/i.test(query);
            const isDirectVideo = /\.(mp4|webm|ogg|mov|mkv|m3u8)(\?.*)?$/i.test(
              query,
            );
            const isDirectImage =
              /\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i.test(query);

            if (isYoutube || isDirectVideo) {
              setFullscreenMedia({
                url: query,
                type: isYoutube ? "youtube" : "video",
                title: "Voice Stream",
                isDownloadable: false,
              });
            } else if (isDirectImage) {
              setFullscreenMedia({
                url: query,
                type: "image",
                title: "Voice Image",
                isDownloadable: false,
              });
            } else {
              navigate(`/search?q=${encodeURIComponent(query)}`);
            }
            setIsSearchOpen(false);
            setIsListening(false);
          }, 600);
        }
      };

      recognition.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed")
          showToast("Microphone access denied. ❌");
        setIsListening(false);
      };

      recognition.onend = () => setIsListening(false);

      try {
        recognition.start();
      } catch (e) {
        setIsListening(false);
      }
    } else {
      showToast("Speech recognition not supported in your browser. ❌");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      // If the user pastes a raw Media/HLS/YouTube link, launch the cinema player instantly!
      const isYoutube = /youtube\.com|youtu\.be/i.test(query);
      const isDirectVideo = /\.(mp4|webm|ogg|mov|mkv|m3u8)(\?.*)?$/i.test(
        query,
      );
      const isDirectImage = /\.(jpeg|jpg|gif|png|webp|bmp|svg)(\?.*)?$/i.test(
        query,
      );

      if (isYoutube || isDirectVideo) {
        setFullscreenMedia({
          url: query,
          type: isYoutube ? "youtube" : "video",
          title: "External Stream",
          isDownloadable: false, // Prevent downloading unknown third-party URLs by default
        });
        setSearchQuery("");
      } else if (isDirectImage) {
        setFullscreenMedia({
          url: query,
          type: "image",
          title: "External Image",
          isDownloadable: false,
        });
        setSearchQuery("");
      } else {
        navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleLogoutClick = () => {
    logoutUser();
    dispatch(logout());
    navigate("/login");
  };

  const renderQuickResults = () => {
    if (!quickResults) return null;
    const total = (quickResults.users?.length || 0) + (quickResults.events?.length || 0) + (quickResults.quizzes?.length || 0) + (quickResults.certificates?.length || 0) + (quickResults.posts?.length || 0) + (quickResults.departments?.length || 0) + (quickResults.subjects?.length || 0) + (quickResults.assignments?.length || 0) + (quickResults.products?.length || 0);

    if (total === 0) {
      return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 dark:bg-gray-900 backdrop-blur-xl border border-inherit/30 rounded-xl shadow-2xl p-4 text-center text-sm text-white dark:text-inherit z-50">
          No results found for "{searchQuery}"
        </div>
      );
    }

    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 dark:bg-gray-900 backdrop-blur-xl border border-inherit/30 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto p-2 text-white dark:text-inherit flex flex-col gap-2">
        {quickResults.users?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1">People</div>
            {quickResults.users.map(u => (
              <Link key={u._id} to={`/profile/${u._id}`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors hover:no-underline text-inherit">
                <img src={u.profilePicture || `https://ui-avatars.com/api/?name=${u.name}&background=random`} className="w-8 h-8 rounded-full object-cover" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold leading-none">{u.name}</span>
                  <span className="text-xs opacity-70">{u.role} • {u.department?.name || 'General'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {quickResults.events?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1">Events</div>
            {quickResults.events.map(e => (
              <Link key={e._id} to={`/activities`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="flex flex-col p-2 hover:bg-white/10 rounded-lg transition-colors hover:no-underline text-inherit">
                <span className="text-sm font-bold leading-none mb-1">{e.title}</span>
                <span className="text-xs opacity-70 line-clamp-1">{e.category} • {new Date(e.start).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}
        {quickResults.posts?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1">Posts & Media</div>
            {quickResults.posts.slice(0, 3).map(p => (
              <Link key={p._id} to={`/search?q=${encodeURIComponent(searchQuery)}`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="flex flex-col p-2 hover:bg-white/10 rounded-lg transition-colors hover:no-underline text-inherit">
                <span className="text-sm font-bold leading-none mb-1 line-clamp-1">{p.content || p.material?.description || "Media Post"}</span>
                <span className="text-xs opacity-70">By {p.author?.name || 'Unknown'}</span>
              </Link>
            ))}
          </div>
        )}
        {quickResults.subjects?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1">Subjects</div>
            {quickResults.subjects.slice(0, 2).map(s => (
              <Link key={s._id} to={`/subjects/${s._id}`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="flex flex-col p-2 hover:bg-white/10 rounded-lg transition-colors hover:no-underline text-inherit">
                <span className="text-sm font-bold leading-none mb-1">{s.name} {s.code ? `(${s.code})` : ""}</span>
                <span className="text-xs opacity-70">Sem {s.semester} • {s.department?.name}</span>
              </Link>
            ))}
          </div>
        )}
        {quickResults.products?.length > 0 && (
          <div>
            <div className="text-[10px] font-bold opacity-50 uppercase px-2 py-1">Marketplace</div>
            {quickResults.products.slice(0, 2).map(p => (
              <Link key={p._id} to={`/marketplace?q=${encodeURIComponent(p.title)}`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="flex flex-col p-2 hover:bg-white/10 rounded-lg transition-colors hover:no-underline text-inherit">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-bold leading-none mb-1 line-clamp-1 pr-2">{p.title}</span>
                  <span className="text-xs font-bold text-green-400 bg-green-500/10 px-1.5 rounded">${p.price}</span>
                </div>
                <span className="text-xs opacity-70 line-clamp-1">{p.category} • {p.condition}</span>
              </Link>
            ))}
          </div>
        )}
        <Link to={`/search?q=${encodeURIComponent(searchQuery)}`} onClick={() => { setShowQuickResults(false); setIsSearchOpen(false); }} className="block text-center text-sm text-blue-400 hover:text-blue-300 font-bold p-2 mt-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors hover:no-underline">
          See all results
        </Link>
      </div>
    );
  };

  return (
    <nav
      className={`relative w-full z-40 transition-colors shadow-sm border-b border-inherit/10 ${getNavbarThemeClasses(appTheme)}`}
    >
      {isSearchOpen &&
        createPortal(
          <div
            className={`fixed top-0 left-0 right-0 h-16 z-[9999] ${getNavbarThemeClasses(appTheme)} px-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border-b shadow-md`}
          >
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`relative p-2 rounded-full transition-colors ${isListening ? "text-red-500 bg-red-500/20" : "opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"}`}
              title={isListening ? "Stop Listening" : "Voice Search"}
            >
              {isListening && (
                <div
                  className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-75 pointer-events-none"
                  style={{ transform: `scale(${1 + micVolume / 50})` }}
                />
              )}
              <Mic className="w-5 h-5 relative z-10" />
            </button>
            <select
              value={speechLang}
              onChange={(e) => {
                setSpeechLang(e.target.value);
                localStorage.setItem("aiSpeechLang", e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`absolute top-full mt-1 left-0 text-[10px] rounded p-1 opacity-0 group-hover/voice:opacity-100 transition-opacity outline-none cursor-pointer border border-inherit/30 font-bold z-50 ${getOptionClasses(appTheme, isDark)}`}
            >
              <option
                value="en-US"
                className={getOptionClasses(appTheme, isDark)}
              >
                English
              </option>
              <option
                value="es-ES"
                className={getOptionClasses(appTheme, isDark)}
              >
                Spanish
              </option>
              <option
                value="fr-FR"
                className={getOptionClasses(appTheme, isDark)}
              >
                French
              </option>
              <option
                value="hi-IN"
                className={getOptionClasses(appTheme, isDark)}
              >
                Hindi
              </option>
              <option
                value="de-DE"
                className={getOptionClasses(appTheme, isDark)}
              >
                German
              </option>
              <option
                value="ja-JP"
                className={getOptionClasses(appTheme, isDark)}
              >
                Japanese
              </option>
              <option
                value="ar-SA"
                className={getOptionClasses(appTheme, isDark)}
              >
                Arabic
              </option>
            </select>
            <form
              ref={mobileSearchRef}
              onSubmit={(e) => {
                handleSearch(e);
                setIsSearchOpen(false);
              }}
              className="flex-1 relative"
            >
              <input
                autoFocus
                type="text"
                placeholder="Search people, events..."
                className="w-full bg-transparent border-none focus:ring-0 text-inherit placeholder-current opacity-80 h-16 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if(quickResults) setShowQuickResults(true); }}
              />
              {showQuickResults && renderQuickResults()}
            </form>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-2 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>,
          document.body,
        )}

      {/* FULL-WIDTH CONTAINER (no mx-auto) */}
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* LEFT SECTION (fixed) */}
          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <button
                onClick={() => {
                  setSidebar((prev) => !prev);
                }}
                className="
                  p-2 rounded-lg text-inherit
                  hover:bg-black/10 dark:hover:bg-white/10 transition
                  flex items-center justify-center
                  relative
                "
                aria-label="Toggle sidebar"
              >
                {open ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
                {(unreadCounts.chat > 0 ||
                  unreadCounts.notices > 0 ||
                  unreadCounts.activities > 0) && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
            )}

            <Link
              to="/home"
              className="flex items-center gap-1 group hover:no-underline"
            >
              <img
              src={logo}
                alt="SocioFest Logo"
                referrerPolicy="no-referrer"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <span
                className="
                  hidden sm:inline text-2xl md:text-3xl font-extrabold tracking-wide 
                  text-inherit transition-all duration-300 hover:scale-[1.03] select-none mr-1
                "
              >
                SocioFest
              </span>
            </Link>
          </div>

          {/* CENTER SECTION (flexible) */}
          <div className="flex flex-1 h-full items-center justify-center min-w-0 gap-1">
            {/* Smart Search Bar (Desktop) */}
            {user && (
              <form
                ref={desktopSearchRef}
                onSubmit={handleSearch}
                className="hidden lg:block relative w-full max-w-xl transition-all duration-300 focus-within:max-w-3xl shrink"
              >
                <div className="absolute left-2 top-1/2 -translate-y-1/2 group/voice flex items-center z-20">
                  <button
                    type="button"
                    onClick={toggleVoiceSearch}
                    className={`relative p-1.5 rounded-full transition-colors ${isListening ? "text-red-500 bg-red-500/20" : "text-inherit opacity-50 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"}`}
                    title={isListening ? "Stop Listening" : "Voice Search"}
                  >
                    {isListening && (
                      <div
                        className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-75 pointer-events-none"
                        style={{ transform: `scale(${1 + micVolume / 50})` }}
                      />
                    )}
                    <Mic className="w-4 h-4 relative z-10" />
                  </button>
                  <select
                    value={speechLang}
                    onChange={(e) => {
                      setSpeechLang(e.target.value);
                      localStorage.setItem("aiSpeechLang", e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-full mt-1 left-0 text-[10px] rounded p-1 opacity-0 group-hover/voice:opacity-100 transition-opacity outline-none cursor-pointer border border-inherit/30 font-bold z-50 ${getOptionClasses(appTheme, isDark)}`}
                  >
                    <option
                      value="en-US"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      English
                    </option>
                    <option
                      value="es-ES"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      Spanish
                    </option>
                    <option
                      value="fr-FR"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      French
                    </option>
                    <option
                      value="hi-IN"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      Hindi
                    </option>
                    <option
                      value="de-DE"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      German
                    </option>
                    <option
                      value="ja-JP"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      Japanese
                    </option>
                    <option
                      value="ar-SA"
                      className={getOptionClasses(appTheme, isDark)}
                    >
                      Arabic
                    </option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Search people, events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if(quickResults) setShowQuickResults(true); }}
                  className="w-full bg-black/5 dark:bg-white/5 border-transparent focus:bg-black/10 dark:focus:bg-white/10 text-inherit focus:ring-2 focus:ring-current rounded-full py-2 pl-10 pr-10 text-sm transition-all shadow-sm outline-none placeholder-current placeholder-opacity-60"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Search className="w-4 h-4" />
                </button>
                {showQuickResults && renderQuickResults()}
              </form>
            )}
            {/* Nav Links - Visible on Mobile with scroll */}
            <div className="flex items-center overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full gap-1 w-full md:w-auto px-1 pb-0.5">
              <NavLink to="/ai-hub" title="AI Hub">
                <Bot className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden lg:inline">AI Hub</span>
              </NavLink>
              <NavLink to="/study-hub" title="Study Hub">
                <MonitorPlay className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden lg:inline">Study Hub</span>
              </NavLink>
              <div className="flex relative">
                <NavLink to="/notice-board" title="Notices">
                  <FileText className="w-5 h-5 md:w-4 md:h-4" />
                  <span className="hidden lg:inline">Notices</span>
                </NavLink>
                {unreadCounts.notices > 0 && (
                  <p className="flex absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full shadow-sm pointer-events-none">
                    {unreadCounts.notices}
                  </p>
                )}
              </div>
              {user && (
                <>
                  <div className="flex relative">
                    <NavLink to="/activities" title="Activities">
                      <Bell className="w-5 h-5 md:w-4 md:h-4" />
                      <span className="hidden lg:inline">Activities</span>
                    </NavLink>
                    {unreadCounts.activities > 0 && (
                      <p className="flex absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full shadow-sm pointer-events-none">
                        {unreadCounts.activities}
                      </p>
                    )}
                  </div>
                  <NavLink to="/feed" title="feed">
                    <Users className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden lg:inline">Social Medias</span>
                  </NavLink>
                  <div className="flex relative">
                    <NavLink to="/chat" title="Chat">
                      <MessageCircle className="w-5 h-5 md:w-4 md:h-4" />
                      <span className="hidden lg:inline">Chat</span>
                    </NavLink>
                    {unreadCounts.chat > 0 && (
                      <p className="flex absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full shadow-sm pointer-events-none">
                        {unreadCounts.chat}
                      </p>
                    )}
                  </div>
                  <NavLink to="/dashboard" title="Dashboard">
                    <LayoutDashboard className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden lg:inline">Dashboard</span>
                  </NavLink>
                </>
              )}
            </div>
          </div>

          {/* RIGHT SECTION (fixed) */}
          <div className="flex items-center  shrink-0 gap-2" title="Profile">
            {/* Mobile Search Toggle */}
            {user && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="lg:hidden opacity-70 hover:opacity-100 hover:bg-black/10 border p-1  dark:hover:bg-white/10 rounded-full transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Global Theme Controls (Always Visible) */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-full border border-inherit bg-black/5 dark:bg-white/5 text-inherit hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            <div className="relative group flex items-center justify-center">
              <button
                className="p-1.5 sm:p-2 rounded-full border border-inherit bg-black/5 dark:bg-white/5 text-inherit hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95 flex items-center gap-1"
                title="Change Theme"
              >
                <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="absolute top-full right-0 mt-2 w-48 bg-black/90 dark:bg-white/10 backdrop-blur-xl rounded-xl shadow-2xl border border-inherit/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-right scale-95 group-hover:scale-100 z-50 overflow-hidden flex flex-col p-1">
                <div className="px-3 py-2 text-xs font-bold text-white dark:text-inherit opacity-60 uppercase tracking-wider border-b border-inherit/30 mb-1">
                  App Theme
                </div>
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setAppTheme(theme.id)}
                    className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${appTheme === theme.id ? getPrimaryButtonClasses(appTheme) : "text-white dark:text-inherit opacity-80 hover:opacity-100 hover:bg-white/10"}`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {user ? (
              <>
                <div className="relative group">
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2.5 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors hover:no-underline"
                  >
                    <div className="hidden md:flex flex-col items-end justify-center">
                      <span className="text-sm font-bold text-inherit leading-tight mb-0.5">
                        {user.name}
                      </span>
                      <UniversalBadge text={user.role} />
                    </div>
                    <UserInfo
                      user={user}
                      showText={false}
                      avatarSize="w-8 h-8 sm:w-10 sm:h-10"
                    />
                  </Link>

                  <div className="absolute top-full right-0 mt-2 w-56 bg-black/90 dark:bg-white/10 backdrop-blur-xl rounded-xl shadow-2xl border border-inherit/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-right scale-95 group-hover:scale-100 z-50 overflow-hidden flex flex-col p-1">
                    <Link
                      to={`/profile/${user._id}`}
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-white dark:text-inherit opacity-90 hover:opacity-100 hover:bg-white/10 transition-colors"
                    >
                      <UserCircle className="w-4 h-4" /> My Profile
                    </Link>
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-white dark:text-inherit opacity-90 hover:opacity-100 hover:bg-white/10 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link
                      to="/settings"
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-white dark:text-inherit opacity-90 hover:opacity-100 hover:bg-white/10 transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <div className="w-full h-px bg-white/20 my-1"></div>
                    <button
                      onClick={handleLogoutClick}
                      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-500/20 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-3">
                <Link
                  to="/login"
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-transparent border border-inherit/50 text-inherit hover:bg-black/10 dark:hover:bg-white/10 rounded-lg sm:rounded-xl font-bold transition-all shadow-sm hover:no-underline whitespace-nowrap"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-black/10 dark:bg-white/10 text-inherit border border-transparent hover:bg-black/20 dark:hover:bg-white/20 rounded-lg sm:rounded-xl font-bold transition-all shadow-sm hover:no-underline whitespace-nowrap"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Toast Notification */}
      {toastMsg &&
        createPortal(
          <div
            className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 ${
              typeof toastMsg === "object" && toastMsg.variant === "error"
                ? "bg-red-500 text-white border-red-600"
                : `${getCardThemeClasses(appTheme)} border-inherit/20`
            }`}
          >
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${typeof toastMsg === "object" && toastMsg.variant === "error" ? "bg-white" : "bg-current"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${typeof toastMsg === "object" && toastMsg.variant === "error" ? "bg-white" : "bg-current"}`}></span>
            </span>
            <p className={`text-sm font-bold opacity-90 ${typeof toastMsg === "object" && toastMsg.variant === "error" ? "text-white" : "text-inherit"}`}>
              {typeof toastMsg === "object" ? toastMsg.message : toastMsg}
            </p>
          </div>,
          document.body,
        )}

      {/* Global Slim Upload Progress Bar */}
      {showGlobalProgress && (
        <div
          className={`absolute top-full left-0 w-full z-[100] ${getNavbarThemeClasses(appTheme)} border-b flex flex-col animate-in slide-in-from-top-1 shadow-md`}
        >
          <div className="flex items-center justify-between px-4 py-1.5">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-inherit opacity-90 flex items-center gap-2">
                {globalProgress < 100 ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3 text-green-500" />
                )}
                {globalProgress < 100
                  ? "Uploading File..."
                  : "Processing & Saving..."}
              </span>
              <span className="text-xs font-bold text-inherit">
                {globalProgress}%
              </span>
            </div>
            <button
              onClick={() => {
                isDismissedRef.current = true;
                setShowGlobalProgress(false);
              }}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-inherit opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="w-full h-1 bg-black/10 dark:bg-white/10">
            <div
              className={`h-full transition-all duration-300 ${globalProgress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Universal Media Launcher Portal */}
      {fullscreenMedia && (
        <div className="absolute z-[10000]">
          <FullscreenMediaModal
            media={fullscreenMedia}
            onClose={() => setFullscreenMedia(null)}
            currentUser={user}
          />
        </div>
      )}
    </nav>
  );
};

export default Navbar;
