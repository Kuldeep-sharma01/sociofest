import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Smile,
  Send,
  Image as ImageIcon,
  Video,
  Paperclip,
  Mic,
  X,
  Download,
  Check,
  Type,
  Palette
} from "lucide-react";
import { COMMON_EMOJIS } from "@/utils/constants.js";
import UserInfo from "./UserInfo";
import { useTheme } from "@/context/ThemeContext";
import { useMicVolume } from "@/hooks/useMicVolume";
import { getCardThemeClasses, getPrimaryButtonClasses, getOptionClasses } from "@/utils/themeUtils";

const PostComposer = ({
  value,
  onChange,
  onSend,
  isSending = false,
  placeholder = "Type a message...",
  user = null,
  attachments = [],
  onAddFiles,
  onRemoveFile,
  setFullscreenMedia,
  isDownloadable,
  onIsDownloadableChange,
  allowVoice = true,
  allowAttachments = true,
  attachmentType = "all", // 'all' | 'image'
  hideInternalPreview = false,
  // NEW StudyHub Props
  contentType = "",
  contentTypeOptions = [
    { value: "", label: "General" },
    { value: "lecture", label: "📹 Lecture" },
    { value: "material", label: "📚 Material" },
    { value: "assignment", label: "📝 Assignment" }
  ],
  onContentTypeChange = () => {},
  subjectOptions = [],
  semesterOptions = [],
  selectedSubject = "",
  onSubjectChange = () => {},
  selectedSemester = "",
  onSemesterChange = () => {},
}) => {
  const { appTheme, isDark } = useTheme();

  const instanceId = useRef(Math.random().toString(36).substr(2, 9)).current;

  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState(localStorage.getItem("aiSpeechLang") || "en-US");
  const micVolume = useMicVolume(isListening);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const manualStopRef = useRef(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const finalTranscriptRef = useRef("");

  // Media Details Modal State
  const [pendingAttachments, setPendingAttachments] = useState([]);

  const recognitionRef = useRef(null);
  const pendingAttachmentsRef = useRef(pendingAttachments);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e){}
      }
      pendingAttachmentsRef.current.forEach(a => {
        if (a.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, []);

  const [showMediaModal, setShowMediaModal] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [globalTitle, setGlobalTitle] = useState("");
  const [globalDesc, setGlobalDesc] = useState("");
  const [globalIsDownloadable, setGlobalIsDownloadable] = useState(false);

  const clearPendingAttachments = () => {
    pendingAttachments.forEach(a => {
      if (a.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
    });
    setPendingAttachments([]);
    setShowMediaModal(false);
  };

  const insertEmoji = (emoji) => {
    if (composerRef.current) {
      const start = composerRef.current.selectionStart;
      const end = composerRef.current.selectionEnd;
      const newValue = value.substring(0, start) + emoji + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        composerRef.current.focus();
        composerRef.current.selectionStart = composerRef.current.selectionEnd =
          start + emoji.length;
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      manualStopRef.current = true;
      try { recognitionRef.current.stop(); } catch(e){}
      setIsListening(false);
      return;
    }
    
    manualStopRef.current = false;
    finalTranscriptRef.current = valueRef.current || "";

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (e) => {
        let interim = "";
        let newFinal = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            newFinal += transcript + " ";
          } else {
            interim += transcript;
          }
        }
        if (newFinal) finalTranscriptRef.current += newFinal;
        onChange(finalTranscriptRef.current + interim);
      };
      
      recognition.onerror = (e) => {
        console.error("Speech recognition error:", e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          manualStopRef.current = true;
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Microphone access denied. ❌" }));
          setIsListening(false);
        }
        // We intentionally ignore 'network' and 'no-speech' errors so the onend auto-restarter handles them gracefully!
      };
      
      recognition.onend = () => {
        if (!manualStopRef.current) {
          setTimeout(() => {
            try { 
              if (recognitionRef.current) recognitionRef.current.start(); 
            } catch(e) { setIsListening(false); }
          }, 250);
        } else {
          setIsListening(false);
        }
      };
      
      try {
        recognition.start();
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Listening... Speak now 🎤" }));
      } catch(e) {
        setIsListening(false);
      }
    } else {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Speech recognition not supported.",
        }),
      );
    }
  };

  const handleTextareaInput = (e) => {
    onChange(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight < 200 ? e.target.scrollHeight : 200}px`;
  };

  const handleSendWrapper = () => {
    if (value.trim()) {
      setHistory((prev) => [...prev, value]);
      setHistoryIndex(-1); // Reset index on new send
    }
    onSend();
  };

  const handleKeyDownWrapper = (e) => {
    // Let the browser handle standard text editing shortcuts (Ctrl+Z, Shift+Arrow, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendWrapper();
    } else if (e.key === "Enter" && e.shiftKey) {
      // Allow normal newline insertion
      return;
    } else if (e.key === "ArrowUp" && !e.shiftKey) {
      // Only trigger if textarea is empty or we are currently cycling history
      if (history.length > 0 && (value === "" || historyIndex !== -1)) {
        e.preventDefault();
        const nextIndex =
          historyIndex === -1
            ? history.length - 1
            : Math.max(historyIndex - 1, 0);
        setHistoryIndex(nextIndex);
        onChange(history[nextIndex]);
      }
    } else if (e.key === "ArrowDown" && !e.shiftKey) {
      if (historyIndex !== -1) {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          onChange(""); // Reached the bottom, clear input
        } else {
          setHistoryIndex(nextIndex);
          onChange(history[nextIndex]);
        }
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showEmojiPicker && !e.target.closest(".emoji-picker-container")) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    // Auto-resize height correctly when navigating through long history items
    if (composerRef.current) {
      composerRef.current.style.height = "auto";
      if (value) {
        composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 200)}px`;
      }
    }
  }, [value]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const newAtts = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "image" : "document",
      title: file.name.split('.')[0] || "Media",
      description: "",
      isDownloadable: false
    }));

    setPendingAttachments(newAtts);
    setGlobalTitle(newAtts[0].title);
    setGlobalDesc("");
    setApplyToAll(false);
    setShowMediaModal(true);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleConfirmMedia = () => {
    const finalAtts = pendingAttachments.map(att => ({
      ...att,
      title: applyToAll ? globalTitle : att.title,
      description: applyToAll ? globalDesc : att.description,
      isDownloadable: applyToAll ? globalIsDownloadable : (att.isDownloadable ?? false)
    }));
    onAddFiles(finalAtts);
    setShowMediaModal(false);
    setPendingAttachments([]);
  };

  return (
    <div
      className={`flex flex-col w-full ${user ? "bg-black/5 dark:bg-white/5 border border-transparent focus-within:border-current focus-within:bg-black/10 dark:focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-current rounded-[24px] p-1 transition-all shadow-sm" : "bg-black/5 dark:bg-white/5 p-2 border border-inherit rounded-b-2xl md:rounded-2xl shadow-sm"}`}
    >
      {subjectOptions && subjectOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-2 pb-1 border-b border-inherit/10 bg-transparent rounded-t-[24px]">
          <select
            value={contentType}
            onChange={(e) => onContentTypeChange && onContentTypeChange(e.target.value)}
            className="text-xs p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-inherit/30 outline-none text-inherit font-bold"
          >
            {contentTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className={getOptionClasses(appTheme, isDark)}>
                {opt.label}
              </option>
            ))}
          </select>
          {semesterOptions && semesterOptions.length > 0 && (
            <select
              value={selectedSemester}
              onChange={onSemesterChange}
              className="text-xs p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-inherit/30 outline-none text-inherit font-bold"
            >
              <option value="" className={getOptionClasses(appTheme, isDark)}>All Semesters</option>
              {semesterOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className={getOptionClasses(appTheme, isDark)}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedSubject}
            onChange={onSubjectChange}
            className="text-xs p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-inherit/30 outline-none text-inherit font-bold flex-1 sm:flex-none min-w-[120px]"
          >
            <option value="" className={getOptionClasses(appTheme, isDark)}>General (No Subject)</option>
            {subjectOptions.map((opt) => (
              <option key={opt._id} value={opt._id} className={getOptionClasses(appTheme, isDark)}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {!hideInternalPreview && attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-black/5 dark:bg-white/5 rounded-lg border border-inherit w-fit ml-2 mt-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group inline-flex flex-col">
              {att.type === "video" ? (
                <video
                  src={att.previewUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className={`h-16 w-auto border border-gray-200 dark:border-gray-700 cursor-pointer object-contain bg-black/5 hover:opacity-90 transition-opacity ${att.title ? 'rounded-t-lg' : 'rounded-lg'}`}
                  onClick={() =>
                    setFullscreenMedia &&
                    setFullscreenMedia({
                      url: att.previewUrl,
                      type: "video",
                      authorId: user?._id,
                      title: att.title,
                      isDownloadable: att.isDownloadable ?? true
                    })
                  }
                />
              ) : (
                <img
                  src={att.previewUrl}
                  className={`h-16 w-auto border border-gray-200 dark:border-gray-700 object-contain bg-black/5 cursor-pointer hover:opacity-90 transition-opacity ${att.title ? 'rounded-t-lg' : 'rounded-lg'}`}
                  referrerPolicy="no-referrer"
                  alt="preview"
                  onClick={() =>
                    setFullscreenMedia &&
                    setFullscreenMedia({
                      url: att.previewUrl,
                      type: "image",
                      authorId: user?._id,
                      title: att.title,
                      isDownloadable: att.isDownloadable ?? true
                    })
                  }
                />
              )}
              <button
                onClick={() => onRemoveFile(idx)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
              {att.title && (
                <div className="bg-black/10 dark:bg-white/10 border-x border-b border-gray-200 dark:border-gray-700 text-inherit text-[10px] px-1.5 py-0.5 truncate rounded-b-lg pointer-events-none text-center w-full max-w-[150px]">
                  {att.title}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 w-full">
        {user && (
          <Link
            to="/dashboard"
            className="shrink-0 p-0.5 hover:no-underline"
            title="Profile"
          >
            <UserInfo user={user} showText={false} />
          </Link>
        )}

        {!user && (
          <div className="flex gap-1 mb-1.5 ml-1">
            {allowVoice && (
              <div className="relative group/voice flex items-center">
                <button
                  type="button"
                  onClick={toggleVoiceInput} 
                  className={`relative p-2 rounded-full transition-colors ${isListening ? "text-red-500 bg-red-500/20" : "text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"}`}
                  title={isListening ? "Stop Listening" : "Dictate"}
                >
                  {isListening && (
                    <div 
                      className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-75 pointer-events-none"
                      style={{ transform: `scale(${1 + (micVolume / 50)})` }}
                    />
                  )}
                  <Mic className="w-5 h-5 relative z-10" />
                </button>
              <select value={speechLang} onChange={(e) => { setSpeechLang(e.target.value); localStorage.setItem("aiSpeechLang", e.target.value); }} onClick={e => e.stopPropagation()} className="absolute bottom-full mb-1 left-0 bg-black/90 dark:bg-white/90 text-white dark:text-black text-[10px] rounded p-1 opacity-0 group-hover/voice:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-current cursor-pointer border border-white/20 font-bold z-50">
                <option value="en-US" className={getOptionClasses(appTheme, isDark)}>English</option>
                <option value="es-ES" className={getOptionClasses(appTheme, isDark)}>Spanish</option>
                <option value="fr-FR" className={getOptionClasses(appTheme, isDark)}>French</option>
                <option value="hi-IN" className={getOptionClasses(appTheme, isDark)}>Hindi</option>
                <option value="de-DE" className={getOptionClasses(appTheme, isDark)}>German</option>
                <option value="ja-JP" className={getOptionClasses(appTheme, isDark)}>Japanese</option>
                <option value="ar-SA" className={getOptionClasses(appTheme, isDark)}>Arabic</option>
                </select>
              </div>
            )}
            {allowAttachments && (
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={
                    attachmentType === "image" ? "image/*" : "image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.xls,.xlsx"
                  }
                  onChange={handleFileSelect}
                  multiple
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
                  title="Attach Media"
                >
                  {attachmentType === "image" ? (
                    <ImageIcon className="w-5 h-5" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>
              </div>
            )}
            <div className="relative emoji-picker-container">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 bg-white dark:bg-gray-800 shadow-xl border border-inherit/30 rounded-xl p-2 grid grid-cols-6 gap-1 w-64 z-50 animate-in fade-in slide-in-from-bottom-2">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="text-xl p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <textarea
          ref={composerRef}
          value={value}
          onChange={handleTextareaInput}
          onKeyDown={handleKeyDownWrapper}
          placeholder={placeholder}
          rows={1}
          className={`flex-1 bg-transparent border-none focus:ring-0 max-h-[200px] min-h-[40px] py-2 resize-none text-sm scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full text-inherit placeholder-current opacity-90 ${!user ? "bg-black/5 dark:bg-white/5 border border-inherit rounded-2xl px-3" : ""}`}
          style={{ height: "auto" }}
        />

        {user && (
          <div className="flex items-center gap-1 shrink-0 mb-1 mr-1">
            <div className="flex items-center gap-0.5 relative">
              {allowVoice && (
                <div className="relative group/voice flex items-center">
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`relative rounded-full w-8 h-8 p-1 justify-center items-center flex transition-colors ${isListening ? "text-red-500 bg-red-500/20" : "text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"}`}
                    title={isListening ? "Stop Listening" : "Dictate"}
                  >
                    {isListening && (
                      <div 
                        className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-75 pointer-events-none"
                        style={{ transform: `scale(${1 + (micVolume / 50)})` }}
                      />
                    )}
                    <Mic className="w-5 h-5 relative z-10" />
                  </button>
                <select value={speechLang} onChange={(e) => { setSpeechLang(e.target.value); localStorage.setItem("aiSpeechLang", e.target.value); }} onClick={e => e.stopPropagation()} className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/90 dark:bg-white/90 text-white dark:text-black text-[10px] rounded p-1 opacity-0 group-hover/voice:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-current cursor-pointer border border-white/20 font-bold z-50">
                  <option value="en-US" className={getOptionClasses(appTheme, isDark)}>English</option>
                  <option value="es-ES" className={getOptionClasses(appTheme, isDark)}>Spanish</option>
                  <option value="fr-FR" className={getOptionClasses(appTheme, isDark)}>French</option>
                  <option value="hi-IN" className={getOptionClasses(appTheme, isDark)}>Hindi</option>
                  <option value="de-DE" className={getOptionClasses(appTheme, isDark)}>German</option>
                  <option value="ja-JP" className={getOptionClasses(appTheme, isDark)}>Japanese</option>
                  <option value="ar-SA" className={getOptionClasses(appTheme, isDark)}>Arabic</option>
                  </select>
                </div>
              )}
              <div className="relative emoji-picker-container">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-8 h-8 p-1 justify-center items-center flex transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 shadow-xl border border-inherit/30 rounded-xl p-2 grid grid-cols-6 gap-1 w-64 z-50 animate-in fade-in slide-in-from-bottom-2">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="hover:bg-black/10 dark:hover:bg-white/10 p-2 rounded text-xl transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {allowAttachments && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept={
                      attachmentType === "image" ? "image/*" : "image/*,video/*"
                    }
                    className="hidden"
                  onChange={handleFileSelect}
                    multiple
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-inherit opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-8 h-8 p-1 justify-center items-center flex transition-colors"
                    title="Upload Media"
                  >
                    {attachmentType === "image" ? (
                      <ImageIcon className="w-5 h-5" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </button>
                </>
              )}
              {allowAttachments && attachments.length > 0 && onIsDownloadableChange && (
                <div className="relative" title="Allow public downloads">
                  <input
                    type="checkbox"
                    id={`isDownloadable-${instanceId}`}
                    checked={isDownloadable}
                    onChange={onIsDownloadableChange}
                    className="hidden"
                  />
                  <label
                    htmlFor={`isDownloadable-${instanceId}`}
                    className={`cursor-pointer text-inherit hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-8 h-8 p-1 justify-center items-center flex transition-colors ${isDownloadable ? "opacity-100" : "opacity-40"}`}
                  >
                    <Download className="w-5 h-5" />
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={handleSendWrapper}
              disabled={
                (!value.trim() && attachments.length === 0) || isSending
              }
              className={`rounded-full text-current bg-black/10 dark:bg-white/10 ${isSending ? "opacity-50" : "hover:bg-black/20 dark:hover:bg-white/20 hover:scale-105"} p-2 transition-all duration-300 transform disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSending ? (
                <div
                  className="loader"
                  style={{ "--s": "12px", "--g": "2px" }}
                ></div>
              ) : (
                <Send className="w-5 h-5 mt-0.5 mr-0.5" />
              )}
            </button>
          </div>
        )}

        {!user && (
          <button
            onClick={handleSendWrapper}
            disabled={(!value.trim() && attachments.length === 0) || isSending}
            className={`mb-1 p-2.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:scale-105 shrink-0 ${getPrimaryButtonClasses(appTheme)}`}
          >
            {isSending ? (
              <div
                className="loader"
                style={{ "--s": "12px", "--g": "2px" }}
              ></div>
            ) : (
              <Send className="w-5 h-5 ml-0.5" />
            )}
          </button>
        )}
      </div>

      {/* Media Details Configuration Modal */}
      {showMediaModal && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200`}>
            <div className="p-4 border-b border-inherit/30 flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
              <h3 className="font-bold text-lg text-inherit">Attachment Details</h3>
              <button onClick={clearPendingAttachments} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 opacity-70 hover:opacity-100 text-inherit" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {pendingAttachments.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="applyToAll" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                  <label htmlFor="applyToAll" className="text-sm font-bold text-inherit cursor-pointer">Apply same details to all ({pendingAttachments.length}) files</label>
                </div>
              )}
              
              {applyToAll ? (
                <div className="flex flex-col gap-3 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/30">
                  <input type="text" placeholder="Title for all files" value={globalTitle} onChange={e => setGlobalTitle(e.target.value)} className="w-full p-2 rounded-lg bg-transparent border border-inherit/50 focus:ring-2 focus:ring-current outline-none text-sm text-inherit" />
                  <textarea placeholder="Description for all files..." value={globalDesc} onChange={e => setGlobalDesc(e.target.value)} className="w-full p-2 rounded-lg bg-transparent border border-inherit/50 focus:ring-2 focus:ring-current outline-none text-sm text-inherit resize-none" rows="2" />
                  {onIsDownloadableChange && (
                    <label className="flex items-center gap-2 text-sm font-medium text-inherit cursor-pointer mt-2">
                      <input type="checkbox" checked={globalIsDownloadable} onChange={e => setGlobalIsDownloadable(e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
                      Allow users to download these files
                    </label>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pendingAttachments.map((att, i) => (
                    <div key={i} className="flex gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-inherit/30">
                      <div className="w-20 h-20 shrink-0 bg-black/10 rounded-lg overflow-hidden flex items-center justify-center">
                         {att.type === 'video' ? <Video className="w-8 h-8 opacity-50 text-inherit"/> : att.type === 'image' ? <img src={att.previewUrl} className="w-full h-full object-cover" alt="preview" /> : <Paperclip className="w-8 h-8 opacity-50 text-inherit"/>}
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <input type="text" placeholder="Title" value={att.title} onChange={e => setPendingAttachments(prev => { const n = [...prev]; n[i].title = e.target.value; return n; })} className="w-full p-2 rounded-md bg-transparent border border-inherit/50 focus:ring-2 focus:ring-current outline-none text-sm text-inherit" />
                        <textarea placeholder="Description..." value={att.description} onChange={e => setPendingAttachments(prev => { const n = [...prev]; n[i].description = e.target.value; return n; })} className="w-full p-2 rounded-md bg-transparent border border-inherit/50 focus:ring-2 focus:ring-current outline-none text-xs text-inherit resize-none" rows="1" />
                        {onIsDownloadableChange && (
                          <label className="flex items-center gap-2 text-xs font-medium text-inherit cursor-pointer mt-1">
                            <input type="checkbox" checked={att.isDownloadable} onChange={e => setPendingAttachments(prev => { const n = [...prev]; n[i].isDownloadable = e.target.checked; return n; })} className="w-3 h-3 accent-blue-500 cursor-pointer" />
                            Allow download
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-inherit/30 flex justify-end gap-3 bg-black/5 dark:bg-white/5 shrink-0">
               <button onClick={clearPendingAttachments} className="px-4 py-2 font-bold text-sm opacity-80 hover:opacity-100 transition-opacity text-inherit">Cancel</button>
               <button onClick={handleConfirmMedia} className={`px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition-transform active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}>Confirm Upload</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default PostComposer;
