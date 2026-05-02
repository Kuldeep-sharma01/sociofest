import React, { useState, useMemo } from "react";
import {
  Search,
  MessageSquare,
  MessageCircle,
  Users,
  Sparkles,
  UserPlus
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import UniversalSidebar from "@/components/ui/UniversalSidebar";
import UserInfo from "@/components/ui/UserInfo";
import { getUserSubtitle } from "@/utils/userUtils";
import { getThemeSoftBg, getThemeHoverBg, getPrimaryButtonClasses } from "@/utils/themeUtils";

const ChatSidebar = ({
  showSidebar,
  activeTab,
  setActiveTab,
  conversations,
  users,
  searchQuery,
  setSearchQuery,
  loadingUsers,
  selectedUser,
  handleSelectUserFromNetwork,
  setSelectedUser,
  setSearchParams,
  setShowCreateGroupModal,
  blockedUsers = [],
  onAiMatchToggle,
  handleConnect,
}) => {
  const [chatFilter, setChatFilter] = useState("all");
  const [isAiMatching, setIsAiMatching] = useState(false);
  const { appTheme } = useTheme();

  const filteredConversations = useMemo(() => conversations.filter((c) => {
    if (chatFilter === "unread") return c.unread > 0 && !blockedUsers.includes(c._id);
    if (chatFilter === "favorites") return c.isFavorite && !blockedUsers.includes(c._id);
    if (chatFilter === "groups") return c.isGroup && !blockedUsers.includes(c._id);
    if (chatFilter === "blocked") return blockedUsers.includes(c._id);
    if (blockedUsers.includes(c._id)) return false; // Hide blocked users from general lists
    return true;
  }), [conversations, chatFilter, blockedUsers]);

  const totalUnread = useMemo(() => conversations.reduce((acc, c) => acc + (c.unread || 0), 0), [conversations]);

  return (
    <UniversalSidebar
      className={`${selectedUser ? "hidden md:flex" : "flex animate-in slide-in-from-left-8 duration-300 md:animate-none"} w-full md:w-1/3 lg:w-1/4 z-10`}
    >
      <div className="p-4 border-b border-inherit">
        <h2
          className={`text-xl font-bold mb-4 flex items-center gap-2 text-inherit`}
        >
          <MessageSquare className="w-5 h-5 opacity-80" />{" "}
          Messaging
        </h2>

        {/* Sidebar Tabs */}
        <div
          className={`flex p-1 rounded-lg mb-4 ${getThemeSoftBg(appTheme)} border border-inherit/30`}
        >
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all relative ${activeTab === "chats" ? `bg-white/50 ${getThemeSoftBg(appTheme)} shadow-sm text-inherit font-bold` : `text-inherit opacity-70 hover:opacity-100`}`}
          >
            Chats
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 h-fit p-0 rounded-full shadow-sm">
                {totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("network")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all relative ${activeTab === "network" ? `bg-white/50 ${getThemeSoftBg(appTheme)} shadow-sm text-inherit font-bold` : `text-inherit opacity-70 hover:opacity-100`}`}
          >
            Network
          </button>
        </div>

        {activeTab === "chats" && (
          <div className="flex gap-2 mb-4 overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pb-1">
            {["all", "unread", "favorites", "groups", "blocked"].map((f) => (
              <button
                key={f}
                onClick={() => setChatFilter(f)}
                className={`px-3 py-1 text-xs font-bold rounded-full capitalize transition-colors whitespace-nowrap ${chatFilter === f ? `bg-white/50 ${getThemeHoverBg(appTheme)} ${getThemeSoftBg(appTheme)} shadow-sm text-inherit border border-current/30` : `${getThemeSoftBg(appTheme)} ${getThemeHoverBg(appTheme)} text-inherit opacity-70 border border-transparent`}`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 opacity-50" />
          <input
            placeholder={
              activeTab === "chats" ? "Search messages..." : "Search people..."
            }
          className={`pl-9 w-full p-2 rounded-md text-sm focus:outline-none focus:ring-2 transition-colors ${getThemeSoftBg(appTheme)} border border-inherit/30 text-inherit placeholder-current opacity-80 focus:ring-current`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {activeTab === "network" && (
            <button
              onClick={() => {
                const newState = !isAiMatching;
                setIsAiMatching(newState);
                if (newState) window.dispatchEvent(new CustomEvent("showToast", { detail: "AI Skill Match Activated! 🎯" }));
                if (onAiMatchToggle) onAiMatchToggle(newState);
              }}
              className={`absolute right-2 top-2 h-6 w-6 rounded-md flex items-center justify-center transition-colors shadow-sm ${isAiMatching ? getPrimaryButtonClasses(appTheme) : 'opacity-60 hover:opacity-100 text-purple-500 hover:bg-purple-500/10'}`}
              title="AI Skill Match & Partner Discovery"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}

        </div>

        {activeTab === "chats" && (
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className={`mt-4 w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${getThemeSoftBg(appTheme)} ${getThemeHoverBg(appTheme)} border border-inherit/30 text-inherit`}
          >
            <Users className="w-4 h-4" /> Create New Group
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {activeTab === "network" && loadingUsers ? (
          <div className="flex justify-center p-4">
            <div
              className="loader"
              style={{ "--s": "15px", "--g": "3px" }}
            ></div>
          </div>
        ) : activeTab === "network" ? (
          // Network / Search List
          users.map((u) => {
            const conv = conversations.find(
              (c) => String(c._id) === String(u._id),
            );
            const unreadCount = conv?.unread || 0;

            return (
              <div
                key={u._id}
                onClick={() => handleSelectUserFromNetwork(u)}
                className={`flex w-full items-center justify-between p-4 cursor-pointer transition-colors border-b border-inherit/30 ${selectedUser?._id === u._id ? `${getThemeSoftBg(appTheme)} border-l-4 border-l-current` : getThemeHoverBg(appTheme)}`}
              >
                <UserInfo
                  user={u}
                  subtitle={getUserSubtitle(u)}
                  nameClassName={unreadCount > 0 ? "font-bold" : ""}
                />
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-sm animate-in zoom-in">
                      {unreadCount}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (handleConnect) handleConnect(u._id);
                    }}
                    className={`p-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 rounded-full transition-all active:scale-95 shadow-sm border border-blue-500/30`}
                    title="Connect / Add Friend"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                  <button
                    className={`p-2.5 ${getThemeSoftBg(appTheme)} ${getThemeHoverBg(appTheme)} text-inherit rounded-full transition-all active:scale-95 shadow-sm border border-inherit/30`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectUserFromNetwork(u);
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          // Recent Chats List
          Array.isArray(filteredConversations) &&
          filteredConversations.map((u) => (
            <button
              key={u._id}
              onClick={() => {
                setSelectedUser(u);
                setSearchParams({ userId: u._id });
              }}
              className={`flex w-full items-center gap-3 p-4 cursor-pointer transition-colors border-b border-inherit/30 ${selectedUser?._id === u._id ? `${getThemeSoftBg(appTheme)} border-l-4 border-l-current` : getThemeHoverBg(appTheme)}`}
            >
              <UserInfo user={u} showText={false} />
              <div className="overflow-hidden flex-1">
                <div className="flex justify-between items-center">
                  <h3
                    className={`font-semibold truncate ${u.unread > 0 ? "font-bold" : ""} text-inherit`}
                  >
                    {u.name}
                  </h3>
                  <div className="flex flex-col items-end gap-1">
                    {u.lastMessageTime && (
                      <span
                        className={`text-[10px] ${u.unread > 0 ? "font-bold text-current" : "opacity-70"}`}
                      >
                        {new Date(u.lastMessageTime).toLocaleDateString()}
                      </span>
                    )}
                    {u.unread > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-sm animate-in zoom-in">
                        {u.unread}
                      </span>
                    )}
                  </div>
                </div>
                <p
                  className={`text-xs truncate ${u.unread > 0 ? "font-medium opacity-100" : "opacity-70"} text-inherit`}
                >
                  {u.lastMessage || getUserSubtitle(u)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </UniversalSidebar>
  );
};
export default ChatSidebar;
