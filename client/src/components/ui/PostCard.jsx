import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MessageCircle,
  ThumbsUp,
  Send,
  MoreVertical,
  Trash2,
  Edit2,
  Share2,
  Copy,
  Check,
  X,
  Download,
  UserPlus,
  Bookmark,
  Volume2,
  VolumeX,
  RefreshCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Languages,
  Eye,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  renderContentWithLinks,
  HIGHLIGHT_STYLES,
  HighlightedText,
} from "@/utils/textUtils.jsx";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import YouTubePlayer from "./YouTubePlayer";
import UniversalVideoPlayer from "@/components/ui/UniversalVideoPlayer";
import { useAiFeatures } from "@/hooks/useAiFeatures";
import { useTheme } from "@/context/ThemeContext";
import UserInfo from "./UserInfo";
import PostComposer from "@/components/ui/PostComposer";
import { getCardThemeClasses, getOptionClasses } from "@/utils/themeUtils";
import { downloadMedia } from "@/utils/downloadUtils";

const REACTION_EMOJIS = ["👍", "👎", "❤️", "😂", "😮", "😢", "😡"];

const PostCard = ({
  post,
  currentUser,
  onLike,
  onComment,
  onDelete,
  onEdit,
  onRestore,
  onShare,
  onBookmark,
  onConnect,
  onDeleteComment,
  onEditComment,
  onRemoveAttachment,
  hasSentRequest,
  setFullscreenMedia,
  hideHeader = false,
  isMultiSelectMode = false,
  isSelected = false,
  toggleSelection,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.material?.description || "");
  const [editIsDownloadable, setEditIsDownloadable] = useState(
    post.isDownloadable ?? false,
  );
  const [editAttachments, setEditAttachments] = useState([]);
  const [showMenu, setShowMenu] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [translatedText, setTranslatedText] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const { appTheme, isDark } = useTheme();

  const [editMediaDownloadable, setEditMediaDownloadable] = useState([]);

  const { speakingState, toggleVoice, stopVoice, isTranslating, translateText } = useAiFeatures();

  useEffect(() => {
    if (isEditing) {
      setEditMediaDownloadable(
        post.material?.media?.length
          ? post.material.media.map(
              (m) => m.isDownloadable ?? post.isDownloadable ?? false,
            )
          : [],
      );
    }
  }, [isEditing, post]);

  const displayDescription = post.description !== undefined ? post.description : (post.material?.description || post.content || "");

  // Media Overlay Toggle State
  const [hiddenMediaDetails, setHiddenMediaDetails] = useState({});
  const toggleMediaDetails = (idx) => {
    setHiddenMediaDetails((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

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

  const highlightStyle = localStorage.getItem("aiHighlightStyle") || "yellow";
  const highlightSpeed =
    localStorage.getItem("aiHighlightSpeed") || "duration-300";
  const textSize = localStorage.getItem("aiTextSize") || "text-[15px]"; // Default size

  useEffect(() => {
    return () => {
      if (speakingState.id === post._id) {
        stopVoice();
      }
    };
  }, [speakingState.id, post._id, stopVoice]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMenu && !e.target.closest(".post-menu")) setShowMenu(false);
      if (showReactions && !e.target.closest(".reaction-popup"))
        setShowReactions(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, showReactions]);

  const handleStartEditing = () => {
    // If this post is a parsed lecture, editing should be handled by the parent's modal
    if (post.title && post.subjectLabel) {
      if (onEdit) onEdit(post);
      setShowMenu(false);
      return;
    }
    setIsEditing(true);
    setEditContent(post.material?.description || post.content || "");
    setEditIsDownloadable(post.isDownloadable || false);
    setEditAttachments([]);
    setShowMenu(false);
  };

  const handleSaveEdit = () => {
    if (
      !editContent.trim() &&
      editAttachments.length === 0 &&
      (!post.material?.media || post.material.media.length === 0)
    )
      return;

    const formData = new FormData();
    formData.append("content", editContent);

    if (post.material?.media && post.material.media.length > 0) {
      post.material.media.forEach((m) => formData.append("retainedMediaIds", typeof m === 'string' ? m : m._id));
    }

    editMediaDownloadable.forEach((d) =>
      formData.append("existingMediaDownloadable", d),
    );

    editAttachments.forEach((att) => {
      if (att.file) {
        formData.append("files", att.file);
      } else if (att.previewUrl) {
        formData.append("newMediaUrls", att.previewUrl);
        formData.append("newMediaTypes", att.type || "image");
      }
      formData.append("mediaTitles", att.title?.trim() || " ");
      formData.append("mediaDescriptions", att.description?.trim() || " ");
      formData.append("mediaDownloadable", att.isDownloadable ?? false);
    });

    onEdit(post._id, formData, editAttachments, editMediaDownloadable);
    setIsEditing(false);
    setEditAttachments([]);
  };

  const startLongPress = () => {
    if (!onLike) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowReactions(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTranslate = async () => {
    if (!displayDescription) return;
    setShowMenu(false);
    try {
      const translation = await translateText(displayDescription, targetLanguage);
      setTranslatedText(translation);
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Translation failed. ❌" }),
      );
    }
  };

  const isOwnPost = post.author?._id === currentUser?._id;
  const canModify = isOwnPost || currentUser?.role === "Admin";
  const userReaction = post.reactions?.find((r) => r.user === currentUser?._id);
  const isLiked = !!userReaction;


  return (
    <div
      className={`${getCardThemeClasses(appTheme)} rounded-xl shadow-sm border hover:shadow-md transition-all mb-4 break-inside-avoid text-inherit ${isMultiSelectMode && isSelected ? "ring-2 ring-indigo-500 border-indigo-500" : "border-inherit"} ${isMultiSelectMode ? "cursor-pointer" : ""}`}
      onClick={(e) => {
        if (isMultiSelectMode && toggleSelection) {
          toggleSelection();
        }
      }}
    >
      {/* Header */}
      {!hideHeader && (
        <div className="p-4 flex items-center justify-between border-b border-inherit/30 mb-2">
          <Link
            to={`/profile/${post.author?._id || post.author}`}
            className="p-2 text-sm text-left text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors hover:no-underline"
          >
            <UserInfo
              user={post.author}
              nameClassName="group-hover:opacity-100 transition-colors"
              subtitle={new Date(post.createdAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            {!isOwnPost && onConnect && !hasSentRequest && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onConnect(post.author?._id);
                }}
                className=" p-2 text-sm text-left text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
          </Link>

          <div className="relative post-menu flex items-center">
            {isMultiSelectMode ? (
              <div className="flex items-center justify-center p-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                />
              </div>
            ) : (
              <>
                <button
                  onClick={() => toggleVoice(post._id, displayDescription)}
                  className="p-2 text-sm text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                  title={
                    speakingState.id === post._id
                      ? "Stop Reading"
                      : "Read Aloud"
                  }
                >
                  {speakingState.id === post._id ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-sm text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </>
            )}
            {showMenu && (
              <div
                className={`absolute right-0 mt-1 shadow-lg border border-inherit/30 rounded-lg py-1 w-44 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-top-right ${getCardThemeClasses(appTheme)}`}
              >
                <button
                  onClick={() => {
                      navigator.clipboard.writeText(displayDescription);
                    setShowMenu(false);
                  }}
                  className="px-3 py-2 text-sm text-left text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Copy className="w-4 h-4" /> Copy Text
                </button>
                {onShare && (
                  <button
                    onClick={() => {
                      onShare(post);
                      setShowMenu(false);
                    }}
                    className="px-3 py-2 text-sm text-left text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4" /> Share in Chat
                  </button>
                )}
                {canModify && onEdit && (
                  <button
                    onClick={handleStartEditing}
                    className="px-3 py-2 text-sm text-inherit text-left hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                )}
                {onRestore && post.isDeleted && (
                  <button
                    onClick={() => {
                      onRestore(post._id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-2 text-sm text-left hover:bg-green-500/10 text-green-600 flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Restore
                  </button>
                )}
                {canModify && onDelete && (
                  <button
                    onClick={() => {
                      onDelete(post._id);
                      setShowMenu(false);
                    }}
                    className="px-3 py-2 text-sm text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
                <div className="border-t border-inherit/30 mt-1 pt-1">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-inherit opacity-80">
                    <span className="flex items-center gap-2">
                      <Languages className="w-4 h-4" /> To:
                    </span>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-current border border-inherit/30 rounded p-1 text-xs text-inherit font-medium"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTranslate();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-blue-500 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors font-semibold"
                  >
                    <Languages className="w-3 h-3" /> Translate Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        className="relative select-none"
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onTouchMove={endLongPress}
        onContextMenu={(e) => {
          if (onLike) e.preventDefault();
        }}
      >
        {showReactions && (
          <div
            className={`reaction-popup absolute -top-14 left-4 shadow-xl border border-inherit/30 rounded-full px-4 py-2 flex gap-3 z-50 animate-in fade-in zoom-in-95 duration-200 items-center ${getCardThemeClasses(appTheme)}`}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onLike(post._id, emoji);
                  setShowReactions(false);
                }}
                className="hover:scale-125 transition-transform text-2xl leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className={`px-4 pb-2 ${hideHeader ? "pt-4" : ""}`}>
          {hideHeader && (
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1" />
              <div className="relative post-menu flex items-center">
                {isMultiSelectMode ? (
                  <div className="flex items-center justify-center p-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer pointer-events-none"
                    />
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleVoice(post._id, post.material?.description || "")}
                      className="p-2 text-sm text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                      title={
                        speakingState.id === post._id
                          ? "Stop Reading"
                          : "Read Aloud"
                      }
                    >
                      {speakingState.id === post._id ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 text-sm text-inherit rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </>
                )}
                {showMenu && (
                  <div
                    className={`absolute right-0 mt-1 shadow-lg border border-inherit/30 rounded-lg py-1 w-44 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200 origin-top-right ${getCardThemeClasses(appTheme)}`}
                  >
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(post.material?.description || "");
                        setShowMenu(false);
                      }}
                      className="px-3 py-2 text-sm text-left text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                    >
                      <Copy className="w-4 h-4 " /> Copy Text
                    </button>
                    {onShare && (
                      <button
                        onClick={() => {
                          onShare(post);
                          setShowMenu(false);
                        }}
                        className="px-3 py-2 text-sm text-left text-inherit hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                      >
                        <Share2 className="w-4 h-4" /> Share in Chat
                      </button>
                    )}
                    {canModify && onEdit && (
                      <button
                        onClick={handleStartEditing}
                        className="px-3 py-2 text-sm text-inherit text-left hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" /> Edit Post
                      </button>
                    )}
                    {onRestore && post.isDeleted && (
                      <button
                        onClick={() => {
                          onRestore(post._id);
                          setShowMenu(false);
                        }}
                        className="px-3 py-2 text-sm text-left hover:bg-green-500/10 text-green-600 flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" /> Restore Post
                      </button>
                    )}
                    {canModify && onDelete && (
                      <button
                        onClick={() => {
                          onDelete(post._id);
                          setShowMenu(false);
                        }}
                        className="px-3 py-2 text-sm text-left hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Post
                      </button>
                    )}
                    <div className="border-t border-inherit/30 mt-1 pt-1">
                      <div className="px-4 py-2 flex items-center justify-between text-sm text-inherit opacity-80">
                        <span className="flex items-center gap-2">
                          <Languages className="w-4 h-4" /> To:
                        </span>
                        <select
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-black/5 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-current border border-inherit/30 rounded p-1 text-xs text-inherit font-medium"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTranslate();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-blue-500 hover:bg-black/10 dark:hover:bg-white/10 flex items-center gap-2 transition-colors font-semibold"
                      >
                        <Languages className="w-3 h-3" /> Translate Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {post.title && post.subjectLabel && !isEditing && (
            <div className="mb-3 mt-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border border-blue-500/20 flex items-center gap-1.5 shadow-sm">
                  <BookOpen className="w-3.5 h-3.5" />
                  {post.subjectLabel}
                </span>
                <span className="text-[11px] font-bold opacity-70 flex items-center gap-1.5 uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5" /> {post.views || 0} Views
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-inherit leading-tight">
                {post.title}
              </h3>
            </div>
          )}

          {isEditing ? (
            <div className="mb-2 mt-2 p-2 bg-black/5 dark:bg-white/5 rounded-2xl shadow-inner border border-inherit/30">
              <PostComposer
                value={editContent}
                onChange={setEditContent}
                onSend={handleSaveEdit}
                placeholder="Edit your post..."
                user={null}
                attachments={editAttachments}
                onAddFiles={(incoming) => {
                  let atts = incoming;
                  if (incoming.target) {
                    atts = Array.from(incoming.target.files).map((f) => ({
                      file: f,
                      previewUrl: URL.createObjectURL(f),
                      type: f.type.startsWith("video") ? "video" : "image",
                      title: f.name,
                      description: "",
                      isDownloadable: editIsDownloadable,
                    }));
                    incoming.target.value = null;
                  }
                  setEditAttachments((prev) => [...prev, ...atts]);
                }}
                onRemoveFile={(idx) =>
                  setEditAttachments((prev) => prev.filter((_, i) => i !== idx))
                }
                isDownloadable={editIsDownloadable}
                onIsDownloadableChange={(e) => {
                  const checked = e.target.checked;
                  setEditIsDownloadable(checked);
                  setEditAttachments((prev) =>
                    prev.map((a) => ({ ...a, isDownloadable: checked })),
                  );
                  setEditMediaDownloadable((prev) => prev.map(() => checked));
                }}
                setFullscreenMedia={setFullscreenMedia}
                hideInternalPreview={false}
              />
              <div className="flex justify-end mt-2 pr-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditAttachments([]);
                  }}
                  className="px-3 py-1.5 text-xs bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit rounded-lg transition-colors border border-inherit/30 font-bold"
                >
                  Cancel Edit
                </button>
              </div>
            </div>
          ) : speakingState.id === post._id ? (
            <div className="text-inherit break-words">
              <HighlightedText
                text={displayDescription}
                charIndex={speakingState.charIndex}
                charLength={speakingState.charLength}
                customClass={HIGHLIGHT_STYLES[highlightStyle]?.classes}
                speedClass={highlightSpeed}
                textSizeClass={textSize}
              />
            </div>
          ) : (
            <>
              <p
                className={`text-inherit whitespace-pre-wrap break-words ${textSize}`}
              >
                {renderContentWithLinks(displayDescription)}
              </p>

              {/* Link Preview */}
              {post.material?.linkPreview && (
                <LinkPreviewCard preview={post.material.linkPreview} />
              )}
            </>
          )}


          {isTranslating && (
            <div className="text-xs opacity-60 mb-2 mt-2 flex items-center gap-1">
              <div
                className="loader"
                style={{ "--s": "10px", "--g": "2px" }}
              ></div>{" "}
              Translating...
            </div>
          )}
          {translatedText && (
            <div className="text-sm opacity-90 mt-3 p-3 bg-black/5 dark:bg-white/10 rounded-lg border-l-2 border-blue-500 shadow-sm relative text-inherit">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTranslatedText("");
                }}
                className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="font-bold text-blue-500 block mb-1 text-[10px] uppercase">
                Translated ({targetLanguage}):
              </span>
              {translatedText}
            </div>
          )}

          {/* External Materials / Notes Links (Study Hub) */}
          {((post.englishAttachmentUrl && post.englishAttachmentUrl !== "none") || (post.hindiAttachmentUrl && post.hindiAttachmentUrl !== "none")) && !isEditing && (
            <div className="mt-5 pt-4 border-t border-inherit/20 flex flex-wrap gap-3">
              {post.englishAttachmentUrl && post.englishAttachmentUrl !== "none" && (
                <a
                  href={post.englishAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 rounded-xl text-sm font-bold transition-all border border-indigo-500/20 shadow-sm flex-1 sm:flex-none"
                >
                  <Download className="w-4 h-4" /> English Notes
                </a>
              )}
              {post.hindiAttachmentUrl && post.hindiAttachmentUrl !== "none" && (
                <a
                  href={post.hindiAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 rounded-xl text-sm font-bold transition-all border border-orange-500/20 shadow-sm flex-1 sm:flex-none"
                >
                  <Download className="w-4 h-4" /> Hindi Notes
                </a>
              )}
            </div>
          )}
        </div>

        {/* Link Preview (Independent of Media) */}

        {(() => {
          const mediaList =
            post.material?.media?.length > 0
              ? post.material.media.map((m, originalIndex) => {
                  const mPath = typeof m === 'string' ? m : m.path;
                  const safePath = typeof mPath === 'string' ? mPath.replace(/\\/g, "/") : "";
                  return {
                  url:
                    safePath.startsWith("http") || safePath.startsWith("blob:")
                      ? safePath
                      : `/${safePath}`,
                  type:
                m.mimetype === "youtube" || /youtube\.com|youtu\.be/i.test(safePath)
                  ? "youtube"
                  : m.mimetype?.startsWith("video") || /\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(safePath)
                  ? "video"
                  : m.mimetype?.startsWith("image") || /\.(jpeg|jpg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(safePath)
                  ? "image"
                  : m.mimetype?.startsWith("audio") || /\.(mp3|wav|m4a|ogg)(\?.*)?$/i.test(safePath)
                  ? "audio"
                  : "document",
                  title: m.title || "",
                  description: m.description || "",
                  isDownloadable:
                    m.isDownloadable ?? post.isDownloadable ?? false,
                  isPendingApproval: m.isPendingApproval,
                  _id: typeof m === 'string' ? m : m._id,
                  originalIndex
                }})
              : [];

          const hasLinkPreview = !!(post.material?.linkPreview && (post.material.linkPreview.url || post.material.linkPreview.mediaId || post.material.linkPreview.image));

          if (mediaList.length === 0 && !hasLinkPreview) return null;

          const visualMedia = mediaList.filter(m => ["image", "video", "youtube"].includes(m.type));
          const documentMedia = mediaList.filter(m => !["image", "video", "youtube"].includes(m.type));

          const totalItems = visualMedia.length + (hasLinkPreview ? 1 : 0);
const masonryCols = "columns-1";

          return (
            <div className="flex flex-col w-full">
            {totalItems > 0 && (
<div className="w-full mt-2 px-4 columns-1 gap-2 [&>div]:mb-2">

              {visualMedia.map((media) => {
                const mIdx = media.originalIndex;
                const isEmbed =
                media.url &&
                (media.type === "youtube" ||
                  media.type === "embed" ||
                  /youtube\.com|youtu\.be/i.test(media.url));
                  
                  const isItemDownloadable = isEditing
                  ? editMediaDownloadable[mIdx]
                  : media.isDownloadable;
                  
                  return (
                    <div
                    key={mIdx}
                    className="break-inside-avoid relative w-full rounded-lg overflow-hidden shadow-sm bg-black/5 group/media"
                    >
                      
                    {canModify && onRemoveAttachment && isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAttachment(post._id, mIdx);
                        }}
                        className="absolute top-2 left-2 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-full z-20 shadow-md"
                        title="Delete Attachment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    {/* Media Action Buttons */}
                    <div className="absolute top-2 right-2 z-20 opacity-100 md:opacity-0 md:group-hover/media:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (media.type === "document" || media.type === "audio") {
                            if (setFullscreenMedia) {
                              setFullscreenMedia({
                                url: media.url,
                                title: media.title || "Document",
                                type: media.type,
                                authorId: post.author?._id,
                                isDownloadable: isItemDownloadable,
                              });
                            }
                          } else {
                            let sTime = 0;
                            let isPlaying = true;
                            const vidNode = document.getElementById(
                              `media-video-${post._id}-${mIdx}`,
                            );
                            if (vidNode) {
                              sTime = vidNode.currentTime;
                              isPlaying = !vidNode.paused;
                              vidNode.pause();
                            }
                            setFullscreenMedia({
                              url: media.url,
                              type:
                            media.type === "youtube" || /youtube\.com|youtu\.be/i.test(media.url)
                              ? "youtube"
                              : media.type === "video" || /\.(mp4|webm|ogg|qt|mkv)(\?.*)?$/i.test(media.url)
                              ? "video"
                              : "image",
                              startTime: sTime,
                              isPlaying: isPlaying,
                              authorId: post.author?._id,
                              isDownloadable: isItemDownloadable,
                              title: media.title,
                            });
                          }
                        }}
                        className="p-1.5 rounded-full backdrop-blur-md transition-colors shadow-lg border bg-black/60 hover:bg-black/80 text-white border-white/20"
                        title="Maximize"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      {(isItemDownloadable ||
                        isOwnPost ||
                        currentUser?.role === "Admin" ||
                        isEditing) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditing) {
                              const nextVal = !editMediaDownloadable[mIdx];
                              setEditMediaDownloadable((prev) => {
                                const next = [...prev];
                                next[mIdx] = nextVal;
                                return next;
                              });
                              window.dispatchEvent(
                                new CustomEvent("showToast", {
                                  detail: nextVal
                                    ? "Downloads Allowed (This file) 🔓"
                                    : "Downloads Disabled (This file) 🔒",
                                }),
                              );
                            } else {
                              downloadMedia(
                                media.url,
                                media.title || `Media-${mIdx + 1}`,
                              );
                            }
                          }}
                          className={`p-1.5 rounded-full backdrop-blur-md transition-colors shadow-lg border ${isEditing && editMediaDownloadable[mIdx] ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-400" : "bg-black/60 hover:bg-black/80 text-white border-white/20"}`}
                          title={
                            isEditing
                              ? editMediaDownloadable[mIdx]
                                ? "Downloads Allowed (Click to Disable)"
                                : "Downloads Disabled (Click to Allow)"
                              : "Download this file"
                          }
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isEmbed ? (
                      <YouTubePlayer
                        url={media.url}
                        className="w-full aspect-video"
                      />
                    ) : media.type === "video" ||
                      /\.(mp4|webm|ogg|mov|qt|mkv)(\?.*)?$/i.test(media.url) ? (
                      <UniversalVideoPlayer
                        id={`media-video-${post._id}-${mIdx}`}
                        url={media.url}
                        mediaData={{ ...media, authorId: post.author?._id, isDownloadable: isItemDownloadable }}
                        setFullscreenMedia={setFullscreenMedia}
                        poster={
                          media.url &&
                          !media.url.startsWith("blob:") &&
                          /\.(mp4|webm|ogg|mkv|mov)(\?.*)?$/i.test(media.url)
                            ? media.url.replace(/\.[^/.]+$/, "_thumb.jpg")
                            : undefined
                        }
                        controls
                        muted
                        controlsList={
                          !(
                            isItemDownloadable ||
                            isOwnPost ||
                            currentUser?.role === "Admin"
                          )
                            ? "nodownload"
                            : ""
                        }
                        onContextMenu={(e) => e.preventDefault()}
                        loop
                        playsInline
                        preload="metadata"
                        className="w-full aspect-video bg-black rounded-lg object-contain"
                      />
                    ) : media.type === "image" ? (
                      <img
                        src={media.url}
                        alt="Post media"
                        referrerPolicy="no-referrer"
                        onClick={() => {
                          if (!isLongPressRef.current && setFullscreenMedia)
                            setFullscreenMedia({
                              url: media.url,
                              type: "image",
                              authorId: post.author?._id,
                              isDownloadable: isItemDownloadable,
                              title: media.title,
                            });
                        }}
                        className="w-full object-contain bg-black/5 cursor-pointer hover:opacity-95"
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    ) : null}

                    {/* Media Details - Tappable to Hide */}
                    {(media.title || media.description) &&
                      !hiddenMediaDetails[mIdx] && (
                        <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMediaDetails(mIdx);
                        }}
                        className="bg-black/5 dark:bg-white/5 p-3 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all z-10 border-t border-inherit/10 text-inherit"
                        title="Tap to hide details"
                        >
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
                );
              })}
          </div>
        )}
        {documentMedia.length > 0 && (
          <div className="px-4 mt-2 flex flex-col gap-2">
            {documentMedia.map((doc, dIdx) => {
              const mIdx = doc.originalIndex;
              const isItemDownloadable = isEditing ? editMediaDownloadable[mIdx] : doc.isDownloadable;
              return (
                <div key={mIdx} className="flex items-center justify-between bg-black/5 dark:bg-white/5 border border-inherit/20 p-3 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm group">
                  <div 
                    className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (setFullscreenMedia) {
                        setFullscreenMedia({
                          url: doc.url,
                          title: doc.title || "Document",
                          type: doc.type,
                          authorId: post.author?._id,
                          isDownloadable: isItemDownloadable,
                        });
                      }
                    }}
                  >
                    <div className="p-2.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                       <FileText className="w-5 h-5"/>
                    </div>
                    <div className="flex flex-col min-w-0">
                       <span className="font-bold text-sm truncate text-inherit group-hover:text-blue-500 transition-colors">{doc.title || `Attached Document ${dIdx + 1}`}</span>
                       {doc.description && <span className="text-xs opacity-70 truncate">{doc.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {canModify && onRemoveAttachment && isEditing && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAttachment(post._id, mIdx);
                        }} 
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20" 
                        title="Delete"
                      >
                         <Trash2 className="w-4 h-4"/>
                      </button>
                    )}
                    {(isItemDownloadable || isOwnPost || currentUser?.role === "Admin" || isEditing) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditing) {
                            const nextVal = !editMediaDownloadable[mIdx];
                            setEditMediaDownloadable(prev => { const next = [...prev]; next[mIdx] = nextVal; return next; });
                          } else {
                            downloadMedia(doc.url, doc.title || "Document");
                          }
                        }} 
                        className={`p-2 rounded-lg transition-colors border shadow-sm ${isEditing && editMediaDownloadable[mIdx] ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-400" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit border-inherit/30"}`} 
                        title={isEditing ? (editMediaDownloadable[mIdx] ? "Downloads Allowed" : "Downloads Disabled") : "Download"}
                      >
                         <Download className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
          );
        })()}
      </div>

      {hideHeader && (
        <div className="px-4 pb-3 border-t border-inherit/30 mt-2 pt-2">
          <p className="text-xs opacity-60">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Footer Actions */}
      {!hideHeader && onLike && onComment && (
        <>
          <div className="px-4 py-2 border-t border-inherit/30 mt-1">
            <div className="flex items-center justify-between">
              <button
                onClick={() => onLike(post._id, "👍")}
                className={`flex flex-1 items-center gap-2 px-2 sm:px-4 py-2 rounded-md transition-colors justify-center hover:bg-black/5 dark:hover:bg-white/5 ${isLiked ? "text-blue-500 font-bold" : "text-inherit opacity-80"}`}
              >
                {isLiked && userReaction.type !== "👍" ? (
                  <span className="text-lg leading-none">
                    {userReaction.type}
                  </span>
                ) : (
                  <ThumbsUp
                    className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`}
                  />
                )}
                <span className="text-sm">
                  <span className="hidden sm:inline">Like </span>
                  {post.reactions?.length > 0 && `(${post.reactions.length})`}
                </span>
              </button>
              <button
                onClick={() => setShowComments(!showComments)}
                className="flex flex-1 items-center gap-2 px-2 sm:px-4 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-inherit opacity-80 transition-colors justify-center"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-sm">
                  <span className="hidden sm:inline">Comment </span>
                  {post.comments?.length > 0 && `(${post.comments.length})`}
                </span>
              </button>
              {onBookmark && (
                <button
                  onClick={() => onBookmark(post._id)}
                  className={`flex flex-1 items-center gap-2 px-2 sm:px-4 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-inherit opacity-80 transition-colors justify-center`}
                >
                  <Bookmark
                    className={`w-5 h-5 ${currentUser?.savedPosts?.includes(post._id) || currentUser?.savedLectures?.includes(post._id) ? "fill-current" : ""}`}
                  />
                  <span className="text-sm hidden sm:inline">Save</span>
                </button>
              )}
              {onShare && (
                <button
                  onClick={() => onShare(post)}
                  className="flex flex-1 items-center gap-2 px-2 sm:px-4 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-inherit opacity-80 transition-colors justify-center"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="text-sm">Share</span>
                </button>
              )}
            </div>
          </div>

          {/* Comments */}
          {showComments && (
            <div className="px-4 pb-4 border-t border-inherit/30 bg-black/5 dark:bg-white/5 rounded-b-xl">
              <div className="flex flex-col gap-3 mt-3">
                {post.comments?.map((comment, index) => {
                  const isCommentAuthor =
                    comment.user?._id === currentUser?._id ||
                    comment.user === currentUser?._id;
                  return (
                    <div
                      key={index}
                      className={`flex justify-between items-start gap-2 text-sm p-2.5 rounded-lg border border-inherit/30 shadow-sm group ${getCardThemeClasses(appTheme)}`}
                    >
                      {editingCommentId === comment._id ? (
                        <div className="flex-1 flex flex-col gap-2 w-full">
                          <input
                            type="text"
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-md border border-inherit/50 bg-black/5 dark:bg-white/5 text-inherit text-sm focus:outline-none focus:ring-2 focus:ring-current"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="px-3 py-1 text-xs text-inherit bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (editCommentText.trim()) {
                                  onEditComment(
                                    post._id,
                                    comment._id,
                                    editCommentText,
                                  );
                                  setEditingCommentId(null);
                                }
                              }}
                              className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <span className="font-bold text-inherit shrink-0">
                              {comment.user?.name || "User"}:
                            </span>
                            <span className="opacity-90 break-words line-clamp-4">
                              {comment.text}
                            </span>
                            {comment.isEdited && (
                              <span className="text-[10px] opacity-60 ml-1 self-center shrink-0">
                                (edited)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {(isCommentAuthor ||
                              currentUser?.role === "Admin") &&
                              onEditComment && (
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment._id);
                                    setEditCommentText(comment.text);
                                  }}
                                  className="text-blue-500 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                                  title="Edit Comment"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            {(isCommentAuthor ||
                              isOwnPost ||
                              currentUser?.role === "Admin") &&
                              onDeleteComment && (
                                <button
                                  onClick={() =>
                                    onDeleteComment(post._id, comment._id)
                                  }
                                  className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                                  title="Delete Comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onComment(post._id, commentInput);
                        setCommentInput("");
                      }
                    }}
                    placeholder="Write a comment..."
                    className="flex-1 px-4 py-2 rounded-full border border-inherit/50 bg-black/5 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-current text-inherit"
                  />
                  <button
                    onClick={() => {
                      onComment(post._id, commentInput);
                      setCommentInput("");
                    }}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PostCard;
