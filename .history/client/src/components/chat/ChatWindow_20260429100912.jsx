import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
  lazy,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  Edit2,
  CheckCheck,
  Maximize2,
  Copy,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  Pin,
  PinOff,
  Reply,
  Search,
  Ban,
  Star,
  Users,
  CheckSquare,
  Forward,
  Download,
  Languages,
  Unlock,
  FileText,
  Sparkles,
} from "lucide-react";
import {
  renderContentWithLinks,
  HIGHLIGHT_STYLES,
  HighlightedText,
} from "@/utils/textUtils.jsx";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import UniversalVideoPlayer from "@/components/ui/UniversalVideoPlayer";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import EmptyState from "@/components/ui/EmptyState";
import { downloadMedia } from "@/utils/downloadUtils";
import PostComposer from "@/components/ui/PostComposer";
import UserInfo from "@/components/ui/UserInfo";
import YouTubePlayer from "@/components/ui/YouTubePlayer";
import {
  getCardThemeClasses,
  getChatWindowBg,
  getChatHeaderBg,
  getChatComposerBg,
  getBubbleClasses,
  getOptionClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";
import { useTheme } from "@/context/ThemeContext";

const DocumentViewer = lazy(() => import("@/components/ui/DocumentViewer"));

const ChatWindow = ({
  showChat,
  user,
  selectedUser,
  setSelectedUser,
  setSearchParams,
  conversations,
  isTyping,
  loadingMessages,
  messages,
  menuOpenId,
  setMenuOpenId,
  editingMessageId,
  setEditingMessageId,
  editContent,
  setEditContent,
  editAttachments,
  setEditAttachments,
  submitEdit,
  handleEditMessage,
  handleDeleteMessage,
  handlePinMessage,
  replyingToMessage,
  setReplyingToMessage,
  hasMoreMessages,
  loadMoreMessages,
  setFullscreenMedia,
  messagesEndRef,
  chatContainerRef,
  newMessage,
  typingHandler,
  handleSendMessage,
  isSending,
  attachments,
  handleAddFiles,
  handleRemoveFile,
  handleRemoveAttachment,
  isMultiSelectMode = false,
  setIsMultiSelectMode,
  selectedMessages = [],
  setSelectedMessages,
  handleSingleForward,
  handleMultiForward,
  handleMultiDelete,
  handleClearChat,
  handleToggleFavorite,
  setShowGroupInfoModal,
  blockedUsers,
  handleToggleBlock,
  chatTheme,
}) => {
  const { appTheme, isDark } = useTheme();
  // AI Translation State
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [translatingMsgId, setTranslatingMsgId] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [viewerFile, setViewerFile] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);

  const { speakingState, toggleVoice, stopVoice, isTranslating, translateText } = useAiFeatures();

  useEffect(() => {
    setSuggestedReplies([]);
  }, [selectedUser]);

  const handleSuggestReplies = async () => {
    const lastMsg = messages.filter((m) => m.sender?._id !== user._id).pop();
    if (!lastMsg || !lastMsg.content) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "No recent text message to reply to. 🤷‍♂️"
        }),
      );
      return;
    }
    setIsGeneratingReplies(true);
    try {
      const { generateContent } = await import("@/services/aiService");
      const prompt = `You are an AI assistant. Based on the following message received in a chat, suggest 3 short, natural, and contextual quick replies. Message: "${lastMsg.content}"\nReturn ONLY a valid JSON array of 3 strings. Example: ["Yes, absolutely!", "I'll check and get back to you.", "Can we discuss this later?"]`;
      const response = await generateContent({ prompt, contentType: "text" });
      const textToParse = response.generated_content || response;
      const match = textToParse.match(/\[[\s\S]*\]/);
      if (match) setSuggestedReplies(JSON.parse(match[0]));
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to generate replies. ❌"
        }),
      );
    } finally {
      setIsGeneratingReplies(false);
    }
  };

  const handleTranslateMessage = async (msg, e) => {
    if (!msg.content) return;
    setTranslatingMsgId(msg._id);
    setMenuOpenId(null);
    try {
      const translation = await translateText(msg.content, targetLanguage);
      setTranslatedMessages((prev) => ({
        ...prev,
        [msg._id]: translation,
      }));
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Translation failed. ❌" }),
      );
    } finally {
      setTranslatingMsgId(null);
    }
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      setShowScrollDown(scrollHeight - scrollTop - clientHeight > 300);
    }
  };

  const handleTranslateChat = async () => {
    setShowHeaderMenu(false);
    window.dispatchEvent(
      new CustomEvent("showToast", {
        detail: `Translating visible chat to ${targetLanguage}... ⏳`
      }),
    );
    try {
      for (const msg of messages) {
        if (msg.content && !translatedMessages[msg._id]) {
          try {
            const translation = await translateText(msg.content, targetLanguage);
            setTranslatedMessages((prev) => ({
              ...prev,
              [msg._id]: translation,
            }));
          } catch (e) {}
        }
      }
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Chat translation complete! ✨"
        }),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const highlightStyle = localStorage.getItem("aiHighlightStyle") || "yellow";
  const highlightSpeed =
    localStorage.getItem("aiHighlightSpeed") || "duration-300";
  const textSize = localStorage.getItem("aiTextSize") || "text-[15px]"; // Default size

  const handleScrollCarousel = (e, direction) => {
    e.stopPropagation();
    const container = e.currentTarget.parentElement.querySelector(
      ".carousel-scroll-container",
    );
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Stop reading if chat is switched
  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [selectedUser, stopVoice]);

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMoreMessages) {
      loadMoreMessages();
    }
  };

  const filteredMessages = React.useMemo(
    () =>
      messages.filter((m) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        if (m.content && m.content.toLowerCase().includes(q)) return true;
        if (
          m.media &&
          m.media.some((media) => media.title && media.title.toLowerCase().includes(q))
        )
          return true;
        if (
          m.media &&
          m.media.some((media) => media.description && media.description.toLowerCase().includes(q))
        )
          return true;
        return false;
      }),
    [messages, searchQuery],
  );

  const canDeleteAllSelected =
    selectedMessages.length > 0 &&
    user &&
    selectedMessages.every(
      (id) => messages.find((m) => m._id === id)?.sender?._id === user._id,
    );

  return (
    <div
      className={`${selectedUser ? "flex" : "hidden md:flex"} w-full md:flex-1 min-w-0 flex-col ${getChatWindowBg(chatTheme)} h-full relative transition-colors`}
    >
      {selectedUser ? (
        <div className="flex flex-col flex-1 h-full min-h-0">
          {/* Chat Header */}
          <div
            className={`${getChatHeaderBg(chatTheme)} border-b p-3 flex items-center justify-between shadow-sm z-10 transition-colors`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setSearchParams({});
                }}
              className="md:hidden p-2 -ml-2 text-inherit opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 rounded-full relative transition-colors"
              >
                <ArrowLeft className="w-5 h-5 dark:text-gray-300" />
                {conversations.some((c) => c.unread > 0) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#f0f2f5]"></span>
                )}
              </button>
              <Link
                className={`flex gap-1 ${selectedUser.isGroup ? "cursor-pointer" : "hover:no-underline"}`}
                to={selectedUser.isGroup ? "#" : `/profile/${selectedUser._id}`}
                onClick={(e) => {
                  if (selectedUser.isGroup) {
                    e.preventDefault();
                    setShowGroupInfoModal(true);
                  }
                }}
              >
                <UserInfo user={selectedUser} showText={false} />
                <div>
                  <h2 className="font-bold truncate text-current">
                    {selectedUser.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs opacity-70">
                    <span>
                      {selectedUser.role} •{" "}
                      {selectedUser.department?.name || "General"}
                    </span>
                    {isTyping ? (
                      <span className="font-bold animate-pulse">typing...</span>
                    ) : selectedUser.isDnd ? (
                      <span className="font-medium">Do Not Disturb</span>
                    ) : selectedUser.isOnline ? (
                      <span className="font-medium">Online</span>
                    ) : selectedUser.lastSeen ? (
                      <span className="hidden sm:inline">
                        • last seen{" "}
                        {new Date(selectedUser.lastSeen).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsSearching(!isSearching)}
                className="p-2 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                  className="p-2 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showHeaderMenu && (
                  <div
                    className={`absolute right-0 mt-2 ${getChatHeaderBg(chatTheme)} shadow-xl border rounded-lg py-1 w-48 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right`}
                  >
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        setIsMultiSelectMode(true);
                      }}
                  className="w-full text-left px-4 py-2 text-sm text-inherit opacity-90 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" /> Select Messages
                    </button>
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        handleToggleBlock(selectedUser._id);
                      }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                    >
                      {blockedUsers?.includes(selectedUser._id) ? (
                        <>
                          <Unlock className="w-4 h-4" /> Unblock User
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" /> Block User
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        handleToggleFavorite();
                      }}
                  className="w-full text-left px-4 py-2 text-sm text-inherit opacity-90 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${selectedUser.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
                      />
                      {selectedUser.isFavorite
                        ? "Remove from Favorites"
                        : "Add to Favorites"}
                    </button>
                    {selectedUser.isGroup && (
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setShowGroupInfoModal(true);
                        }}
                    className="w-full text-left px-4 py-2 text-sm text-inherit opacity-90 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 border-t border-inherit/20 mt-1 pt-1 transition-colors"
                      >
                        <Users className="w-4 h-4" /> Group Info
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        handleClearChat();
                      }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Clear Chat
                    </button>
                <div className="border-t border-inherit/20 mt-1 pt-1">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-inherit opacity-90">
                        <span className="flex items-center gap-2">
                          <Languages className="w-4 h-4" /> Target Lang:
                        </span>
                        <select
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full p-2 border border-inherit/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-current bg-black/5 dark:bg-white/5 text-inherit font-medium text-xs ml-2"
                        >
                          <option
                            value="English"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            English
                          </option>
                          <option
                            value="Spanish"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Spanish
                          </option>
                          <option
                            value="French"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            French
                          </option>
                          <option
                            value="Hindi"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Hindi
                          </option>
                          <option
                            value="German"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            German
                          </option>
                          <option
                            value="Japanese"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Japanese
                          </option>
                          <option
                            value="Arabic"
                            className={getOptionClasses(appTheme, isDark)}
                          >
                            Arabic
                          </option>
                        </select>
                      </div>
                      <button
                        onClick={handleTranslateChat}
                    className="w-full text-left px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 flex items-center gap-3 transition-colors"
                      >
                        <Languages className="w-4 h-4" /> Translate Entire Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* In-Chat Search Bar */}
          {isSearching && (
            <div
              className={`${getChatHeaderBg(chatTheme)} p-2 px-4 shadow-sm border-b flex items-center gap-2 animate-in slide-in-from-top-2`}
            >
            <Search className="w-4 h-4 text-current opacity-50" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search this chat..."
                className="flex-1 bg-transparent outline-none text-sm text-current placeholder-current opacity-90"
              />
              <button
                onClick={() => {
                  setIsSearching(false);
                  setSearchQuery("");
                }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full text-inherit opacity-70 hover:opacity-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Pinned Messages Bar */}
          {messages.filter((m) => m.isPinned).length > 0 && (
            <div
              className={`${getChatHeaderBg(chatTheme)} backdrop-blur-md border-b px-4 py-2 flex flex-col gap-1 shadow-sm z-10 max-h-24 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full opacity-95`}
            >
              {messages
                .filter((m) => m.isPinned)
                .map((pinnedMsg) => (
                  <div
                    key={`pinned-${pinnedMsg._id}`}
                    className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-inherit/30 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-inherit"
                    onClick={() => {
                      const element = document.getElementById(
                        `msg-${pinnedMsg._id}`,
                      );
                      if (element) {
                        element.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        element.classList.add(
                          "ring-2",
                          "ring-current",
                          "bg-black/5",
                          "dark:bg-white/5",
                        );
                        setTimeout(
                          () =>
                            element.classList.remove(
                              "ring-2",
                              "ring-current",
                              "bg-black/5",
                              "dark:bg-white/5",
                            ),
                          2000,
                        );
                      }
                    }}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-inherit opacity-80 flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Pinned Message
                      </span>
                      <span className="text-sm opacity-90 truncate w-full">
                        {pinnedMsg.content ||
                          (pinnedMsg.mediaUrl ? "Attachment" : "Message")}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Messages List */}
          <div
            className="flex-1 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-4 flex flex-col gap-4 relative"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {hasMoreMessages && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <div
                  className="loader"
                  style={{ "--s": "15px", "--g": "3px" }}
                ></div>
              </div>
            )}
            {loadingMessages && messages.length === 0 ? (
              <div className="flex justify-center items-center h-full">
                <div
                  className="loader"
                  style={{ "--s": "20px", "--g": "4px" }}
                ></div>
              </div>
            ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="flex justify-center items-center h-full text-inherit opacity-60 font-medium">
                No messages match "{searchQuery}"
              </div>
            ) : (
              filteredMessages.map((msg, index) => {
                const isMe = msg.sender?._id === user._id;
                const isEdited = msg.isEdited;
                const isSelected = selectedMessages.includes(msg._id);

                const toggleSelection = () => {
                  if (isSelected) {
                    setSelectedMessages((prev) =>
                      prev.filter((id) => id !== msg._id),
                    );
                  } else {
                    setSelectedMessages((prev) => [...prev, msg._id]);
                  }
                };

                return (
                  <div
                    key={msg._id || index}
                    id={`msg-${msg._id}`}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} transition-all duration-500`}
                  >
                    {isMultiSelectMode && (
                      <div
                        className="flex items-center justify-center px-2 cursor-pointer"
                        onClick={toggleSelection}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                      className="w-5 h-5 rounded border-inherit/30 text-current focus:ring-current cursor-pointer pointer-events-none"
                        />
                      </div>
                    )}
                    <div
                      className={`p-4 pt-6 mt-2 rounded-2xl shadow-sm relative group max-w-[85%] md:max-w-[75%] break-words transition-all duration-500 ${getBubbleClasses(chatTheme, isMe)} ${isMe ? "rounded-br-none" : "rounded-tl-none"} ${isMultiSelectMode && isSelected ? "ring-2 ring-current shadow-md" : ""}`}
                      onClick={() => {
                        if (isMultiSelectMode) toggleSelection();
                      }}
                    >
                      {/* Sender Name in Group Chats */}
                      {!isMe && selectedUser?.isGroup && (
                        <div className="text-xs font-bold text-inherit opacity-80 mb-1">
                          {msg.sender?.name || "User"}
                        </div>
                      )}
                      {/* Message Actions */}
                      {!editingMessageId && (
                        <div
                          className={`absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isMultiSelectMode ? "hidden" : ""}`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVoice(msg._id, msg.content);
                            }}
                          className={`p-1 rounded-full ${isMe ? "hover:bg-black/20 text-inherit bg-black/5 md:bg-transparent" : "hover:bg-black/10 dark:hover:bg-white/10 text-inherit bg-black/5 dark:bg-white/5 md:bg-transparent"}`}
                            title={
                              speakingState.id === msg._id
                                ? "Stop Reading"
                                : "Read Aloud"
                            }
                          >
                            {speakingState.id === msg._id ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(
                                menuOpenId === msg._id ? null : msg._id,
                              );
                            }}
                          className={`p-1 rounded-full ${isMe ? "hover:bg-black/20 text-inherit bg-black/5 md:bg-transparent" : "hover:bg-black/10 dark:hover:bg-white/10 text-inherit bg-black/5 dark:bg-white/5 md:bg-transparent"}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuOpenId === msg._id && (
                            <div
                              className={`absolute ${isMe ? "right-0 origin-top-right" : "left-0 origin-top-left"} top-8 shadow-lg border border-inherit/30 rounded-lg py-1 w-32 z-50 overflow-hidden ${getChatHeaderBg(chatTheme)} animate-in fade-in zoom-in-95 duration-200`}
                            >
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(msg.content);
                                  setMenuOpenId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                              >
                                <Copy className="w-3 h-3" /> Copy Text
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTranslateMessage(msg, e);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                              >
                                <Languages className="w-3 h-3" /> Translate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSingleForward(msg);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                              >
                                <Forward className="w-3 h-3" /> Forward
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePinMessage(msg);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                              >
                                {msg.isPinned ? (
                                  <PinOff className="w-3 h-3" />
                                ) : (
                                  <Pin className="w-3 h-3" />
                                )}
                                {msg.isPinned ? "Unpin" : "Pin Message"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingToMessage(msg);
                                  setMenuOpenId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                              >
                                <Reply className="w-3 h-3" /> Reply
                              </button>
                              {isMe && (
                                <>
                                  <button
                                    onClick={() => handleEditMessage(msg)}
                                    className="w-full text-left px-3 py-2 text-sm text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMessage(msg._id)}
                                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Edit / Display */}
                      <div className="w-full">
                        {msg.isPinned && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-inherit opacity-80 mb-1">
                            <Pin className="w-3 h-3" /> Pinned
                          </div>
                        )}
                        {/* Reply Quote Block */}
                        {msg.replyToMessage && (
                          <div
                          className="mb-2 p-2 bg-black/5 dark:bg-white/10 rounded-lg border-l-4 border-current text-sm cursor-pointer hover:bg-black/10 transition-colors"
                            onClick={() => {
                              const element = document.getElementById(
                                `msg-${msg.replyToMessage._id}`,
                              );
                              if (element) {
                                element.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                element.classList.add(
                                "ring-2",
                                "ring-current",
                                "bg-black/5",
                                "dark:bg-white/5",
                                );
                                setTimeout(
                                  () =>
                                    element.classList.remove(
                                    "ring-2",
                                    "ring-current",
                                    "bg-black/5",
                                    "dark:bg-white/5",
                                    ),
                                  2000,
                                );
                              }
                            }}
                          >
                          <span className="font-bold text-inherit opacity-90 block text-xs">
                              {msg.replyToMessage.senderName}
                            </span>
                        <span className="text-inherit opacity-80 truncate block text-xs">
                              {msg.replyToMessage.content ||
                                (msg.replyToMessage.mediaUrl
                                  ? "Photo/Video"
                                  : "Message")}
                            </span>
                          </div>
                        )}
                        {editingMessageId === msg._id ? (
                          <div className="w-full min-w-[250px] bg-black/5 dark:bg-white/5 p-2 rounded-xl shadow-inner border border-inherit/30 mt-2">
                            <PostComposer
                              value={editContent}
                              onChange={setEditContent}
                              onSend={submitEdit}
                              placeholder="Edit message..."
                              user={user}
                              attachments={editAttachments}
                              onAddFiles={(e) => {
                                let incoming = e;
                                if (e.target) {
                                  incoming = Array.from(e.target.files).map(
                                    (f) => ({
                                      file: f,
                                      previewUrl: URL.createObjectURL(f),
                                      type: f.type.startsWith("video")
                                        ? "video"
                                        : "image",
                                    }),
                                  );
                                  e.target.value = null;
                                }
                                setEditAttachments((prev) => [
                                  ...prev,
                                  ...incoming,
                                ]);
                              }}
                              onRemoveFile={(idx) => {
                                setEditAttachments((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                              }}
                              hideInternalPreview={false}
                            />
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditAttachments([]);
                                }}
                                className="px-3 py-1.5 text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg transition-colors border border-inherit/30 font-bold"
                              >
                                Cancel Edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {translatingMsgId === msg._id && (
                              <div className="text-xs opacity-60 mb-1 flex items-center gap-1">
                                <div
                                  className="loader"
                                  style={{ "--s": "10px", "--g": "2px" }}
                                ></div>{" "}
                                Translating...
                              </div>
                            )}
                            {translatedMessages[msg._id] && (
                            <div className="text-xs opacity-80 mb-2 p-2 bg-black/5 dark:bg-white/10 rounded-lg border-l-2 border-current shadow-sm">
                              <span className="font-bold text-inherit opacity-90 block mb-0.5 text-[10px] uppercase">
                                  Translated ({targetLanguage}):
                                </span>
                                {translatedMessages[msg._id]}
                              </div>
                            )}
                            {speakingState.id === msg._id ? (
                              <div className={`pr-6 break-words`}>
                                <HighlightedText
                                  text={msg.content}
                                  charIndex={speakingState.charIndex}
                                  charLength={speakingState.charLength}
                                  customClass={
                                    HIGHLIGHT_STYLES[highlightStyle]?.classes
                                  }
                                  speedClass={highlightSpeed}
                                  textSizeClass={textSize}
                                />
                              </div>
                            ) : (
                              <p
                                className={`whitespace-pre-wrap break-words pr-6 ${textSize}`}
                              >
                                {renderContentWithLinks(msg.content)}
                              </p>
                            )}
                          </>
                        )}
                        {/* Stack Link Preview and Media for maximum visibility */}
                        {editingMessageId !== msg._id && (
                          <div className="flex flex-col gap-2 w-full mb-2 mt-1">
                          {msg.linkPreview && (
                            <div className="flex overflow-y-visible w-full min-w-0">
                              <LinkPreviewCard
                                preview={msg.linkPreview}
                                className="w-full h-fit shadow-sm border border-inherit/30"
                              />
                            </div>
                          )}

                          {(() => {
                            const mediaList =
                              msg.media?.length > 0
                                ? msg.media.map((m) => {
                                    const mPath =
                                      typeof m === "string" ? m : m.path;
                                    return {
                                      url:
                                        mPath?.startsWith("http") ||
                                        mPath?.startsWith("blob:")
                                          ? mPath
                                          : `/${mPath}`,
                                      type:
                                        m.mimetype?.startsWith("video") ||
                                        m.mimetype === "youtube"
                                          ? "video"
                                          : m.mimetype?.startsWith("image")
                                            ? "image"
                                            : m.mimetype?.startsWith("audio")
                                              ? "audio"
                                              : "document",
                                      title: m.title || "",
                                      description: m.description || "",
                                      isDownloadable: m.isDownloadable ?? false,
                                      isPendingApproval: m.isPendingApproval,
                                      _id: typeof m === "string" ? m : m._id,
                                    };
                                  })
                                : [];

                            if (mediaList.length === 0) return null;

                            const masonryCols =
                              mediaList.length === 1
                                ? "columns-1"
                                : "columns-1 sm:columns-2";

                            return (
                              <div
                                className={`w-full flex-1 min-w-0 mt-2 ${masonryCols} gap-2 [&>div]:mb-2`}
                              >
                                {mediaList.map((media, mIdx) => (
                                  <div
                                    key={mIdx}
                                    className="break-inside-avoid relative w-full rounded-lg overflow-hidden shadow-sm bg-black/5 group/media flex flex-col"
                                  >
                                    {media.type === "video" ||
                                    /\.(mp4|webm|ogg|mov|qt|mkv)(\?.*)?$/i.test(
                                      media.url,
                                    ) ? (
                                      <UniversalVideoPlayer
                                        id={`chat-video-${msg._id}-${mIdx}`}
                                        url={media.url}
                                        mediaData={{ ...media, authorId: msg.sender?._id }}
                                        setFullscreenMedia={setFullscreenMedia}
                                        poster={
                                          media.url &&
                                          !media.url.startsWith("blob:") &&
                                          /\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(
                                            media.url,
                                          )
                                            ? media.url.replace(
                                                /\.[^/.]+$/,
                                                "_thumb.jpg",
                                              )
                                            : undefined
                                        }
                                        controls
                                        muted
                                        controlsList={
                                          !(
                                            media.isDownloadable ||
                                            isMe ||
                                            user.role === "Admin"
                                          )
                                            ? "nodownload"
                                            : ""
                                        }
                                        onContextMenu={(e) =>
                                          e.preventDefault()
                                        }
                                        loop
                                        playsInline
                                        preload="metadata"
                                        className="w-full aspect-video bg-black rounded-lg object-contain"
                                      />
                                    ) : media.type === "image" ||
                                      /\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i.test(
                                        media.url,
                                      ) ? (
                                      <img
                                        src={media.url}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-contain bg-black/5 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFullscreenMedia({
                                            url: media.url,
                                            type: "image",
                                            isDownloadable:
                                              media.isDownloadable,
                                            authorId: msg.sender?._id,
                                            title: media.title,
                                          });
                                        }}
                                      />
                                    ) : (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewerFile({
                                            url: media.url,
                                            title: media.title || "Document",
                                            type: media.type,
                                            authorId: msg.sender?._id,
                                            isDownloadable:
                                              media.isDownloadable,
                                          });
                                        }}
                                        className="w-full h-full flex flex-col items-center justify-center bg-black/10 cursor-pointer hover:bg-black/20 transition-colors py-10"
                                      >
                                        <FileText className="w-12 h-12 opacity-50 mb-2 text-inherit" />
                                        <span className="text-xs font-bold text-inherit opacity-70">
                                          View Document
                                        </span>
                                      </div>
                                    )}
                                    <div className="absolute top-2 right-2 z-20 opacity-100 md:opacity-0 md:group-hover/media:opacity-100 transition-opacity flex gap-2">
                                      {(media.isDownloadable ||
                                        isMe ||
                                        user.role === "Admin") && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                          downloadMedia(
                                              media.url,
                                            media.title || `Chat_Media_${mIdx + 1}`,
                                            );
                                          }}
                                          className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors shadow-sm border border-white/20"
                                          title="Download media"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (
                                            media.type === "document" ||
                                            media.type === "audio"
                                          ) {
                                            setViewerFile({
                                              url: media.url,
                                              title: media.title || "Document",
                                              type: media.type,
                                              authorId: msg.sender?._id,
                                              isDownloadable:
                                                media.isDownloadable,
                                            });
                                          } else {
                                            let sTime = 0;
                                            let isPlaying = true;
                                            const vidNode =
                                              document.getElementById(
                                                `chat-video-${msg._id}-${mIdx}`,
                                              );
                                            if (vidNode) {
                                              sTime = vidNode.currentTime;
                                              isPlaying = !vidNode.paused;
                                              vidNode.pause();
                                            }
                                            setFullscreenMedia({
                                              url: media.url,
                                              type:
                                                media.type === "video" ||
                                                /\.(mp4|webm|ogg|mov|qt|mkv)(\?.*)?$/i.test(
                                                  media.url,
                                                )
                                                  ? "video"
                                                  : "image",
                                              startTime: sTime,
                                              isPlaying: isPlaying,
                                              isDownloadable:
                                                media.isDownloadable,
                                              authorId: msg.sender?._id,
                                              title: media.title,
                                            });
                                          }
                                        }}
                                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors shadow-sm border border-white/20"
                                        title="Maximize"
                                      >
                                        <Maximize2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    {(media.title || media.description) && (
                                      <div className="bg-black/5 dark:bg-white/5 p-2.5 border-t border-inherit/10 text-inherit text-left">
                                        {media.title && (
                                          <h4 className="font-bold text-sm leading-tight">
                                            {media.title}
                                          </h4>
                                        )}
                                        {media.description && (
                                          <p className="text-[12px] opacity-80 mt-1 line-clamp-2">
                                            {media.description}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {media.isPendingApproval && (
                                      <div className="absolute bottom-2 left-2 z-30 bg-yellow-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-yellow-400 shadow-lg pointer-events-none">
                                        ⏳ Pending Admin Consent (&gt;3GB)
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          </div>
                        )}
                      </div>
                      <div
                    className="flex items-center justify-end gap-1 mt-1"
                      >
                        <span
                      className="text-[10px] text-inherit opacity-70 ml-1"
                        >
                          {isEdited && (
                            <span className="mr-1 italic opacity-80">
                              (edited)
                            </span>
                          )}
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMe && (
                          <CheckCheck
                            className={`w-3 h-3 ${msg.read ? "text-current" : "opacity-50"}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {isTyping && (
              <div className="flex justify-start">
                <div
                  className={`p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center justify-center gap-1.5 w-16 h-12 mt-2 mb-2 transition-colors duration-500 ${getBubbleClasses(chatTheme, false)}`}
                >
                  <span
                    className="w-2 h-2 bg-current opacity-60 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-current opacity-60 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-current opacity-60 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showScrollDown && (
            <button
              onClick={() =>
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className={`absolute bottom-24 right-6 p-2.5 rounded-full shadow-xl z-30 animate-in fade-in zoom-in duration-200 transition-transform active:scale-95 ${getPrimaryButtonClasses(chatTheme)}`}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}

          {isMultiSelectMode && (
            <div
              className={`p-3 ${getChatComposerBg(chatTheme)} border-t z-20 flex items-center justify-between shadow-lg`}
            >
              <span className="text-sm font-semibold text-current opacity-80">
                {selectedMessages.length} Selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setSelectedMessages([]);
                  }}
                  className="px-4 py-2 text-sm font-bold opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {canDeleteAllSelected && (
                  <button
                    onClick={handleMultiDelete}
                    className="px-4 py-2 text-sm font-bold bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2 border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
                <button
                  onClick={handleMultiForward}
                  disabled={selectedMessages.length === 0}
                  className="px-4 py-2 text-sm font-bold bg-black/10 dark:bg-white/10 text-inherit rounded-lg hover:bg-black/20 dark:hover:bg-white/20 disabled:opacity-50 transition-colors flex items-center gap-2 border border-inherit/30"
                >
                  <Forward className="w-4 h-4" /> Forward
                </button>
              </div>
            </div>
          )}

          {isMultiSelectMode ? null : blockedUsers?.includes(
              selectedUser._id,
            ) ? (
            <div
              className={`p-4 ${getChatComposerBg(chatTheme)} border-t z-20 text-center text-sm font-medium text-red-500`}
            >
              You have blocked this user. Unblock to send messages.
            </div>
          ) : (
            <div
              className={`p-2 ${getChatComposerBg(chatTheme)} border-t z-20 transition-colors`}
            >
              <div className="mt-1">
                {replyingToMessage && (
                  <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 border-l-4 border-current rounded-t-2xl mb-[-12px] relative z-10 mx-2 shadow-sm">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-inherit opacity-90">
                        Replying to {replyingToMessage.sender?.name}
                      </span>
                  <span className="text-sm text-inherit opacity-80 truncate">
                        {replyingToMessage.content || "Attachment"}
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingToMessage(null)}
                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-inherit opacity-70 hover:opacity-100"
                    >
                  <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* AI Smart Replies */}
                {suggestedReplies.length > 0 && (
                  <div className="flex gap-2 p-2 overflow-x-auto [&::-webkit-scrollbar]:hidden mx-2 mb-1 animate-in fade-in slide-in-from-bottom-2">
                    {suggestedReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          typingHandler({ target: { value: reply } });
                          setSuggestedReplies([]);
                        }}
                        className="whitespace-nowrap px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit border border-inherit/30 rounded-full text-xs font-bold transition-colors shadow-sm"
                      >
                        {reply}
                      </button>
                    ))}
                    <button
                      onClick={() => setSuggestedReplies([])}
                      className="p-1.5 opacity-50 hover:opacity-100 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {suggestedReplies.length === 0 &&
                  !isGeneratingReplies &&
                  messages.length > 0 && (
                    <div className="mx-4 mb-2 flex justify-end">
                      <button
                        onClick={handleSuggestReplies}
                        className="text-[10px] font-bold flex items-center gap-1 text-inherit opacity-70 hover:opacity-100 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-full transition-colors shadow-sm border border-inherit/20"
                      >
                        <Sparkles className="w-3 h-3" /> Smart Reply
                      </button>
                    </div>
                  )}
                {isGeneratingReplies && (
                  <div className="mx-4 mb-2 flex justify-end">
                    <span className="text-[10px] font-bold flex items-center gap-1 text-inherit opacity-70 bg-black/5 dark:bg-white/5 border border-inherit/20 px-2 py-1 rounded-full">
                      <div
                        className="loader"
                        style={{
                          "--s": "10px",
                          "--g": "2px",
                          color: "currentColor",
                        }}
                      ></div>{" "}
                      Thinking...
                    </span>
                  </div>
                )}

                <PostComposer
                  value={newMessage}
                  onChange={typingHandler}
                  onSend={handleSendMessage}
                  isSending={isSending}
                  placeholder="Type a message..."
                  user={user}
                  attachments={attachments}
                  onAddFiles={handleAddFiles}
                  onRemoveFile={handleRemoveFile}
                  setFullscreenMedia={setFullscreenMedia}
                  hideInternalPreview={false}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`flex-1 flex flex-col items-center justify-center p-8 border-none ${getChatWindowBg(chatTheme)} transition-colors`}
        >
          <Users className="w-16 h-16 mb-4 opacity-50 text-current" />
          <h3 className="text-xl font-bold opacity-80 text-current">
            Select a user to start chatting
          </h3>
          <p className="mt-2 opacity-60 text-current">
            Choose from the list on the left to send a message.
          </p>
        </div>
      )}

      {viewerFile && (
        <div className="absolute z-[10000]">
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center text-white">
                <div
                  className="loader"
                  style={{ "--s": "20px", "--g": "4px" }}
                ></div>
              </div>
            }
          >
            <DocumentViewer
              url={viewerFile.url}
              title={viewerFile.title || "Document"}
              media={viewerFile}
              currentUser={user}
              onClose={() => setViewerFile(null)}
              canEdit={false}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};
export default ChatWindow;
