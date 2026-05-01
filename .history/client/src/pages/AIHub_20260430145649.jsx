
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Bot,
  Send,
  Settings,
  Key,
  Sparkles,
  Volume2,
  VolumeX,
  CalendarPlus,
  Trash2,
  Copy,
  Edit2,
  Mic,
  Image as ImageIcon,
  Video,
  X as CloseIcon,
  AlertCircle,
  MoreVertical,
  Menu,
  Plus,
  MessageSquare,
  RefreshCw,
  Zap,
  Share2,
  ArrowDown,
  Download,
  Search,
} from "lucide-react";
import {
  generateContent,
  getAiConfig,
  getAiKey,
  setAiConfig,
  fetchAvailableModels,
  generateMediaContent,
  getRuntimeConfig,
  previewSourceEdit,
  speakText,
  stopSpeaking,
  updateRuntimeConfig,
} from "@/services/aiClient";
import {
  getUserById,
  getDepartmentHODKeys,
  updateUserProfile,
} from "@/services/userService";
import { createEvent } from "@/services/eventService";
import ReactMarkdown from "react-markdown";
import { HIGHLIGHT_STYLES, HighlightedText } from "@/utils/textUtils";
import { updateUser } from "@/redux/authSlice";
import { useTheme } from "@/context/ThemeContext";
import { useSocket } from "@/context/SocketContext";
import PostComposer from "@/components/ui/PostComposer";
import UniversalSidebar from "@/components/ui/UniversalSidebar";
import UserInfo from "@/components/ui/UserInfo";
import AIHighlightCustomizer from "@/components/ui/AIHighlightCustomizer";
import LinkPreviewCard from "@/components/ui/LinkPreviewCard";
import DocumentViewer from "@/components/ui/DocumentViewer";
import { useSearchParams } from "react-router-dom";
import ShareModal from "@/components/ui/ShareModal";
import { getConversations, sendMessage } from "@/services/chatService";
import { getServiceStatus } from "@/services/aiService";
import { useMicVolume } from "@/hooks/useMicVolume";
import {
  getWrapperThemeClasses,
  getOptionClasses,
  getHeaderThemeClasses,
  getRowClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";

// Flexible Provider Configuration Map
const AI_PROVIDERS = {
  auto: {
    name: "Auto (Server Fallback Chain)",
    keyField: "autoKey",
    placeholder: "Managed on server",
  },
  gemini: {
    name: "Google Gemini",
    keyField: "geminiKey",
    placeholder: "AIzaSy...",
  },
  openai: {
    name: "OpenAI (ChatGPT)",
    keyField: "openAiKey",
    placeholder: "sk-proj-...",
  },
  claude: {
    name: "Anthropic Claude",
    keyField: "claudeKey",
    placeholder: "sk-ant-...",
  },
  bolt: {
    name: "Bolt.new",
    keyField: "boltKey",
    placeholder: "sk-bolt-...",
  },
  v0dev: {
    name: "v0.dev",
    keyField: "v0devKey",
    placeholder: "sk-v0-...",
  },
  emergent: {
    name: "Emergent AI",
    keyField: "emergentKey",
    placeholder: "sk-emergent-...",
  },
  perplexity: {
    name: "Perplexity AI",
    keyField: "perplexityKey",
    placeholder: "pplx-...",
  },
  deepseek: {
    name: "DeepSeek",
    keyField: "deepseekKey",
    placeholder: "sk-...",
  },
  openrouter: {
    name: "OpenRouter",
    keyField: "openRouterKey",
    placeholder: "sk-or-v1-...",
  },
  huggingface: {
    name: "HuggingFace",
    keyField: "huggingfaceKey",
    placeholder: "hf_...",
  },
  stability: {
    name: "Stability AI",
    keyField: "stabilityKey",
    placeholder: "sk-... (For Images)",
  },
  ollama: {
    name: "Ollama (Local)",
    keyField: "ollamaHost",
    placeholder: "http://localhost:11434 (Host URL)",
  },
};
const AIHub = () => {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const { isDark, toggleTheme, appTheme } = useTheme();
  const socket = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultWelcome = {
    id: "welcome-msg",
    role: "ai",
    text: "Hello! I am your SocioFest AI Assistant. How can I help you study or plan your academic activities today?",
  };

const [sessions, setSessions] = useState(() => {
    const hist = user?.aiChatHistory || [];
    if (hist.length === 0) return [];

    // Upgrade legacy flat history arrays to the new Session Object format
    if (hist[0] && hist[0].role) {
      return [
        { id: Date.now().toString(), title: "Legacy Chat", messages: hist.slice(-50), memorySummary: "Legacy conversation history", memoryTokens: 0 },
      ];
    }
    return hist.map(s => ({ ...s, memorySummary: "Full session", memoryTokens: s.messages?.length || 0 }));
  });

  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMessages, setQuickMessages] = useState([]);
  const [quickChatPos, setQuickChatPos] = useState({ x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - 450) : 20, y: typeof window !== "undefined" && window.innerHeight > 600 ? 100 : 20 });
  const [quickChatSize, setQuickChatSize] = useState({ w: typeof window !== "undefined" ? Math.min(400, window.innerWidth - 40) : 380, h: 500 });
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

// Simple debounce utility
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  // Global search across ALL sessions
  const performSearch = useCallback(
    debounce((query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      const allText = sessions.flatMap(s => 
        s.messages.map(m => ({sessionId: s.id, message: m.text, id: m.id}))
      );
      const results = allText
        .map(item => {
          const index = item.message.toLowerCase().indexOf(query.toLowerCase());
          if (index === -1) return null;
          const before = item.message.slice(Math.max(0, index-50), index);
          const match = item.message.slice(index, index + query.length + 50);
          return {
            ...item,
            snippet: `${before ? '...' : ''}${match.toLowerCase() === query.toLowerCase() ? match : match.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`)}...`,
            score: query.length / item.message.length
          };
        })
        .filter(Boolean)
        .sort((a,b) => b.score - a.score)
        .slice(0, 20);
      setSearchResults(results);
    }, 200),
    [sessions]
  );

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) setIsSidebarOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && quickChatOpen) {
        setQuickChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [quickChatOpen]);

  // Landscape detection and scroll hiding
  useEffect(() => {
    const handleResize = () => {
      const landscape = window.innerWidth >= 1024;
      setIsLandscape(landscape);
      if (!landscape) {
        setIsHeaderHidden(false);
        setIsSidebarHidden(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const jumpToMessage = (sessionId, msgId) => {
    setCurrentSessionId(sessionId);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    setSearchQuery("");
    setTimeout(() => {
      const el = document.getElementById(msgId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-yellow-500/20', 'animate-pulse');
        setTimeout(() => el.classList.remove('bg-yellow-500/20', 'animate-pulse'), 2000);
      }
    }, 300);
  };

  const [currentSessionId, setCurrentSessionId] = useState(
    sessions.length > 0 ? sessions[0].id : null,
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  // Stable reference for empty default messages
  const defaultMessagesRef = useRef([defaultWelcome]);
  const activeSession = sessions.find((s) => s.id === currentSessionId);
  const messages = activeSession
    ? activeSession.messages
    : defaultMessagesRef.current;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(getAiConfig().provider);
  const [keys, setKeys] = useState(getAiConfig());
  const activeKey = getAiKey();
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [runtimeConfig, setRuntimeConfig] = useState({ routes: { chat: [] } });
  const [runtimeConfigBusy, setRuntimeConfigBusy] = useState(false);
  const [sourceEditForm, setSourceEditForm] = useState({
    filePath: "",
    instruction: "",
    currentCode: "",
  });
  const [sourceEditPreview, setSourceEditPreview] = useState("");
  const [sourceEditBusy, setSourceEditBusy] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("checking");
  const [generationMode, setGenerationMode] = useState("chat");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [imageModel, setImageModel] = useState(localStorage.getItem("aiImageModel") || "pollinations");
  const [highlightStyle, setHighlightStyle] = useState(
    localStorage.getItem("aiHighlightStyle") || "yellow",
  );
  const [highlightSpeed, setHighlightSpeed] = useState(
    localStorage.getItem("aiHighlightSpeed") || "duration-300",
  );
  const [autoSpeak, setAutoSpeak] = useState(
    localStorage.getItem("aiAutoSpeak") === "true",
  );
  const autoSpeakRef = useRef(autoSpeak);
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
    localStorage.setItem("aiAutoSpeak", autoSpeak);
  }, [autoSpeak]);
  const [textSize, setTextSize] = useState(
    localStorage.getItem("aiTextSize") || "text-base",
  );
  const [showSettings, setShowSettings] = useState(
    searchParams.get("settings") === "true",
  );
  const [attachments, setAttachments] = useState([]);
  const [speechRate, setSpeechRate] = useState(
    parseFloat(localStorage.getItem("aiSpeechRate")) || 1,
  );
  const [speakingState, setSpeakingState] = useState({
    id: null,
    text: "",
    offset: 0,
    charIndex: 0,
    charLength: 0,
  });
  const isCancellingRef = useRef(false);
  const [voiceURI, setVoiceURI] = useState(
    localStorage.getItem("aiSpeechVoice") || "",
  );
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [voices, setVoices] = useState([]);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const abortControllerRef = useRef(null);
const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth >= 1024);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const prevScrollYRef = useRef(0);
  const rafRef = useRef(null);

  // Gemini Live Voice Mode States
  const [voiceState, setVoiceState] = useState("idle"); // 'idle', 'listening', 'thinking', 'speaking'
  const voiceStateRef = useRef(voiceState);
  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);
  const liveVoiceRecRef = useRef(null);
  const voiceSilenceTimeout = useRef(null);
  const triggerLiveVoiceRef = useRef(null);
  const generationModeRef = useRef(generationMode);
  const liveVoiceManualStopRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const [liveSpeechLang, setLiveSpeechLang] = useState(
    localStorage.getItem("aiSpeechLang") || "en-US",
  );
  useEffect(() => {
    generationModeRef.current = generationMode;
  }, [generationMode]);
  const micVolume = useMicVolume(voiceState === "listening");

  // Share Modal State
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [messageToShare, setMessageToShare] = useState(null);
  const [shareUsers, setShareUsers] = useState([]);

  useEffect(() => {
    if (searchParams.get("settings") === "true") {
      setShowSettings(true);
      searchParams.delete("settings");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch available models whenever provider or API key changes
  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      const key = keys[AI_PROVIDERS[provider]?.keyField];
      const models = await fetchAvailableModels(provider, key);
      if (isMounted) {
        setAvailableModels(models);
        const savedModel = localStorage.getItem(`${provider}Model`);
        if (savedModel && models.some((m) => m.id === savedModel)) {
          setSelectedModel(savedModel);
        } else if (models.length > 0) {
          setSelectedModel(models[0].id);
          localStorage.setItem(`${provider}Model`, models[0].id);
        }
      }
    };
    loadModels();
    return () => {
      isMounted = false;
    };
  }, [provider, keys[AI_PROVIDERS[provider]?.keyField]]);

  useEffect(() => {
    let active = true;
    const loadRuntimeConfig = async () => {
      try {
        const data = await getRuntimeConfig();
        if (active && data?.routes) {
          setRuntimeConfig(data);
        }
      } catch (err) {
        console.error("Failed to load AI runtime config", err);
      }
    };
    loadRuntimeConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const data = await getServiceStatus();
        if (!active) return;
        setServiceStatus(data?.status === "online" ? "online" : "offline");
      } catch (err) {
        if (active) setServiceStatus("offline");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const fetchDepartmentKey = async () => {
      const deptIdentifier = user?.department?.name || user?.department;
      if (deptIdentifier) {
        try {
          const data = await getDepartmentHODKeys(deptIdentifier);
          if (data.departmentApiKey) {
            if (!getAiKey()) {
              try {
                // Attempt to parse as new multi-provider JSON format
                const parsed = JSON.parse(data.departmentApiKey);
                if (parsed.provider) {
                  setAiConfig(parsed.provider, parsed);
                  setProvider(parsed.provider);
                  setKeys((prev) => ({ ...prev, ...parsed }));
                }
              } catch (e) {
                // Fallback for legacy single Gemini key
                setAiConfig("gemini", { geminiKey: data.departmentApiKey });
                setProvider("gemini");
                setKeys((prev) => ({
                  ...prev,
                  geminiKey: data.departmentApiKey,
                }));
              }
            }
          }
        } catch (err) {
          console.error("Failed to fetch department API key", err);
        }
      }
    };
    fetchDepartmentKey();
  }, [user]);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Webhook Socket Listener for Videos
  useEffect(() => {
    if (!socket) return;
    const handleVideoGenerated = (data) => {
      const { sessionId, mediaUrl } = data;
      setSessions((prev) => {
        return prev.map((s) => {
          if (s.id === sessionId) {
            const aiMsg = {
              id: Date.now().toString() + "-video",
              role: "ai",
              text: "**Video Generation Complete!**\n\nHere is your generated video.",
              provider: "stability",
              generatedMediaUrl: mediaUrl,
              generatedMediaType: "video",
            };
            return { ...s, messages: [...s.messages, aiMsg] };
          }
          return s;
        });
      });
    };
    socket.on("video generated", handleVideoGenerated);
    return () => socket.off("video generated", handleVideoGenerated);
  }, [socket]);

  const prevMsgCount = useRef(messages.length);
  useEffect(() => {
    const isNewMessage = messages.length > prevMsgCount.current;
    if (isNewMessage || loading) {
      const lastMsg = messages[messages.length - 1];
      const forceScroll = lastMsg?.role === "user"; // Auto-scroll immediately when user sends
      
      if (!showScrollButton || forceScroll) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages, loading, showScrollButton]);

  // Continuous Conversational Voice Engine
  const startLiveListening = () => {
    if (voiceStateRef.current === "listening") return; // Prevent overlapping instances
    liveVoiceManualStopRef.current = false;
    setVoiceState("listening");
    setInput("");
    accumulatedTranscriptRef.current = "";
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Speech recognition not supported.",
        }),
      );
      setVoiceState("idle");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = liveSpeechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    liveVoiceRecRef.current = recognition;

    recognition.onstart = () => {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Live Voice Active 🎙️" }),
      );
    };

    recognition.onresult = (e) => {
      let interim = "";
      let finalAdd = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalAdd += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (finalAdd) accumulatedTranscriptRef.current += finalAdd;

      const fullText = accumulatedTranscriptRef.current + interim;
      setInput(fullText);

      clearTimeout(voiceSilenceTimeout.current);
      if (fullText.trim()) {
        voiceSilenceTimeout.current = setTimeout(() => {
          liveVoiceManualStopRef.current = true; // Stop auto-restart since we are sending
          try {
            recognition.stop();
          } catch (err) {}
          if (handleSendRef.current)
            handleSendRef.current(fullText.trim(), true);
        }, 3000); // 3 second pause triggers auto-send
      }
    };
    recognition.onerror = (e) => {
      console.warn("Live Voice Error:", e.error);
      if (["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(e.error)) {
        liveVoiceManualStopRef.current = true;
        voiceStateRef.current = "idle";
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Microphone access denied or unavailable. ❌",
          }),
        );
        setVoiceState("idle");
      }
    };
    recognition.onend = () => {
      if (
        !liveVoiceManualStopRef.current &&
        voiceStateRef.current === "listening"
      ) {
        // 250ms debounce prevents the browser from permanently silencing the mic due to rapid restart spam
        setTimeout(() => {
          try {
            if (liveVoiceRecRef.current) liveVoiceRecRef.current.start();
          } catch (e) {
            setVoiceState("idle");
          }
        }, 250);
      } else if (voiceStateRef.current === "listening") {
        setVoiceState("idle");
      }
    };
    try {
      recognition.start();
    } catch (e) {}
  };
  triggerLiveVoiceRef.current = startLiveListening;

  const stopLiveVoice = () => {
    liveVoiceManualStopRef.current = true;
    clearTimeout(voiceSilenceTimeout.current);
    if (liveVoiceRecRef.current)
      try {
        liveVoiceRecRef.current.stop();
      } catch (e) {}
    stopSpeaking();
    setVoiceState("idle");
  };

  useEffect(() => {
    if (generationMode !== "voice") stopLiveVoice();
  }, [generationMode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentSessionId]);

  const handleChatScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!chatContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const scrollY = scrollTop;
      const prevScrollY = prevScrollYRef.current;
      
      // Existing scroll-to-bottom button
      const isNearBottom = scrollHeight - scrollTop - clientHeight <= 150;
      setShowScrollButton(!isNearBottom);
      
      // Landscape header/sidebar hiding
      if (window.innerWidth >= 1024) {
        const scrollingDown = scrollY > prevScrollY + 5; // Small threshold to avoid jitter
        const atTop = scrollY < 50;
        const shouldHide = scrollingDown && !atTop;
        
        setIsHeaderHidden(shouldHide);
        setIsSidebarHidden(shouldHide);
        
        // Buttons retain visibility for 2s after scroll start (user request)
        if (shouldHide && prevScrollYRef.current === 0) {
          setTimeout(() => {
            if (window.innerWidth >= 1024) {
              setIsHeaderHidden(true);
              setIsSidebarHidden(true);
            }
          }, 2000);
        }
      }
      
      prevScrollYRef.current = scrollY;
    });
  }, []);

  const handleSaveKey = async () => {
    setAiConfig(provider, keys);
    setShowSettings(false);
    window.dispatchEvent(
      new CustomEvent("showToast", {
        detail: "AI Provider settings saved! 🔐",
      }),
    );

    try {
      localStorage.setItem("aiProvider", provider);
      const payload = { 
        geminiApiKey: keys.geminiKey,
        openAiApiKey: keys.openAiKey,
        claudeApiKey: keys.claudeKey,
        stabilityApiKey: keys.stabilityKey,
        deepseekApiKey: keys.deepseekKey,
        perplexityApiKey: keys.perplexityKey,
        boltApiKey: keys.boltKey,
        v0devApiKey: keys.v0devKey,
        emergentApiKey: keys.emergentKey,
        huggingfaceApiKey: keys.huggingfaceKey,
        openRouterApiKey: keys.openRouterKey
      };
      await updateUserProfile(user._id, payload);
      dispatch(updateUser({ ...user, ...payload }));
    } catch (err) {
      console.error("Failed to backup key to DB", err);
    }
  };

  const handleRuntimeNodeChange = (index, field, value) => {
    setRuntimeConfig((prev) => {
      const next = {
        ...prev,
        routes: { ...(prev.routes || {}), chat: [...(prev.routes?.chat || [])] },
      };
      next.routes.chat[index] = { ...next.routes.chat[index], [field]: value };
      return next;
    });
  };

  const handleSaveRuntimeConfig = async () => {
    try {
      setRuntimeConfigBusy(true);
      const payload = {
        chat: (runtimeConfig?.routes?.chat || []).map((node) => ({
          provider: node.provider,
          model: node.model,
          enabled: node.enabled !== false,
          timeoutMs: Number(node.timeoutMs || 20000),
        })),
      };
      const updated = await updateRuntimeConfig(payload);
      setRuntimeConfig(updated);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "AI fallback routing saved.",
        }),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to save AI routing config.",
        }),
      );
    } finally {
      setRuntimeConfigBusy(false);
    }
  };

  const handleSourceEditPreview = async () => {
    try {
      setSourceEditBusy(true);
      const data = await previewSourceEdit(sourceEditForm);
      setSourceEditPreview(data?.preview || "");
    } catch (err) {
      setSourceEditPreview("Failed to generate source edit preview.");
    } finally {
      setSourceEditBusy(false);
    }
  };

  const saveHistoryToDB = async (localSessions) => {
    try {
      // Concurrent Tab Fix: Fetch the latest DB state before overwriting!
      const freshUser = await getUserById(user._id);
      const dbSessions = freshUser.aiChatHistory || [];

      const merged = [...dbSessions];
      for (const localSession of localSessions) {
        const idx = merged.findIndex((s) => s.id === localSession.id);
        if (idx > -1) {
          if (localSession.messages.length >= merged[idx].messages.length) {
            merged[idx] = localSession;
          }
        } else {
          merged.unshift(localSession);
        }
      }

      // ✅ STRIP BASE64 DATA BEFORE SAVING TO DB TO PREVENT 16MB BSON LIMIT / NETWORK ERRORS
      const dbPayload = merged.map(session => ({
        ...session,
        messages: session.messages.map(msg => {
          const safeMsg = { ...msg };
          if (safeMsg.mediaUrls) {
            safeMsg.mediaUrls = safeMsg.mediaUrls.map(url => 
              (url && (url.length > 2000 || url.startsWith("blob:"))) ? 'https://placehold.co/600x400/1a1a1a/ffffff?text=Image+Expired' : url
            );
          }
          if (safeMsg.generatedMediaUrl && (safeMsg.generatedMediaUrl.length > 2000 || safeMsg.generatedMediaUrl.startsWith("blob:"))) {
             safeMsg.generatedMediaUrl = 'https://placehold.co/1024x1024/1a1a1a/ffffff?text=Generated+Image+Expired';
          }
          return safeMsg;
        })
      }));

      await updateUserProfile(user._id, { aiChatHistory: dbPayload });
      dispatch(updateUser({ ...user, aiChatHistory: dbPayload }));
      // Do NOT call setSessions(dbPayload) here so the active tab keeps the real images!
    } catch (err) {
      console.error("Failed to save AI chat history:", err);
    }
  };

  const handleAddFiles = (newAttachments) => {
    let incoming = newAttachments;
    if (newAttachments.target) {
      incoming = Array.from(newAttachments.target.files).map((f) => ({
        file: f,
        title: f.name,
        description: "",
      }));
      newAttachments.target.value = null;
    }
    incoming.forEach((att) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments((prev) => [
          ...prev,
          {
            file: att.file,
            data: reader.result,
            mimeType: att.file.type,
            preview: URL.createObjectURL(att.file),
            previewUrl: URL.createObjectURL(att.file),
            type: att.file.type.startsWith("video") ? "video" : att.file.type.startsWith("audio") ? "audio" : "image",
            title: att.title,
            description: att.description,
          },
        ]);
      };
      reader.readAsDataURL(att.file);
    });
  };

  const handleRemoveFile = (idx) => {
    setAttachments((prev) => {
      const removed = prev[idx];
      if (removed?.previewUrl?.startsWith("blob:"))
        URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSend = async (overrideText = null, isLiveVoice = false) => {
    const userText = typeof overrideText === "string" ? overrideText : input;
    if (!userText.trim() && attachments.length === 0) {
      if (isLiveVoice) setVoiceState("idle");
      return;
    }
    
    let hasRequiredKey = !!getAiKey();
    if (generationMode === "image") {
      if (imageModel === "pollinations" || imageModel === "stablediffusion") hasRequiredKey = true;
      else if (imageModel === "openai") hasRequiredKey = !!keys.openAiKey;
      else if (imageModel === "stability") hasRequiredKey = !!keys.stabilityKey;
    } else if (generationMode === "video") {
      hasRequiredKey = !!keys.stabilityKey;
    }

    if (!hasRequiredKey) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "API Key is missing for the selected model. ❌" }),
      );
      if (isLiveVoice) setVoiceState("idle");
      return;
    }

    if (generationMode === "video") {
      if (attachments.length === 0) {
        window.dispatchEvent(
          new CustomEvent("showToast", { detail: "Please attach an initial image to animate into a video! 🎥" }),
        );
        if (isLiveVoice) setVoiceState("idle");
        return;
      }
      if (!attachments[0].data) {
        window.dispatchEvent(
          new CustomEvent("showToast", { detail: "Please upload an actual image file from your device, not just a link, to animate! 🎥" }),
        );
        if (isLiveVoice) setVoiceState("idle");
        return;
      }
    }

    const userMsg = {
      id: Date.now().toString() + "-user",
      role: "user",
      text: userText,
      hasMedia: attachments.length > 0,
      mediaUrls: attachments.map((a) => a.data || a.previewUrl),
      mediaTypes: attachments.map((a) => a.type),
      mediaTitles: attachments.map((a) => a.title),
      mediaDescriptions: attachments.map((a) => a.description),
    };

    const currentMessages = activeSession
      ? activeSession.messages.filter((m) => !m.isError)
      : defaultMessagesRef.current;
    const newMessages = [...currentMessages, userMsg];

    let updatedSessions = [...sessions];
    let activeId = currentSessionId;

    if (!activeId) {
      activeId = Date.now().toString();
      const newSession = {
        id: activeId,
        title: userText.substring(0, 30) + (userText.length > 30 ? "..." : ""),
        messages: newMessages,
      };
      updatedSessions = [newSession, ...sessions];
      setCurrentSessionId(activeId);
    } else {
      updatedSessions = updatedSessions.map((s) =>
        s.id === activeId ? { ...s, messages: newMessages } : s,
      );
    }

    setSessions(updatedSessions);
    setInput("");
    setLoading(true);
    if (isLiveVoice) setVoiceState("thinking");

    const mediaToSend = [...attachments];

    setAttachments([]);

    saveHistoryToDB(updatedSessions);

    const timeoutMs = generationMode === "video" ? 240000 : 90000; // 4 mins for video, 90s for chat/images
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    }, timeoutMs);

    try {
      if (generationMode === "image" || generationMode === "video") {
        const genType = generationMode;
        let prompt = userText.trim() || `Generate ${genType} from attached media`;
        
        // Append explicit formatting tags so the backend parses them correctly for precise control
        if (genType === "image") {
           prompt += ` --ar ${aspectRatio} --enhance ${autoEnhance}`;
        }
        
        let mediaProvider = provider;
        if (genType === "video") {
          mediaProvider = "stability";
        } else if (genType === "image") {
          mediaProvider = imageModel;
        }

        const mediaPromise = generateMediaContent(
          prompt,
          genType,
          mediaProvider,
          mediaToSend.length > 0 ? mediaToSend[0] : null,
          user._id,
          activeId,
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new Error(`AI generation timed out after ${timeoutMs / 1000} seconds.`)),
            timeoutMs,
          ),
        );

        const media = await Promise.race([mediaPromise, timeoutPromise]);

        const aiMsg = {
          id: Date.now().toString() + "-ai-media",
          role: "ai",
          text: `**Generated Media for:** "${prompt}"\n\n*(Note: These high-quality files are temporary and will expire on reload to save database space. Right-click to save!)*`,
          provider,
          generatedMediaUrl: media.url,
          generatedMediaType: media.type,
        };

        const finalMessages = [...newMessages, aiMsg];
        const finalSessions = updatedSessions.map((s) =>
          s.id === activeId ? { ...s, messages: finalMessages } : s,
        );
        setSessions(finalSessions);
        saveHistoryToDB(finalSessions);
      } else {
        const response = await generateContent(
          newMessages,
          undefined,
          mediaToSend,
          abortControllerRef.current.signal,
        );
        const aiMsgId = Date.now().toString() + "-ai";
        const aiMsg = { id: aiMsgId, role: "ai", text: response, provider };
        const finalMessages = [...newMessages, aiMsg];

        const finalSessions = updatedSessions.map((s) =>
          s.id === activeId ? { ...s, messages: finalMessages } : s,
        );
        setSessions(finalSessions);
        saveHistoryToDB(finalSessions);

        if (isLiveVoice) {
          setVoiceState("speaking");
          toggleVoice(response, aiMsgId, true);
        } else if (autoSpeakRef.current) {
          toggleVoice(response, aiMsgId);
        }
      }
    } catch (err) {
      if (isLiveVoice) setVoiceState("idle");
      if (
        err.name !== "AbortError" &&
        err.message !== "AI generation was interrupted."
      ) {
        const errorMsg = {
          id: Date.now().toString() + "-ai-err",
          role: "ai",
          text: `**Error:** ${err.message || "Request timed out"}`,
          isError: true,
        };
        const finalMessages = [...newMessages, errorMsg];

        const finalSessions = updatedSessions.map((s) =>
          s.id === activeId ? { ...s, messages: finalMessages } : s,
        );
        setSessions(finalSessions);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleRegenerate = async () => {
    const currentMessages = activeSession
      ? activeSession.messages
      : defaultMessagesRef.current;
    if (currentMessages.length < 2) return;

    // Remove the last AI message to revert history back to the user's previous prompt
    const newMessages = [...currentMessages];
    if (newMessages[newMessages.length - 1].role === "ai") {
      newMessages.pop();
    }

    let updatedSessions = [...sessions];
    updatedSessions = updatedSessions.map((s) =>
      s.id === currentSessionId ? { ...s, messages: newMessages } : s,
    );

    setSessions(updatedSessions);
    setLoading(true);
    saveHistoryToDB(updatedSessions);

    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    }, 60000);

    try {
      // Resend the truncated history
      const response = await generateContent(
        newMessages,
        undefined,
        [],
        abortControllerRef.current.signal,
      );
      const aiMsgId = Date.now().toString() + "-ai";
      const aiMsg = { id: aiMsgId, role: "ai", text: response, provider };
      const finalMessages = [...newMessages, aiMsg];

      const finalSessions = updatedSessions.map((s) =>
        s.id === currentSessionId ? { ...s, messages: finalMessages } : s,
      );
      setSessions(finalSessions);
      saveHistoryToDB(finalSessions);

      if (autoSpeakRef.current) {
        toggleVoice(response, aiMsgId);
      }
    } catch (err) {
      if (
        err.name !== "AbortError" &&
        err.message !== "AI generation was interrupted."
      ) {
        console.error("Regeneration failed", err);
      }
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    window.dispatchEvent(
      new CustomEvent("showToast", { detail: "Copied to clipboard! 📋" }),
    );
  };

  const handleShareClick = async (msg) => {
    setMessageToShare(msg);
    setShareModalOpen(true);
    try {
      const users = await getConversations();
      setShareUsers(users);
    } catch (err) {
      console.error("Failed to load conversations for sharing", err);
    }
  };

  const handleSendShare = async (targetUserId) => {
    if (!messageToShare) return;
    try {
      const payload = {
        content: `Shared an AI response:\n\n${messageToShare.text}`
      };

      if (messageToShare.generatedMediaUrl) {
        payload.mediaUrls = [messageToShare.generatedMediaUrl];
        payload.mediaTypes = [messageToShare.generatedMediaType || "image"];
        payload.mediaTitles = ["AI Generated Media"];
        payload.mediaDescriptions = [" "];
        payload.mediaDownloadable = [true];
      }

      await sendMessage(targetUserId, payload);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "AI response shared successfully! 🚀",
        }),
      );
      setShareModalOpen(false);
    } catch (error) {
      console.error("Failed to share AI response", error);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to share response. ❌",
        }),
      );
    }
  };

  const handleEditMessage = useCallback((text) => {
    setInput(text);
  }, []);

  const startNewChat = () => {
    setCurrentSessionId(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (id) => {
    if (!window.confirm("Are you sure you want to delete this chat session?"))
      return;
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) {
      setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
    }
    saveHistoryToDB(updated);
  };

  const speakFromOffset = useCallback(
    (text, msgIndex, offset, rate, isLiveMode = false) => {
      const textToSpeak = text.slice(offset);
      speakText(textToSpeak, {
        rate,
        onBoundary: (e) => {
          if (e.name === "word") {
            setSpeakingState((prev) => ({
              ...prev,
              charIndex: offset + e.charIndex,
              charLength: e.charLength,
            }));
          }
        },
        onEnd: () => {
          if (!isCancellingRef.current) {
            setSpeakingState({
              id: null,
              text: "",
              offset: 0,
              charIndex: 0,
              charLength: 0,
            });
            if (isLiveMode && generationModeRef.current === "voice") {
              setTimeout(() => {
                if (triggerLiveVoiceRef.current) triggerLiveVoiceRef.current();
              }, 500);
            }
          }
        },
        onError: () => {
          if (!isCancellingRef.current) {
            setSpeakingState({
              id: null,
              text: "",
              offset: 0,
              charIndex: 0,
              charLength: 0,
            });
          }
        },
      });
    },
    [],
  );

  const toggleVoice = (text, msgId, isLiveMode = false) => {
    if (speakingState.id === msgId) {
      stopSpeaking();
      setSpeakingState({
        id: null,
        text: "",
        offset: 0,
        charIndex: 0,
        charLength: 0,
      });
    } else {
      isCancellingRef.current = true;
      stopSpeaking();
      setTimeout(() => {
        isCancellingRef.current = false;
        const cleanText = text.replace(/[*#]/g, ""); // Strip basic markdown for speech
        setSpeakingState({
          id: msgId,
          text: cleanText,
          offset: 0,
          charIndex: 0,
          charLength: 0,
        });
        speakFromOffset(cleanText, msgId, 0, speechRate, isLiveMode);
      }, 50);
    }
  };

  const handleSpeechRateChange = (e) => {
    const newRate = parseFloat(e.target.value);
    setSpeechRate(newRate);
    localStorage.setItem("aiSpeechRate", newRate);
    if (speakingState.id !== null) {
      isCancellingRef.current = true;
      stopSpeaking();
      const currentOffset = speakingState.charIndex;
      setTimeout(() => {
        isCancellingRef.current = false;
        setSpeakingState((prev) => ({ ...prev, offset: currentOffset }));
        speakFromOffset(
          speakingState.text,
          speakingState.id,
          currentOffset,
          newRate,
        );
      }, 50);
    }
  };

  const handleVoiceChange = (e) => {
    const newVoice = e.target.value;
    setVoiceURI(newVoice);
    localStorage.setItem("aiSpeechVoice", newVoice);
  };

  const handleResetSettings = () => {
    if (
      !window.confirm(
        "Are you sure you want to reset all AI settings to their default values?",
      )
    )
      return;

    localStorage.removeItem("aiProvider");
    localStorage.removeItem("geminiApiKey");
    localStorage.removeItem("openAiApiKey");
    localStorage.removeItem("claudeApiKey");
    localStorage.removeItem("boltApiKey");
    localStorage.removeItem("v0devApiKey");
    localStorage.removeItem("emergentApiKey");
    localStorage.removeItem("perplexityApiKey");
    localStorage.removeItem("deepseekApiKey");
    localStorage.removeItem("openRouterApiKey");
    localStorage.removeItem("stabilityApiKey");
    localStorage.removeItem("ollamaHost");
    localStorage.removeItem("aiHighlightStyle");
    localStorage.removeItem("aiHighlightSpeed");
    localStorage.removeItem("aiTextSize");
    localStorage.removeItem("aiSpeechRate");
    localStorage.removeItem("aiSpeechVoice");

    Object.keys(AI_PROVIDERS).forEach((p) => {
      localStorage.removeItem(`${p}Model`);
    });

    setProvider("gemini");
    setKeys(getAiConfig());
    setHighlightStyle("yellow");
    setHighlightSpeed("duration-300");
    setTextSize("text-base");
    setSpeechRate(1);
    setVoiceURI("");

    window.dispatchEvent(
      new CustomEvent("showToast", {
        detail: "Settings reset to defaults! 🔄",
      }),
    );
  };

  const handleSaveToCalendar = async (text) => {
    try {
      await createEvent({
        title: "AI Generated Study Plan",
        description: text,
        start: new Date().toISOString(),
        end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(), // Default 1 hour duration
        category: "Study Plan",
        isPrivate: true,
        location: "Personal",
      });
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Study Plan saved to Calendar! 📅",
        }),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to save Study Plan. ❌",
        }),
      );
    }
  };

  const extractYoutubeId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  let isCurrentModeOffline = !activeKey;
  if (generationMode === "image") {
    isCurrentModeOffline = (imageModel === "openai" && !keys.openAiKey) || (imageModel === "stability" && !keys.stabilityKey);
  } else if (generationMode === "video") {
    isCurrentModeOffline = !keys.stabilityKey;
  }

  return (
    <div
      className={`flex h-[calc(100dvh-64px)] ${getWrapperThemeClasses(appTheme)} relative overflow-hidden animate-in fade-in transition-colors`}
    >
<UniversalSidebar
        isOpen={isSidebarOpen}
        isMobile={window.innerWidth < 768}
        isHidden={isSidebarHidden}
        onClose={() => setIsSidebarOpen(false)}
        className={`absolute md:relative z-50 w-[80%] sm:w-64 lg:w-80 h-full shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:hidden"}`}
      >
        <div className="p-4 border-b border-inherit flex justify-between items-center bg-transparent shrink-0">
          <h2 className="font-bold text-inherit flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{" "}
            Chat History
          </h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 opacity-70 hover:opacity-100 rounded-full"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      
      <div className="p-3 border-b border-inherit shrink-0">
        <div className="relative">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history (Ctrl+K)..."
            className="w-full p-2 pl-8 rounded-lg bg-black/5 dark:bg-white/5 border border-inherit/30 text-sm focus:outline-none focus:border-current transition-colors text-inherit"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 text-inherit" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-inherit">
              <CloseIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

        <div className="p-4 shrink-0">
          <button
            onClick={startNewChat}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-colors ${getPrimaryButtonClasses(appTheme)}`}
          >
            <Plus className="w-5 h-5" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
        {searchQuery ? (
           searchResults.length > 0 ? (
             searchResults.map(result => (
                <div key={result.id} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-sm border border-inherit/20 mb-1" onClick={() => jumpToMessage(result.sessionId, result.id)}>
                  <div className="font-semibold text-xs opacity-70 mb-1">{sessions.find(s => s.id === result.sessionId)?.title?.slice(0,25)}...</div>
                  <div dangerouslySetInnerHTML={{ __html: result.snippet }} className="line-clamp-2 opacity-90 text-inherit text-xs leading-relaxed" />
                </div>
             ))
           ) : (
             <p className="text-center text-sm opacity-70 mt-4 text-inherit">No results found.</p>
           )
        ) : (
          sessions.length > 0 ? (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between group p-3 rounded-xl cursor-pointer transition-colors border border-transparent ${currentSessionId === s.id ? "bg-black/10 dark:bg-white/10 border-inherit/30 font-bold text-inherit shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"}`}
                onClick={() => {
                  setCurrentSessionId(s.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 text-inherit ${currentSessionId === s.id ? "opacity-100" : "opacity-50"}`}
                  />
                  <span className="text-sm font-semibold truncate">
                    {s.title}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className={`p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-500 text-inherit transition-all ${currentSessionId === s.id ? "opacity-50" : "opacity-0 group-hover:opacity-50"} hover:opacity-100`}
                  title="Delete Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-sm opacity-70 text-inherit mt-4 font-medium">
              No previous chats.
            </p>
          )
        )}
        </div>
      </UniversalSidebar>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative h-full">
        {/* Header */}
      {/* =========================
    INDUSTRY-GRADE SMART HEADER
    Fixes:
    1. No blank gap when hidden
    2. Smooth collapse instead of translate-only
    3. Content expands upward automatically
    4. Offline warning moved OUTSIDE fixed header flow
    5. Better responsive height management
========================= */}

{/* HEADER WRAPPER (collapsible height) */}
<div
  className={`
    sticky top-0 z-20 shrink-0
    transition-all duration-500 ease-in-out
    overflow-hidden
    ${isHeaderHidden ? "max-h-0 opacity-0 pointer-events-none" : " opacity-100"}
  `}
>
  {/* Actual Header */}
  <header
    className={`
      ${getHeaderThemeClasses(appTheme)}
      p-3 sm:p-4
      flex justify-between items-center
      shadow-md
      backdrop-blur-xl
      border-b border-white/10
    `}
  >
    {/* LEFT SECTION */}
    <div className="flex items-center gap-3 min-w-0">
      {/* Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all duration-200 active:scale-95"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Bot Icon */}
      <div className="hidden sm:flex p-2 bg-white/20 rounded-xl backdrop-blur-sm shrink-0">
        <Bot className="w-8 h-8" />
      </div>

      {/* Title */}
      <div className="min-w-0">
        <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 flex-wrap">
          <span className="truncate">SocioFest AI</span>

          <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />

          {/* Landscape Provider Status */}
          {isLandscape && (
            <div className="flex items-center gap-2 flex-wrap">
              {activeKey ? (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-100 border border-green-500/30 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  {AI_PROVIDERS[provider]?.name || "AI"}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-100 border border-red-500/30 rounded-full font-medium">
                  Offline
                </span>
              )}

              <span
                className={`px-2 py-0.5 text-xs rounded-full font-medium border ${
                  serviceStatus === "online"
                    ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/30"
                    : serviceStatus === "offline"
                      ? "bg-amber-500/20 text-amber-100 border-amber-500/30"
                      : "bg-white/20 text-white border-white/20"
                }`}
              >
                {serviceStatus}
              </span>
            </div>
          )}
        </h1>

        <p className="opacity-80 text-sm hidden sm:block truncate">
          Your intelligent academic companion
        </p>
      </div>
    </div>

    {/* RIGHT SECTION */}
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 hover:bg-white/20 rounded-full transition-all duration-200 active:scale-95"
        title="AI Settings"
      >
        <MoreVertical className="w-6 h-6" />
      </button>
    </div>
  </header>
{/* =========================
    OFFLINE WARNING (SEPARATE FLOW)
    This prevents layout destruction
========================= */}
{isCurrentModeOffline && (
  <div className="px-3 sm:px-4 pt-3 animate-in slide-in-from-top-2 duration-300">
    <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3 shadow-sm backdrop-blur-md">
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

      <div className="min-w-0">
        <p className="font-bold text-sm">
          AI is currently offline for this mode.
        </p>

        <p className="text-sm mt-1 leading-relaxed">
          You haven’t configured an API key for the selected provider.
          Select a free local model or use the three-dot menu to add your key.
        </p>
      </div>
    </div>
  </div>
)}
</div>


        {/* Settings Overlay */}
        <div
          className={`absolute inset-0 bg-black/20 z-40 backdrop-blur-sm transition-opacity duration-300 ${
            showSettings ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
          onClick={() => setShowSettings(false)}
        />

        {/* Settings Sidebar */}
        <div
          className={`absolute top-0 right-0 h-full w-[85%] sm:w-80 ${getWrapperThemeClasses(appTheme)} shadow-2xl border-l border-inherit z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
            showSettings ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-inherit flex justify-between items-center bg-transparent shrink-0">
            <h2 className="font-bold text-inherit flex items-center gap-2">
              <Settings className="w-5 h-5 opacity-80" /> AI Settings
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4" /> AI Model
              </label>
          <input
            type="text"
            list="ai-models-list"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  localStorage.setItem(`${provider}Model`, e.target.value);
                }}
            placeholder="Select or type a custom model ID..."
                className="w-full p-2.5 rounded-lg border border-inherit focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit font-medium truncate"
          />
              <datalist id="ai-models-list">
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-inherit focus:ring-2 focus:ring-current outline-none bg-black/5 dark:bg-white/5 text-inherit font-medium"
              >
                {Object.entries(AI_PROVIDERS).map(([key, p]) => (
                  <option
                    key={key}
                    value={key}
                    className={getOptionClasses(appTheme, isDark)}
                  >
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold opacity-90 mb-1 flex items-center gap-2">
                <Key className="w-4 h-4" /> {AI_PROVIDERS[provider]?.name} API
                Key / Host
              </label>
              {provider === "auto" ? (
                <p className="text-xs opacity-70 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg p-3">
                  Auto mode uses server-managed model routing and fallback keys.
                  Configure order in the AI Fallback Chain section below.
                </p>
              ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveKey(); }} className="w-full flex flex-col gap-2">
                <input
                  type="password"
                  value={keys[AI_PROVIDERS[provider]?.keyField] || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setKeys((prev) => ({
                      ...prev,
                      [AI_PROVIDERS[provider]?.keyField]: val,
                    }));
                  }}
                  placeholder={AI_PROVIDERS[provider]?.placeholder}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  autoComplete="new-password"
                  className="w-full p-2.5 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none select-none"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-bold rounded-lg transition-colors border border-inherit/30 hover:border-inherit/50"
                >
                  Save Key
                </button>
              </form>
              )}
              <p className="text-xs opacity-70 mt-2">
                Stored securely in your browser cache and backed up to your
                profile.
              </p>
            </div>

            <div className="border-t border-inherit pt-4">
              <label className="block text-sm font-bold opacity-90 mb-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> AI Fallback Chain
              </label>
              <p className="text-xs opacity-70 mb-3">
                Configure provider/model order for `auto` routing with failover.
              </p>
              <div className="space-y-2">
                {(runtimeConfig?.routes?.chat || []).slice(0, 3).map((node, idx) => (
                  <div key={`${node.provider}-${idx}`} className="rounded-lg border border-inherit/30 p-2 bg-black/5 dark:bg-white/5">
                    <div className="text-[10px] opacity-70 mb-1">Priority {idx + 1}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={node.provider || ""}
                        onChange={(e) => handleRuntimeNodeChange(idx, "provider", e.target.value)}
                        className="p-2 rounded-md border border-inherit/30 bg-transparent text-xs"
                        placeholder="provider"
                      />
                      <input
                        value={node.model || ""}
                        onChange={(e) => handleRuntimeNodeChange(idx, "model", e.target.value)}
                        className="p-2 rounded-md border border-inherit/30 bg-transparent text-xs"
                        placeholder="model"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSaveRuntimeConfig}
                disabled={runtimeConfigBusy}
                className="w-full mt-3 py-2.5 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-bold rounded-lg transition-colors border border-inherit/30 disabled:opacity-60"
              >
                {runtimeConfigBusy ? "Saving..." : "Save Fallback Chain"}
              </button>
            </div>

            <div className="border-t border-inherit pt-4">
              <label className="block text-sm font-bold opacity-90 mb-2">
                Source Edit Preview
              </label>
              <p className="text-xs opacity-70 mb-2">
                Safely preview AI-assisted code edits before applying them.
              </p>
              <input
                value={sourceEditForm.filePath}
                onChange={(e) =>
                  setSourceEditForm((prev) => ({ ...prev, filePath: e.target.value }))
                }
                className="w-full mb-2 p-2 rounded-md border border-inherit/30 bg-transparent text-xs"
                placeholder="File path"
              />
              <textarea
                value={sourceEditForm.instruction}
                onChange={(e) =>
                  setSourceEditForm((prev) => ({ ...prev, instruction: e.target.value }))
                }
                className="w-full mb-2 p-2 rounded-md border border-inherit/30 bg-transparent text-xs min-h-[70px]"
                placeholder="Edit instruction"
              />
              <textarea
                value={sourceEditForm.currentCode}
                onChange={(e) =>
                  setSourceEditForm((prev) => ({ ...prev, currentCode: e.target.value }))
                }
                className="w-full mb-2 p-2 rounded-md border border-inherit/30 bg-transparent text-xs min-h-[90px]"
                placeholder="Current code"
              />
              <button
                onClick={handleSourceEditPreview}
                disabled={sourceEditBusy}
                className="w-full py-2.5 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-bold rounded-lg transition-colors border border-inherit/30 disabled:opacity-60"
              >
                {sourceEditBusy ? "Generating..." : "Generate Preview"}
              </button>
              {sourceEditPreview ? (
                <div className="mt-2 p-2 rounded-md border border-inherit/30 bg-black/5 dark:bg-white/5 text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                  {sourceEditPreview}
                </div>
              ) : null}
            </div>

            <div className="border-t border-inherit pt-4">
              <label className="flex text-sm font-bold opacity-90 mb-2 items-center justify-between gap-2 cursor-pointer group">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Auto-Speak Responses
                </div>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="w-4 h-4 accent-current cursor-pointer"
                />
              </label>
              <p className="text-[10px] opacity-70 mb-4">
                AI will automatically read its messages aloud.
              </p>

              <label className="block text-sm font-bold opacity-90 mb-2 flex items-center gap-2">
                <Mic className="w-4 h-4" /> AI Voice
              </label>
              <select
                value={voiceURI}
                onChange={handleVoiceChange}
                className="w-full p-2.5 rounded-lg border border-inherit bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none font-medium text-sm"
              >
                <option value="">System Default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex text-sm font-bold opacity-90 mb-2 items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Speech Rate
                </div>
                <span className="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded font-bold border border-inherit">
                  {speechRate.toFixed(1)}x
                </span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={speechRate}
                onChange={handleSpeechRateChange}
                className="w-full h-2 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-current focus:outline-none focus:ring-2 focus:ring-current mb-1"
              />
              <div className="flex justify-between text-[10px] opacity-70 font-bold px-1 mb-1">
                <span>0.5x</span>
                <span>3.0x</span>
              </div>
            </div>

            <AIHighlightCustomizer
              highlightStyle={highlightStyle}
              setHighlightStyle={setHighlightStyle}
              highlightSpeed={highlightSpeed}
              setHighlightSpeed={setHighlightSpeed}
              textSize={textSize}
              setTextSize={setTextSize}
            />

            <div className="border-t border-inherit pt-4">
              <button
                onClick={handleResetSettings}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-lg transition-colors border border-red-500/30 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reset to Defaults
              </button>
            </div>
          </div>
        </div>

        

        {/* Chat Area */}
        <div
          className="flex-1 bg-transparent overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full"
          ref={chatContainerRef}
        onScroll={handleChatScroll}
        >
          <div className="flex flex-col pb-4">
            {messages.map((m, i) => {
              const msgId = m.id || `legacy-${i}`;
              return (
                <div
                  key={msgId}
              id={msgId}
                  className={`group flex gap-4 px-4 py-6 md:px-8 transition-colors ${getRowClasses(appTheme, m.role)}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-1">
                    {m.role === "user" ? (
                      <UserInfo
                        user={user}
                        avatarSize="w-8 h-8"
                        showText={false}
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-inherit mb-1 text-sm">
                      {m.role === "user"
                        ? "You"
                        : (m.provider && AI_PROVIDERS[m.provider]?.name) ||
                          AI_PROVIDERS[provider]?.name ||
                          "AI Assistant"}
                    </div>

                    {m.hasMedia && m.role === "user" && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {m.mediaUrls?.length > 0 ? (
                          m.mediaUrls.map((url, uIdx) => {
                            const safeUrl = typeof url === 'string' ? url.replace(/\\/g, "/") : url;
                            return (
                              <div
                                key={uIdx}
                                className="relative group inline-flex flex-col rounded-lg border border-inherit/30 overflow-hidden bg-black/5"
                              >
                                {m.mediaTypes?.[uIdx] === "video" ? (
                                  <video
                                    src={safeUrl}
                                    controls
                                    className="h-24 w-auto object-cover"
                                  />
                                ) : m.mediaTypes?.[uIdx] === "audio" ? (
                                  <audio src={safeUrl} controls className="h-12 w-48" />
                                ) : (
                                  <img
                                    src={safeUrl}
                            className="h-24 w-auto object-cover bg-black/5"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://placehold.co/100x100/1a1a1a/ffffff?text=Expired";
                            }}
                                  />
                                )}
                                {m.mediaTitles?.[uIdx] && (
                                  <div className="bg-black/10 dark:bg-white/10 border-t border-inherit/30 text-inherit text-[10px] px-1.5 py-0.5 truncate text-center w-full max-w-[150px]">
                                    {m.mediaTitles[uIdx]}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        ) : (
                          <div className="text-xs font-medium bg-black/5 dark:bg-white/5 border border-inherit w-fit px-3 py-1.5 rounded-lg flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Media attached
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`prose max-w-none text-inherit leading-relaxed break-words ${textSize}`}
                    >
                      {speakingState.id === msgId ? (
                        <HighlightedText
                          text={speakingState.text}
                          charIndex={speakingState.charIndex}
                          charLength={speakingState.charLength}
                          customClass={
                            HIGHLIGHT_STYLES[highlightStyle]?.classes
                          }
                          speedClass={highlightSpeed}
                          textSizeClass={textSize}
                        />
                      ) : (
                        <ReactMarkdown
                          components={{
                            a({ node, href, children, ...props }) {
                              const safeHref =
                                href &&
                                href
                                  .trim()
                                  .toLowerCase()
                                  .startsWith("javascript:")
                                  ? "#"
                                  : href;
                              if (!safeHref)
                                return <a {...props}>{children}</a>;
                              const ytId = extractYoutubeId(safeHref);
                              if (ytId) {
                                return (
                                  <span className="block my-3 max-w-sm overflow-hidden break-inside-avoid">
                                    <a
                                      href={safeHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-500 dark:text-indigo-400 hover:underline mb-2 block text-sm font-medium"
                                    >
                                      {children}
                                    </a>
                                    <LinkPreviewCard
                                      preview={{
                                        type: "youtube",
                                        mediaId: ytId,
                                        url: href,
                                        title: "YouTube Video",
                                      }}
                                    />
                                  </span>
                                );
                              }
                              if (
                                /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(
                                  safeHref,
                                )
                              ) {
                                return (
                                  <span className="block my-3 max-w-sm shrink-0 break-inside-avoid rounded-lg overflow-hidden border border-inherit/30 shadow-sm">
                                    <img
                                      src={safeHref}
                                      alt="Image link"
                                      className="w-full h-auto object-contain bg-black/5"
                                      loading="lazy"
                                    />
                                  </span>
                                );
                              }
                              return (
                                <a
                                  href={safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-500 dark:text-indigo-400 hover:underline font-medium break-all"
                                  {...props}
                                >
                                  {children}
                                </a>
                              );
                            },
                            code({
                              node,
                              inline,
                              className,
                              children,
                              ...props
                            }) {
                              const match = /language-(\w+)/.exec(
                                className || "",
                              );
                              const codeString = String(children).replace(
                                /\n$/,
                                "",
                              );
                              if (!inline && match) {
                                return (
                                  <div className="relative my-4 rounded-xl overflow-hidden bg-black/80 border border-white/10 shadow-sm not-prose">
                                    <div className="flex items-center justify-between px-4 py-2 bg-white/10 border-b border-white/10 text-gray-300 text-xs font-mono font-medium">
                                      <span>{match[1]}</span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(
                                            codeString,
                                          );
                                          window.dispatchEvent(
                                            new CustomEvent("showToast", {
                                              detail: "Code copied! 📋",
                                            }),
                                          );
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-600 rounded-md transition-colors text-gray-300 hover:text-white"
                                        title="Copy Code"
                                      >
                                        <Copy className="w-3.5 h-3.5" /> Copy
                                      </button>
                                    </div>
                                    <div className="p-4 overflow-x-auto text-gray-100 text-sm font-mono leading-normal">
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <code
                                  className="bg-black/10 dark:bg-white/10 text-inherit px-1.5 py-0.5 rounded-md text-[13px] font-mono font-semibold"
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      )}
                    </div>

                    {m.generatedMediaUrl && (
                      <div className="mt-4 rounded-xl overflow-hidden shadow-md border border-inherit/30 inline-block max-w-sm bg-black/5 relative group/media">
                        {m.generatedMediaType === "video" ? (
                          <video
                            src={m.generatedMediaUrl}
                            controls
                            className="w-full h-auto bg-black cursor-pointer"
                            onPlay={(e) => {
                              e.preventDefault();
                              e.target.pause();
                              setFullscreenMedia({
                                url: m.generatedMediaUrl,
                                type: "video",
                                title: "AI Generated Video",
                                isDownloadable: true,
                              });
                            }}
                          />
                        ) : (
                          <img
                            src={m.generatedMediaUrl}
                            alt="AI Generated"
                            className="w-full h-auto cursor-pointer hover:opacity-95 transition-opacity bg-black/5"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "https://placehold.co/1024x1024/1a1a1a/ffffff?text=Expired";
                            }}
                            onClick={() =>
                              setFullscreenMedia({
                                url: m.generatedMediaUrl,
                                type: "image",
                                title: "AI Generated Image",
                                isDownloadable: true,
                              })
                            }
                          />
                        )}
                        <div className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const a = document.createElement("a");
                              a.href = m.generatedMediaUrl;
                              a.download = `AI_Generated_${Date.now()}.${m.generatedMediaType === "video" ? "mp4" : "png"}`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md shadow-sm transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.role === "user" ? (
                          <button
                            onClick={() => handleEditMessage(m.text)}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Edit & Focus"
                            aria-label="Edit this prompt"
                          >
                            <Edit2 className="w-4 h-4" /> Edit
                          </button>
                      ) : (
                        <>
                          {i === messages.length - 1 && (
                            <button
                              onClick={handleRegenerate}
                              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors"
                              title="Regenerate Response"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleShareClick(m)}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors"
                            title="Share in Chat"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopy(m.text)}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleVoice(m.text, msgId)}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors"
                            title={
                              speakingState.id === msgId ? "Stop" : "Read Aloud"
                            }
                          >
                            {speakingState.id === msgId ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSaveToCalendar(m.text)}
                            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md opacity-70 hover:opacity-100 transition-colors hidden sm:block"
                            title="Save to Calendar as Study Plan"
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div
                className={`flex gap-4 px-4 py-6 md:px-8 transition-colors ${getRowClasses(appTheme, "ai")}`}
              >
                <div className="shrink-0 mt-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                  >
                    <Bot className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-inherit mb-1 text-sm">
                    {AI_PROVIDERS[provider]?.name || "AI Assistant"}
                  </div>
                  
                  {/* Dynamic Interactive Loaders based on Generation Type */}
                  {generationMode === "image" ? (
                    <div className="mt-3 relative w-full max-w-sm h-48 sm:h-64 rounded-xl overflow-hidden bg-black/10 dark:bg-white/10 border border-inherit/20 flex flex-col items-center justify-center gap-4 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-500/10 dark:via-blue-400/10 to-transparent animate-pulse"></div>
                      <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 shadow-lg border border-inherit/10">
                        <ImageIcon className="w-8 h-8 text-blue-500 animate-bounce" />
                      </div>
                      <div className="relative z-10 flex flex-col items-center">
                        <span className="text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse tracking-wide">Painting your vision...</span>
                        <span className="text-xs font-medium text-inherit opacity-60 mt-1">Applying fine details & framing</span>
                      </div>
                    </div>
                  ) : generationMode === "video" ? (
                    <div className="mt-3 relative w-full max-w-sm h-48 sm:h-64 rounded-xl overflow-hidden bg-black/10 dark:bg-white/10 border border-inherit/20 flex flex-col items-center justify-center gap-4 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-purple-500/10 dark:via-purple-400/10 to-transparent animate-pulse"></div>
                      <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-black/5 dark:bg-white/5 shadow-lg border border-inherit/10">
                        <Video className="w-8 h-8 text-purple-500 animate-bounce" />
                      </div>
                      <div className="relative z-10 flex flex-col items-center">
                        <span className="text-sm font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse tracking-wide">Directing your video...</span>
                        <span className="text-xs font-medium text-inherit opacity-60 mt-1">Rendering motion & frames</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 h-6 items-center mt-2">
                      <span className="w-2 h-2 bg-current opacity-70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-current opacity-70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-current opacity-70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

      {/* Floating Action Buttons */}
      <div className="relative h-0 w-full">
        {/* Scroll button */}
        {showScrollButton && (
          <div className="absolute bottom-4 right-6 z-40 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className={`p-3 rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center ${getPrimaryButtonClasses(appTheme)}`}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {/* Floating Search - always visible */}
        <div className="absolute bottom-20 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 group">
          <button
            onClick={() => setQuickChatOpen(true)}
            className={`p-3.5 rounded-full shadow-2xl backdrop-blur-lg transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center ${getPrimaryButtonClasses(appTheme)} hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]`}
            title="Quick AI Query"
            aria-label="Open Quick Query Window"
          >
            <Zap className="w-5 h-5" />
          </button>
        </div>
      </div>

        {/* Input Area */}
        <div className="p-1.5  bg-transparent border-t border-inherit shrink-0 relative transition-colors">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 mb-1.5 p-1 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg w-fit mx-auto sm:mx-0 shadow-inner">
            <button
              onClick={() => setGenerationMode("chat")}
              className={`px-2 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${generationMode === "chat" ? "bg-black/10 dark:bg-white/10 text-inherit shadow-sm border border-inherit/30" : "text-current opacity-70 hover:opacity-100 border border-transparent"}`}
            >
              Chat
            </button>
            <button
              onClick={() => setGenerationMode("image")}
              className={`px-2 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${generationMode === "image" ? "bg-black/10 dark:bg-white/10 text-inherit shadow-sm border border-inherit/30" : "text-current opacity-70 hover:opacity-100 border border-transparent"}`}
            >
              Image
            </button>
            <button
              onClick={() => setGenerationMode("video")}
              className={`px-2 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${generationMode === "video" ? "bg-black/10 dark:bg-white/10 text-inherit shadow-sm border border-inherit/30" : "text-current opacity-70 hover:opacity-100 border border-transparent"}`}
            >
              Video
            </button>
            <button
              onClick={() => {
                setGenerationMode("voice");
                setVoiceState("idle");
                setInput("");
              }}
              className={`px-2 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${generationMode === "voice" ? "bg-black/10 dark:bg-white/10 text-inherit shadow-sm border border-inherit/30" : "text-current opacity-70 hover:opacity-100 border border-transparent"}`}
            >
              Live Voice
            </button>
          

          {/* Aspect Ratio & Auto Enhance Configuration Tool Bar */}
          {generationMode === "image" && (
            <div className="flex flex-wrap items-center gap-2 p-1 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg w-fit mx-auto sm:mx-0 shadow-inner animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-bold opacity-70 flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Ratio:</span>
              {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${aspectRatio === ratio ? "bg-blue-500 text-white shadow-md" : "bg-black/10 dark:bg-white/10 text-inherit hover:bg-black/20 dark:hover:bg-white/20"}`}
                >
                  {ratio}
                </button>
              ))}
              <div className="w-px h-4 bg-inherit opacity-20 mx-1"></div>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold opacity-90 hover:opacity-100 transition-opacity">
                <input type="checkbox" checked={autoEnhance} onChange={(e) => setAutoEnhance(e.target.checked)} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
                <Sparkles className="w-3 h-3 text-yellow-500" /> Auto Enhance
              </label>
              <div className="w-px h-4 bg-inherit opacity-20 mx-1"></div>
              <span className="text-xs font-bold opacity-70 flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Model:</span>
              <select
                value={imageModel}
                onChange={(e) => {
                  setImageModel(e.target.value);
                  localStorage.setItem("aiImageModel", e.target.value);
                }}
                className="px-2 py-1 text-xs font-bold rounded-md bg-black/10 dark:bg-white/10 text-inherit hover:bg-black/20 dark:hover:bg-white/20 outline-none cursor-pointer"
              >
                <option value="pollinations" className={getOptionClasses(appTheme, isDark)}>Flux (Free)</option>
                <option value="openai" className={getOptionClasses(appTheme, isDark)}>DALL-E 3</option>
                <option value="stability" className={getOptionClasses(appTheme, isDark)}>Stability AI</option>
                <option value="stablediffusion" className={getOptionClasses(appTheme, isDark)}>Local SD</option>
              </select>
            </div>
            )}
              
            </div>
        


          {generationMode === "voice" ? (
            <div className="flex flex-col items-center justify-center py-4 w-full bg-black/5 dark:bg-white/5 rounded-2xl border border-inherit/30 shadow-inner relative overflow-hidden">
              {/* Language Selector Top Right */}
              <select
                value={liveSpeechLang}
                onChange={(e) => {
                  setLiveSpeechLang(e.target.value);
                  localStorage.setItem("aiSpeechLang", e.target.value);
                }}
                className={`absolute top-4 right-4 bg-black/10 dark:bg-white/10 border border-inherit/20 rounded-lg text-xs text-inherit p-1.5 outline-none cursor-pointer z-10 font-bold shadow-sm ${getOptionClasses(appTheme, isDark)}`}
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

              <div className="relative flex items-center justify-center w-32 h-32 ">
                {voiceState === "listening" && (
                  <div
                    className="absolute inset-0 bg-red-500/30 rounded-full transition-transform duration-75 pointer-events-none"
                    style={{ transform: `scale(${1 + micVolume / 40})` }}
                  />
                )}
                <button
                  onClick={() =>
                    voiceState === "idle"
                      ? startLiveListening()
                      : stopLiveVoice()
                  }
                  className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all duration-500 shadow-xl ${
                    voiceState === "listening"
                      ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                      : voiceState === "thinking"
                        ? "bg-yellow-500 animate-spin shadow-[0_0_30px_rgba(234,179,8,0.6)]"
                        : voiceState === "speaking"
                          ? "bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.6)] scale-110"
                          : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  <Mic
                    className={`w-8 h-8 text-white ${voiceState === "speaking" ? "animate-bounce" : ""}`}
                  />
                </button>
              </div>
              <h3 className="mt-1 text-lg font-bold text-inherit">
                {voiceState === "listening"
                  ? "Listening..."
                  : voiceState === "thinking"
                    ? "Thinking..."
                    : voiceState === "speaking"
                      ? "Speaking..."
                      : "Tap to Start Conversation"}
              </h3>
              <p className="mt-1 text-inherit opacity-80 text-center max-w-md min-h-[3rem] text-sm px-4 font-medium line-clamp-3">
                {input ||
                  (voiceState === "idle"
                    ? "Hands-free continuous voice mode."
                    : "...")}
              </p>

              {input.trim() && voiceState === "listening" && (
                <button
                  onClick={() => {
                    clearTimeout(voiceSilenceTimeout.current);
                    liveVoiceManualStopRef.current = true;
                    if (liveVoiceRecRef.current)
                      try {
                        liveVoiceRecRef.current.stop();
                      } catch (e) {}
                    if (handleSendRef.current)
                      handleSendRef.current(input.trim(), true);
                  }}
                  className="mt-5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 transition-transform active:scale-95"
                >
                  <Send className="w-4 h-4" /> Send Now
                </button>
              )}
            </div>
          ) : (
            <PostComposer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              isSending={loading}
              placeholder={
                generationMode === "chat"
                  ? "Ask the AI Assistant..."
                  : `Enter prompt to generate ${generationMode}...`
              }
              user={user}
              attachments={attachments}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
              allowVoice={true}
              attachmentType="image"
              hideInternalPreview={false}
              setFullscreenMedia={setFullscreenMedia}
            />
          )}
        </div>
      </div>

      {/* Quick Chat Overlay / Floating Window */}
      {quickChatOpen && (
        <div
          style={{
            top: `${quickChatPos.y}px`,
            left: `${quickChatPos.x}px`,
            width: `${quickChatSize.w}px`,
            height: `${quickChatSize.h}px`,
          }}
          className={`fixed z-[100] flex flex-col rounded-2xl shadow-2xl border border-inherit/30 overflow-hidden ${getWrapperThemeClasses(appTheme)} bg-white/95 dark:bg-black/95 backdrop-blur-xl`}
        >
          {/* Header */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX - quickChatPos.x;
              const startY = e.clientY - quickChatPos.y;
              const onMouseMove = (moveEvent) => {
                setQuickChatPos({
                  x: moveEvent.clientX - startX,
                  y: moveEvent.clientY - startY
                });
              };
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
            className="p-3 border-b border-inherit/20 flex justify-between items-center cursor-move bg-black/5 dark:bg-white/5 shrink-0"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-inherit">
              <Zap className="w-4 h-4 text-yellow-500" /> Quick AI Query
            </div>
            <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setQuickChatOpen(false)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-inherit">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
            {quickMessages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center opacity-60 text-inherit h-full">
                <Zap className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Ask a quick question</p>
              </div>
            )}
            {quickMessages.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm ${m.role === 'user' ? 'bg-blue-500/10 ml-4 border border-blue-500/20' : 'bg-black/5 dark:bg-white/5 mr-4 border border-inherit/20'} text-inherit`}>
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            ))}
            {quickLoading && (
              <div className="text-xs opacity-70 flex items-center gap-2 text-inherit">
                <div className="loader" style={{ "--s": "10px", "--g": "2px" }}></div>
                Thinking...
              </div>
            )}
          </div>

          <div className="p-2 border-t border-inherit/20 bg-transparent shrink-0" onMouseDown={(e) => e.stopPropagation()}>
            <PostComposer
              value={quickInput}
              onChange={setQuickInput}
              onSend={async (overrideText = null) => {
                const text = typeof overrideText === 'string' ? overrideText : quickInput;
                if (!text.trim()) return;

                const newMsg = { role: "user", text };
                const newMessages = [...quickMessages, newMsg];
                setQuickMessages(newMessages);
                setQuickInput("");
                setQuickLoading(true);

                try {
                  const response = await generateContent(newMessages, undefined, []);
                  setQuickMessages([...newMessages, { role: "ai", text: response }]);
                } catch (err) {
                  setQuickMessages([...newMessages, { role: "ai", text: "**Error:** " + err.message }]);
                } finally {
                  setQuickLoading(false);
                }
              }}
              isSending={quickLoading}
              placeholder="Ask something quick..."
              user={user}
              hideInternalPreview={true}
              attachments={[]}
              onAddFiles={() => {}}
              onRemoveFile={() => {}}
            />
          </div>

          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const startX = e.clientX;
              const startY = e.clientY;
              const startW = quickChatSize.w;
              const startH = quickChatSize.h;
              const onMouseMove = (moveEvent) => {
                setQuickChatSize({
                  w: Math.max(300, startW + (moveEvent.clientX - startX)),
                  h: Math.max(300, startH + (moveEvent.clientY - startY))
                });
              };
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
          />
        </div>
      )}

      {fullscreenMedia && (
        <div className="absolute z-[9999]">
          <DocumentViewer
            url={fullscreenMedia.url}
            title={fullscreenMedia.title || "Media"}
            media={fullscreenMedia}
            currentUser={user}
            onClose={() => setFullscreenMedia(null)}
            canEdit={false}
          />
        </div>
      )}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        users={shareUsers}
        onShare={handleSendShare}
      />
    </div>
  );
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
export default AIHub;
