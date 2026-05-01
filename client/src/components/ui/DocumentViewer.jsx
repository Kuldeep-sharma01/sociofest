import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Edit2,
  Save,
  FileText,
  File,
  Maximize2,
  AlertCircle,
  Settings2,
  Printer,
  Type,
  Code2,
  Table as TableIcon,
  Layout,
  Search,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  AlignLeft,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  FileImage,
  Terminal,
  Copy,
  Eye,
  FileArchive,
  ListOrdered,
  BookOpen,
  SplitSquareHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  MonitorPlay,
  Headphones,
  Bot,
  Play,
  TerminalSquare,
  Send,
  Cloud,
  ExternalLink,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import { fetchTextResource } from "@/services/apiClient";
import { generateContent } from "@/services/aiService";
import { runCodeOnPistonEmacs } from "@/services/compilerService";
import { useTheme } from "@/context/ThemeContext";
import FullscreenMediaModal from "./FullscreenMediaModal";
import {
  getHeaderThemeClasses,
  getPanelTheme,
  getOptionClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";
import { downloadMedia, downloadBlob } from "@/utils/downloadUtils";
import { getPublicSystemSettings } from "@/services/systemSettingsService";

// --- UNIVERSAL FILE DETECTION MAP ---
const EXTENSION_MAP = {
  // Web
  html: { type: "code", lang: "html", icon: FileCode2, name: "HTML Document" },
  css: { type: "code", lang: "css", icon: FileCode2, name: "CSS Stylesheet" },
  scss: {
    type: "code",
    lang: "scss",
    icon: FileCode2,
    name: "Sass Stylesheet",
  },
  less: {
    type: "code",
    lang: "less",
    icon: FileCode2,
    name: "Less Stylesheet",
  },
  js: { type: "code", lang: "javascript", icon: FileCode2, name: "JavaScript" },
  jsx: { type: "code", lang: "javascript", icon: FileCode2, name: "React JSX" },
  ts: { type: "code", lang: "typescript", icon: FileCode2, name: "TypeScript" },
  tsx: { type: "code", lang: "typescript", icon: FileCode2, name: "React TSX" },
  json: { type: "code", lang: "json", icon: FileJson, name: "JSON Data" },
  xml: { type: "code", lang: "xml", icon: FileCode2, name: "XML Document" },
  yaml: { type: "code", lang: "yaml", icon: FileCode2, name: "YAML Config" },
  yml: { type: "code", lang: "yaml", icon: FileCode2, name: "YAML Config" },

  // Backend / Systems
  py: { type: "code", lang: "python", icon: FileCode2, name: "Python Script" },
  java: { type: "code", lang: "java", icon: FileCode2, name: "Java Source" },
  c: { type: "code", lang: "c", icon: FileCode2, name: "C Source" },
  cpp: { type: "code", lang: "cpp", icon: FileCode2, name: "C++ Source" },
  cs: { type: "code", lang: "csharp", icon: FileCode2, name: "C# Source" },
  go: { type: "code", lang: "go", icon: FileCode2, name: "Go Source" },
  rs: { type: "code", lang: "rust", icon: FileCode2, name: "Rust Source" },
  rb: { type: "code", lang: "ruby", icon: FileCode2, name: "Ruby Script" },
  php: { type: "code", lang: "php", icon: FileCode2, name: "PHP Script" },
  sh: { type: "code", lang: "shell", icon: Terminal, name: "Shell Script" },
  bat: { type: "code", lang: "bat", icon: Terminal, name: "Batch File" },
  ps1: { type: "code", lang: "powershell", icon: Terminal, name: "PowerShell" },
  sql: { type: "code", lang: "sql", icon: FileCode2, name: "SQL Query" },

  // Data / Text
  md: { type: "markdown", lang: "markdown", icon: BookOpen, name: "Markdown" },
  csv: {
    type: "csv",
    lang: "plaintext",
    icon: FileSpreadsheet,
    name: "CSV Table",
  },
  tsv: {
    type: "csv",
    lang: "plaintext",
    icon: FileSpreadsheet,
    name: "TSV Table",
  },
  txt: { type: "text", lang: "plaintext", icon: AlignLeft, name: "Plain Text" },
  rtf: { type: "text", lang: "plaintext", icon: AlignLeft, name: "Rich Text" },
  log: { type: "text", lang: "plaintext", icon: AlignLeft, name: "Log File" },
  ini: { type: "code", lang: "ini", icon: Settings2, name: "INI Config" },
  toml: { type: "code", lang: "ini", icon: Settings2, name: "TOML Config" },
  env: { type: "code", lang: "ini", icon: Settings2, name: "Environment Vars" },
  properties: {
    type: "code",
    lang: "ini",
    icon: Settings2,
    name: "Properties",
  },
  conf: { type: "code", lang: "ini", icon: Settings2, name: "Config File" },

  // Office
  doc: { type: "office", icon: FileText, name: "Word Document" },
  docx: { type: "office", icon: FileText, name: "Word Document" },
  xls: { type: "office", icon: FileSpreadsheet, name: "Excel Spreadsheet" },
  xlsx: { type: "office", icon: FileSpreadsheet, name: "Excel Spreadsheet" },
  ppt: { type: "office", icon: Layout, name: "PowerPoint" },
  pptx: { type: "office", icon: Layout, name: "PowerPoint" },

  // PDF
  pdf: { type: "pdf", icon: FileText, name: "PDF Document" },

  // Images
  jpg: { type: "image", icon: FileImage, name: "JPEG Image" },
  jpeg: { type: "image", icon: FileImage, name: "JPEG Image" },
  png: { type: "image", icon: FileImage, name: "PNG Image" },
  gif: { type: "image", icon: FileImage, name: "GIF Image" },
  webp: { type: "image", icon: FileImage, name: "WebP Image" },
  svg: { type: "image", icon: FileImage, name: "SVG Vector" },
  bmp: { type: "image", icon: FileImage, name: "Bitmap Image" },
  ico: { type: "image", icon: FileImage, name: "Icon File" },
  tiff: { type: "image", icon: FileImage, name: "TIFF Image" },

  // Media
  mp4: { type: "video", icon: MonitorPlay, name: "MP4 Video" },
  webm: { type: "video", icon: MonitorPlay, name: "WebM Video" },
  ogg: { type: "video", icon: MonitorPlay, name: "OGG Video" },
  mov: { type: "video", icon: MonitorPlay, name: "QuickTime Video" },
  mkv: { type: "video", icon: MonitorPlay, name: "MKV Video" },
  mp3: { type: "audio", icon: Headphones, name: "MP3 Audio" },
  wav: { type: "audio", icon: Headphones, name: "WAV Audio" },
  m4a: { type: "audio", icon: Headphones, name: "M4A Audio" },

  // Archives
  zip: { type: "archive", icon: FileArchive, name: "ZIP Archive" },
  rar: { type: "archive", icon: FileArchive, name: "RAR Archive" },
  "7z": { type: "archive", icon: FileArchive, name: "7Z Archive" },
  tar: { type: "archive", icon: FileArchive, name: "TAR Archive" },
  gz: { type: "archive", icon: FileArchive, name: "GZIP Archive" },

  // Embeds
  youtube: { type: "youtube", icon: MonitorPlay, name: "YouTube Video" },
  gdrive: { type: "embed", icon: Cloud, name: "Google Workspace Document" },
};

// --- CSV PARSER ---
const parseCSV = (text) => {
  if (!text) return [];
  const result = [];
  let currentLine = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentLine.push(currentVal);
      currentVal = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentLine.push(currentVal);
      result.push(currentLine);
      currentLine = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal !== "" || currentLine.length > 0) {
    currentLine.push(currentVal);
    result.push(currentLine);
  }
  return result;
};

const DocumentViewer = ({
  url,
  title = "Document",
  onClose,
  canEdit = true,
  onSave,
  media = null,
  currentUser = null,
}) => {
  const { appTheme, isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const editorRef = useRef(null);

  // Advanced extension and MIME detection
  const cleanUrl = url?.split("?")[0] || "";
  let ext = "";
  const urlParts = cleanUrl.split("/");
  const filename = urlParts[urlParts.length - 1] || "";
  if (filename.includes(".")) {
    ext = filename.split(".").pop().toLowerCase();
  }

  // If the URL didn't have a valid extension, fallback to checking the title
  if (!EXTENSION_MAP[ext] && title && title.includes(".")) {
    ext = title.split(".").pop().toLowerCase();
  }

  // Explicit media type fallback
  if (url && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
    ext = "gdrive";
  } else if (!EXTENSION_MAP[ext]) {
    if (media?.type === "pdf" || media?.type === "application/pdf") {
      ext = "pdf";
    } else if (media?.type === "image" || media?.type?.startsWith("image/")) {
      ext = "jpg";
    } else if (media?.type === "video" || media?.type?.startsWith("video/")) {
      ext = "mp4";
    } else if (media?.type === "audio" || media?.type?.startsWith("audio/")) {
      ext = "mp3";
    } else if (media?.type === "youtube" || media?.type === "embed" || /youtube\.com|youtu\.be/i.test(cleanUrl)) {
      ext = "youtube";
    }
  }

  const fileInfo = EXTENSION_MAP[ext] || {
    type: "text", // Default to text to force the Monaco Editor to render for unknown files
    lang: "plaintext",
    icon: File,
    name: "Plain Text (Auto-detected)",
  };

  const isPdf = fileInfo.type === "pdf";
  const isOffice = fileInfo.type === "office";
  const isTextBased = ["code", "text", "markdown", "csv"].includes(
    fileInfo.type,
  );
  const isImage = fileInfo.type === "image";
  const isVideo = fileInfo.type === "video";
  const isAudio = fileInfo.type === "audio";
  const isArchive = fileInfo.type === "archive";
  const isEmbed = fileInfo.type === "youtube";

  const absoluteUrl = url
    ? url.startsWith("http") || url.startsWith("blob:")
      ? url
      : new URL(url, window.location.origin).href
    : "";

  const isOwnMedia =
    currentUser?._id &&
    media?.authorId &&
    String(currentUser._id) === String(media.authorId);
  const isDownloadAllowed =
    isOwnMedia ||
    media?.isDownloadable !== false ||
    currentUser?.role === "Admin";

  let iframeSrc = absoluteUrl;
  if (absoluteUrl.includes("drive.google.com") && absoluteUrl.includes("/view")) {
    iframeSrc = absoluteUrl.replace(/\/view.*$/, "/preview");
  }

  // Editor Preferences State
  const [editorFontSize, setEditorFontSize] = useState(15);
  const [editorWordWrap, setEditorWordWrap] = useState("on");
  const [editorMinimap, setEditorMinimap] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState(fileInfo.lang);
  const [editorTheme, setEditorTheme] = useState(isDark ? "vs-dark" : "light");
  const [editorFontFamily, setEditorFontFamily] = useState(
    "Consolas, 'Courier New', monospace",
  );
  const [editorLineHeight, setEditorLineHeight] = useState(24);
  const [editorRenderWhitespace, setEditorRenderWhitespace] = useState("none");
  const [editorCursorBlinking, setEditorCursorBlinking] = useState("smooth");
  const [editorSmoothScrolling, setEditorSmoothScrolling] = useState(true);

  // UI State
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState("settings"); // 'settings', 'tools', 'info'
  const [viewMode, setViewMode] = useState("raw"); // 'raw', 'preview', 'split', 'grid'

  // Data State
  const [stats, setStats] = useState({ lines: 0, words: 0, chars: 0, size: 0 });
  const [csvData, setCsvData] = useState([]);
  const parseTimeout = useRef(null);
  const statsTimeout = useRef(null);

  // AI & Code Runner State
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [codeOutput, setCodeOutput] = useState("");
  const [executingCode, setExecutingCode] = useState(false);
  const [runtimeControls, setRuntimeControls] = useState({
    documentViewerFallbackEnabled: true,
    mobileSafeModeEnabled: true,
  });

  useEffect(() => {
    getPublicSystemSettings().then((s) =>
      setRuntimeControls({
        documentViewerFallbackEnabled:
          s.serviceControls?.documentViewerFallbackEnabled !== false,
        mobileSafeModeEnabled: s.serviceControls?.mobileSafeModeEnabled !== false,
      }),
    );
  }, []);

  useEffect(() => {
    if (fileInfo.lang) setEditorLanguage(fileInfo.lang);

    // Default view modes based on file type
    if (fileInfo.type === "markdown") setViewMode("split");
    else if (fileInfo.type === "csv") setViewMode("grid");
    else setViewMode("raw");
  }, [ext, fileInfo.lang, fileInfo.type]);

  useEffect(() => {
    if (isTextBased && url) {
      setLoading(true);
      fetchTextResource(url)
        .then((text) => {
          setContent(text);
          updateStats(text);
          if (fileInfo.type === "csv") {
            setCsvData(parseCSV(text));
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError(
            "Could not read document. It might be blocked by CORS policies or require authentication. Please open the link externally."
          );
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [url, isTextBased]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            if (isEditing) handleSave();
            break;
          case "p":
            e.preventDefault();
            handlePrint();
            break;
          case "f":
            // Let Monaco handle its own Find if focused, otherwise we could toggle a custom search
            break;
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, content]);

  const updateStats = (text) => {
    const lines = text.split(/\r\n|\r|\n/).length;
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const chars = text.length;
    const size = new Blob([text]).size;
    setStats({ lines, words, chars, size });
  };

  const handleContentChange = (val) => {
    const newText = val || "";
    setContent(newText);

    if (statsTimeout.current) clearTimeout(statsTimeout.current);
    statsTimeout.current = setTimeout(() => {
      updateStats(newText);
    }, 500);

    if (viewMode === "grid" && fileInfo.type === "csv") {
      if (parseTimeout.current) clearTimeout(parseTimeout.current);
      parseTimeout.current = setTimeout(() => {
        setCsvData(parseCSV(newText));
      }, 500);
    }
  };

  const handleEditorDidMount = (editor, monacoInstance) => {
    editorRef.current = editor;
  };

  const handleDownload = async () => {
    if (isEditing && isTextBased) {
      const blob = new Blob([content], { type: "text/plain" });
      downloadBlob(blob, title);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Downloaded successfully! 📥" }),
      );
    } else {
      await downloadMedia(url, title, fileInfo.type);
    }
  };

  const handleRunCode = async () => {
    setExecutingCode(true);
    setShowSidebar(true);
    setActiveSidebarTab("output");
    try {
      // Map Monaco languages to Piston API supported languages
      const langMap = {
        javascript: "javascript",
        typescript: "typescript",
        python: "python",
        java: "java",
        c: "c",
        cpp: "cpp",
        csharp: "csharp",
        go: "go",
        rust: "rust",
        ruby: "ruby",
        php: "php",
        shell: "bash",
      };
      const pLang = langMap[editorLanguage] || "python";

      const data = await runCodeOnPistonEmacs(pLang, content);
      setCodeOutput(data.run?.output || data.message || "No output generated.");
    } catch (err) {
      setCodeOutput("Error executing code: " + err.message);
    } finally {
      setExecutingCode(false);
    }
  };

  const handleAskAI = async () => {
    if (!aiInput.trim()) return;
    const newMessages = [...aiMessages, { role: "user", text: aiInput }];
    setAiMessages(newMessages);
    setAiInput("");
    setIsAiTyping(true);
    try {
      const docContext = content.substring(0, 25000); // 25k char limit for context
      const systemInstruction = `You are a highly intelligent tutor helping a student understand a document. Be concise and educational.\n\nDocument Context:\n---\n${docContext}\n---`;
      const response = await generateContent({ messages: newMessages, systemInstruction, contentType: "document_chat" });
      const responseText = response.generated_content || response;
      setAiMessages((prev) => [...prev, { role: "ai", text: responseText }]);
    } catch (e) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Error: I couldn't process this right now. Please try again.",
        },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handlePrint = () => {
    if (isPdf) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const printWindow = window.open("", "", "height=600,width=800");
    printWindow.document.write("<html><head><title>Print Document</title>");
    printWindow.document.write(
      "<style>body{font-family:monospace;white-space:pre-wrap;word-wrap:break-word;padding:20px;}</style>",
    );
    printWindow.document.write("</head><body>");
    printWindow.document.write(
      content.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    );
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  const handleSave = () => {
    if (onSave && canEdit) {
      onSave(content, title);
      setIsEditing(false);
      setShowSidebar(false);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Document saved! 💾" }),
      );
    } else {
      handleDownload();
      setIsEditing(false);
      setShowSidebar(false);
    }
  };

  // --- Text Manipulation Tools ---
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      handleContentChange(formatted);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "JSON Formatted ✅" }),
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Invalid JSON ❌" }),
      );
    }
  };

  const convertCase = (type) => {
    if (type === "upper") handleContentChange(content.toUpperCase());
    if (type === "lower") handleContentChange(content.toLowerCase());
  };

  const removeEmptyLines = () => {
    const cleaned = content.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "\n");
    handleContentChange(cleaned);
  };

  const sortLines = () => {
    const sorted = content.split("\n").sort().join("\n");
    handleContentChange(sorted);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    window.dispatchEvent(
      new CustomEvent("showToast", { detail: "Copied to clipboard 📋" }),
    );
  };

  const IconComponent = fileInfo.icon;

  // Delegate images, video, and audio directly to the advanced media modal
  if ((isImage || isVideo || isAudio || isEmbed) && url) {
    const mediaObj = {
      url,
      type: fileInfo.type,
      title,
      isDownloadable: true,
      ...(media || {})
    };
    if (!mediaObj.type) mediaObj.type = fileInfo.type;
    return (
      <FullscreenMediaModal
        media={mediaObj}
        onClose={onClose}
        currentUser={currentUser}
      />
    );
  }

  if (!url) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* --- TOP TOOLBAR --- */}
      <div
        className={`flex items-center justify-between p-3 border-b shadow-md ${getHeaderThemeClasses(appTheme)}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-lg shrink-0">
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold truncate text-sm md:text-base leading-tight">
              {title}
            </h3>
            <p className="text-[10px] md:text-xs opacity-70 uppercase tracking-widest font-mono">
              {fileInfo.name} {isEditing ? " • (Editing)" : " • (Read Only)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* View Mode Toggles (If applicable) */}
          {isTextBased && (
            <div className="hidden md:flex items-center bg-black/5 dark:bg-white/5 rounded-lg p-1 mr-2 border border-inherit/20">
              <button
                onClick={() => setViewMode("raw")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "raw" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                title="Raw Code View"
              >
                <FileCode2 className="w-4 h-4" />
              </button>
              {fileInfo.type === "markdown" && (
                <button
                  onClick={() => setViewMode("split")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "split" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                  title="Split Preview"
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                </button>
              )}
              {fileInfo.type === "csv" && (
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                  title="Data Grid View"
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Main Actions */}
          {isTextBased && (
            <>
              {fileInfo.type === "code" && (
                <button
                  onClick={handleRunCode}
                  disabled={executingCode}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
                  title="Run Code via Cloud Compiler"
                >
                  {executingCode ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span className="hidden sm:inline">Run</span>
                </button>
              )}
              {isEditing ? (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 sm:gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />{" "}
                  <span className="hidden sm:inline">
                    {canEdit && onSave ? "Save" : "Save to Device"}
                  </span>
                </button>
              ) : (
                (isDownloadAllowed || (canEdit && onSave)) && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                    title={
                      !canEdit || !onSave
                        ? "Edit locally for your own view/download"
                        : "Edit Document"
                    }
                  >
                    <Edit2 className="w-4 h-4" />{" "}
                    <span className="hidden sm:inline">
                      {!canEdit || !onSave ? "Local Edit" : "Edit"}
                    </span>
                  </button>
                )
              )}
            </>
          )}

          {isEditing && isTextBased && (
            <button
              onClick={() => {
                setShowSidebar(!showSidebar);
                setActiveSidebarTab("settings");
              }}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors opacity-80 hover:opacity-100 ${showSidebar && activeSidebarTab === "settings" ? "bg-black/10 dark:bg-white/10" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
              title="Editor Preferences"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          )}

          {isDownloadAllowed && (
            <>
              <button
                onClick={handlePrint}
                className="p-1.5 sm:p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors opacity-80 hover:opacity-100 hidden sm:block"
                title="Print Document"
              >
                <Printer className="w-5 h-5" />
              </button>

              <button
                onClick={handleDownload}
                className="p-1.5 sm:p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors opacity-80 hover:opacity-100"
                title="Download File"
              >
                <Download className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="w-px h-6 bg-inherit opacity-20 mx-1"></div>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors opacity-80 hover:opacity-100 ${showSidebar ? "bg-black/10 dark:bg-white/10 text-blue-500" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
            title="Toggle Sidebar"
          >
            {showSidebar ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeftOpen className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors opacity-80 hover:opacity-100"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* --- MAIN LAYOUT (Split Pane) --- */}
      <div className="flex-1 w-full relative overflow-hidden flex bg-[#1e1e1e]">
        {/* --- SIDEBAR PANEL --- */}
        {showSidebar && (
          <div
            className={`w-80 shrink-0 border-r shadow-2xl flex flex-col z-20 transition-colors animate-in slide-in-from-left-4 ${getPanelTheme(appTheme)}`}
          >
            <div className="flex border-b border-inherit/20 bg-black/5 dark:bg-white/5 p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden gap-1">
              <button
                onClick={() => setActiveSidebarTab("info")}
                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded transition-colors ${activeSidebarTab === "info" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
              >
                Info
              </button>
              {isTextBased && (
                <button
                  onClick={() => setActiveSidebarTab("ai")}
                  className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${activeSidebarTab === "ai" ? "bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                >
                  <Bot className="w-3 h-3" /> Ask AI
                </button>
              )}
              {fileInfo.type === "code" && (
                <button
                  onClick={() => setActiveSidebarTab("output")}
                  className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1.5 ${activeSidebarTab === "output" ? "bg-green-500/20 text-green-600 dark:text-green-400 shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                >
                  <TerminalSquare className="w-3 h-3" /> Output
                </button>
              )}
              {isTextBased && isEditing && (
                <>
                  <button
                    onClick={() => setActiveSidebarTab("tools")}
                    className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded transition-colors ${activeSidebarTab === "tools" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                  >
                    Tools
                  </button>
                  <button
                    onClick={() => setActiveSidebarTab("settings")}
                    className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded transition-colors ${activeSidebarTab === "settings" ? "bg-current text-black dark:text-white shadow-sm" : "opacity-60 hover:opacity-100 text-inherit"}`}
                  >
                    Settings
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full flex flex-col gap-5 text-inherit">
              {/* TAB: INFO */}
              {activeSidebarTab === "info" && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                  <div className="text-center pb-4 border-b border-inherit/20">
                    <IconComponent className="w-12 h-12 mx-auto mb-2 opacity-80" />
                    <h3 className="font-bold text-lg break-words">{title}</h3>
                    <p className="text-xs opacity-70 mt-1 uppercase tracking-wider">
                      {fileInfo.name}
                    </p>
                  </div>
                  {isTextBased && (
                    <div className="flex flex-col gap-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider opacity-60">
                        Document Stats
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/10 text-center">
                          <div className="text-xl font-bold">{stats.lines}</div>
                          <div className="text-[10px] opacity-70 uppercase tracking-widest">
                            Lines
                          </div>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/10 text-center">
                          <div className="text-xl font-bold">{stats.words}</div>
                          <div className="text-[10px] opacity-70 uppercase tracking-widest">
                            Words
                          </div>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/10 text-center">
                          <div className="text-xl font-bold">{stats.chars}</div>
                          <div className="text-[10px] opacity-70 uppercase tracking-widest">
                            Chars
                          </div>
                        </div>
                        <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/10 text-center">
                          <div className="text-xl font-bold">
                            {(stats.size / 1024).toFixed(1)}
                          </div>
                          <div className="text-[10px] opacity-70 uppercase tracking-widest">
                            KB Size
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-2 border-t border-inherit/20">
                    <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">
                      Actions
                    </h4>
                    {isDownloadAllowed && (
                      <>
                        <button
                          onClick={handleDownload}
                          className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                        >
                          <span>Download Original</span>
                          <Download className="w-4 h-4 opacity-70" />
                        </button>
                        {isTextBased && (
                          <button
                            onClick={copyToClipboard}
                            className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                          >
                            <span>Copy All Text</span>
                            <Copy className="w-4 h-4 opacity-70" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: ASK AI */}
              {activeSidebarTab === "ai" && (
                <div className="flex flex-col h-full animate-in fade-in">
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {aiMessages.length === 0 ? (
                      <div className="text-center opacity-60 mt-10 flex flex-col items-center">
                        <Bot className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm">
                          Ask me anything about this document! I have full
                          context of what you're reading.
                        </p>
                      </div>
                    ) : (
                      aiMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl text-sm shadow-sm ${msg.role === "user" ? "bg-black/10 dark:bg-white/10 ml-4 rounded-tr-sm" : "bg-purple-500/10 border border-purple-500/20 mr-4 rounded-tl-sm"}`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 block mb-1">
                            {msg.role === "user" ? "You" : "AI Tutor"}
                          </span>
                          <div className="prose prose-sm dark:prose-invert break-words max-w-none">
                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                          </div>
                        </div>
                      ))
                    )}
                    {isAiTyping && (
                      <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl rounded-tl-sm mr-4 w-fit">
                        <div
                          className="loader"
                          style={{
                            "--s": "10px",
                            "--g": "3px",
                            color: "#a855f7",
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 pt-2 border-t border-inherit/10">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                      placeholder="Ask a question..."
                      className="flex-1 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-inherit"
                    />
                    <button
                      onClick={handleAskAI}
                      disabled={isAiTyping || !aiInput.trim()}
                      className={`p-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: OUTPUT (Compiler) */}
              {activeSidebarTab === "output" && fileInfo.type === "code" && (
                <div className="flex flex-col h-full animate-in fade-in">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider opacity-60">
                      Terminal Output
                    </h4>
                    {executingCode && (
                      <RefreshCw className="w-3 h-3 animate-spin opacity-60" />
                    )}
                  </div>
                  <div className="flex-1 bg-[#1e1e1e] text-green-400 font-mono text-sm p-4 rounded-lg overflow-y-auto whitespace-pre-wrap shadow-inner border border-white/10 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {executingCode
                      ? "Executing code on remote server..."
                      : codeOutput || "Click 'Run' to execute code."}
                  </div>
                </div>
              )}

              {/* TAB: TOOLS */}
              {activeSidebarTab === "tools" && isTextBased && isEditing && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                  <div className="flex flex-col gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">
                      Code Formatting
                    </h4>
                    <button
                      onClick={() =>
                        editorRef.current
                          ?.getAction("editor.action.formatDocument")
                          ?.run()
                      }
                      className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                    >
                      <span>Format Document</span>
                      <Code2 className="w-4 h-4 opacity-70" />
                    </button>
                    {fileInfo.lang === "json" && (
                      <button
                        onClick={formatJSON}
                        className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                      >
                        <span>Prettify JSON</span>
                        <FileJson className="w-4 h-4 opacity-70" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-inherit/20">
                    <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">
                      Text Manipulation
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => convertCase("upper")}
                        className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors border border-inherit/10 flex flex-col items-center gap-1"
                      >
                        <Type className="w-4 h-4 opacity-70" />
                        UPPERCASE
                      </button>
                      <button
                        onClick={() => convertCase("lower")}
                        className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors border border-inherit/10 flex flex-col items-center gap-1"
                      >
                        <Type className="w-4 h-4 opacity-70" />
                        lowercase
                      </button>
                      <button
                        onClick={removeEmptyLines}
                        className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors border border-inherit/10 flex flex-col items-center gap-1 text-center"
                      >
                        <AlignLeft className="w-4 h-4 opacity-70" />
                        Trim Lines
                      </button>
                      <button
                        onClick={sortLines}
                        className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors border border-inherit/10 flex flex-col items-center gap-1 text-center"
                      >
                        <ListOrdered className="w-4 h-4 opacity-70" />
                        Sort A-Z
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-inherit/20">
                    <h4 className="font-bold text-xs uppercase tracking-wider opacity-60 mb-2">
                      Editor Actions
                    </h4>
                    <button
                      onClick={() =>
                        editorRef.current?.getAction("actions.find")?.run()
                      }
                      className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                    >
                      <span>Find & Replace (Ctrl+F)</span>
                      <Search className="w-4 h-4 opacity-70" />
                    </button>
                    <button
                      onClick={() =>
                        editorRef.current
                          ?.getAction("editor.action.commandPalette")
                          ?.run()
                      }
                      className="w-full flex items-center justify-between p-2.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-colors border border-inherit/10"
                    >
                      <span>Command Palette (F1)</span>
                      <Terminal className="w-4 h-4 opacity-70" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS */}
              {activeSidebarTab === "settings" && isTextBased && isEditing && (
                <div className="flex flex-col gap-5 animate-in fade-in">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs opacity-80 font-bold uppercase tracking-wider">
                      Syntax Highlighting
                    </label>
                    <select
                      value={editorLanguage}
                      onChange={(e) => setEditorLanguage(e.target.value)}
                      className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-current font-medium text-inherit"
                    >
                      <option
                        value="plaintext"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Plain Text
                      </option>
                      <option
                        value="javascript"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        JavaScript / JSX
                      </option>
                      <option
                        value="typescript"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        TypeScript
                      </option>
                      <option
                        value="python"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Python
                      </option>
                      <option
                        value="json"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        JSON
                      </option>
                      <option
                        value="html"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        HTML
                      </option>
                      <option
                        value="css"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        CSS / SCSS
                      </option>
                      <option
                        value="markdown"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Markdown
                      </option>
                      <option
                        value="c"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        C
                      </option>
                      <option
                        value="cpp"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        C++
                      </option>
                      <option
                        value="java"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Java
                      </option>
                      <option
                        value="go"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Go
                      </option>
                      <option
                        value="rust"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Rust
                      </option>
                      <option
                        value="php"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        PHP
                      </option>
                      <option
                        value="sql"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        SQL
                      </option>
                      <option
                        value="xml"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        XML
                      </option>
                      <option
                        value="yaml"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        YAML
                      </option>
                      <option
                        value="shell"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Shell Script
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs opacity-80 font-bold uppercase tracking-wider">
                      Editor Theme
                    </label>
                    <select
                      value={editorTheme}
                      onChange={(e) => setEditorTheme(e.target.value)}
                      className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-current font-medium text-inherit"
                    >
                      <option
                        value="vs-dark"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Dark+ (Default Dark)
                      </option>
                      <option
                        value="light"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Light+ (Default Light)
                      </option>
                      <option
                        value="hc-black"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        High Contrast Black
                      </option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-inherit/20 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs opacity-80 font-bold">
                          Font Size
                        </label>
                        <span className="text-[10px] font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {editorFontSize}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="30"
                        value={editorFontSize}
                        onChange={(e) =>
                          setEditorFontSize(Number(e.target.value))
                        }
                        className="accent-current cursor-pointer h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs opacity-80 font-bold">
                          Line Height
                        </label>
                        <span className="text-[10px] font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {editorLineHeight}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="18"
                        max="40"
                        value={editorLineHeight}
                        onChange={(e) =>
                          setEditorLineHeight(Number(e.target.value))
                        }
                        className="accent-current cursor-pointer h-1.5 bg-black/10 dark:bg-white/10 rounded-lg appearance-none"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-inherit/20 flex flex-col gap-3">
                    <label className="flex justify-between items-center cursor-pointer group">
                      <span className="text-sm font-semibold opacity-90 group-hover:opacity-100 transition-opacity">
                        Word Wrap
                      </span>
                      <input
                        type="checkbox"
                        checked={editorWordWrap === "on"}
                        onChange={(e) =>
                          setEditorWordWrap(e.target.checked ? "on" : "off")
                        }
                        className="w-4 h-4 accent-current cursor-pointer"
                      />
                    </label>
                    <label className="flex justify-between items-center cursor-pointer group">
                      <span className="text-sm font-semibold opacity-90 group-hover:opacity-100 transition-opacity">
                        Minimap
                      </span>
                      <input
                        type="checkbox"
                        checked={editorMinimap}
                        onChange={(e) => setEditorMinimap(e.target.checked)}
                        className="w-4 h-4 accent-current cursor-pointer"
                      />
                    </label>
                    <label className="flex justify-between items-center cursor-pointer group">
                      <span className="text-sm font-semibold opacity-90 group-hover:opacity-100 transition-opacity">
                        Smooth Scrolling
                      </span>
                      <input
                        type="checkbox"
                        checked={editorSmoothScrolling}
                        onChange={(e) =>
                          setEditorSmoothScrolling(e.target.checked)
                        }
                        className="w-4 h-4 accent-current cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="pt-3 border-t border-inherit/20 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs opacity-80 font-bold uppercase tracking-wider">
                        Render Whitespace
                      </label>
                      <select
                        value={editorRenderWhitespace}
                        onChange={(e) =>
                          setEditorRenderWhitespace(e.target.value)
                        }
                        className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-current font-medium text-inherit"
                      >
                        <option
                          value="none"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          None
                        </option>
                        <option
                          value="boundary"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Boundary
                        </option>
                        <option
                          value="selection"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Selection
                        </option>
                        <option
                          value="all"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          All
                        </option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs opacity-80 font-bold uppercase tracking-wider">
                        Cursor Blinking
                      </label>
                      <select
                        value={editorCursorBlinking}
                        onChange={(e) =>
                          setEditorCursorBlinking(e.target.value)
                        }
                        className="bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-current font-medium text-inherit"
                      >
                        <option
                          value="blink"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Blink
                        </option>
                        <option
                          value="smooth"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Smooth
                        </option>
                        <option
                          value="phase"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Phase
                        </option>
                        <option
                          value="expand"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Expand
                        </option>
                        <option
                          value="solid"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Solid
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- DYNAMIC RENDERER AREA --- */}
        <div className="flex-1 w-full relative overflow-hidden flex flex-col bg-[#1e1e1e]">
          {loading ? (
            <div className="flex flex-col items-center justify-center text-white/70">
              <div
                className="loader mb-4"
                style={{ "--s": "20px", "--g": "4px" }}
              ></div>
              <p>Processing Document...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center text-red-400 max-w-md text-center p-6 bg-red-900/20 border border-red-900/50 rounded-2xl">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p className="font-bold mb-2">Access Denied</p>
              <p className="text-sm opacity-80">{error}</p>
              {runtimeControls.documentViewerFallbackEnabled && (
                <button
                  onClick={() =>
                    window.open(url, "_blank", "noopener,noreferrer")
                  }
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-bold transition-colors text-white flex items-center gap-2"
                >
                Open in New Tab <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 w-full h-full flex relative">
                {/* MONACO CODE EDITOR (Always rendered for text/code, but visibility controlled by viewMode) */}
                {isTextBased && (
                  <div
                    className={`h-full border-r border-[#333] transition-all duration-300 ${viewMode === "raw" ? "w-full" : viewMode === "split" ? "w-1/2" : "hidden"}`}
                  >
                    <Editor
                      height="100%"
                      width="100%"
                      language={editorLanguage}
                      theme={editorTheme}
                      value={content}
                      onChange={handleContentChange}
                      onMount={handleEditorDidMount}
                      options={{
                        readOnly: !isEditing,
                        minimap: { enabled: runtimeControls.mobileSafeModeEnabled ? false : editorMinimap },
                        fontSize: editorFontSize,
                        fontFamily: editorFontFamily,
                        lineHeight: editorLineHeight,
                        padding: { top: 20, bottom: 20 },
                        wordWrap: editorWordWrap,
                        scrollBeyondLastLine: false,
                        cursorBlinking: editorCursorBlinking,
                        smoothScrolling: editorSmoothScrolling,
                        renderWhitespace: editorRenderWhitespace,
                        formatOnPaste: true,
                        automaticLayout: true,
                        bracketPairColorization: { enabled: true },
                        folding: true,
                      }}
                    />
                  </div>
                )}

                {/* MARKDOWN LIVE PREVIEW */}
                {fileInfo.type === "markdown" && viewMode === "split" && (
                  <div className="w-1/2 h-full bg-white dark:bg-gray-900 overflow-y-auto p-6 md:p-10 text-gray-900 dark:text-gray-100 prose prose-sm md:prose-base dark:prose-invert max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}

                {/* CSV DATA GRID PREVIEW */}
                {fileInfo.type === "csv" && viewMode === "grid" && (
                  <div className="w-full h-full bg-white dark:bg-gray-900 overflow-auto p-4">
                    {csvData.length > 0 ? (
                      <table className="w-full text-sm text-left border-collapse border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden">
                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 sticky top-0 shadow-sm z-10">
                          <tr>
                            {csvData[0].map((header, idx) => (
                              <th
                                key={idx}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-700 font-bold whitespace-nowrap"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(1).map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-gray-700 dark:text-gray-300"
                            >
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className="px-4 py-1.5 border border-gray-200 dark:border-gray-700 truncate max-w-[300px]"
                                  title={cell}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-500">
                        No tabular data found or invalid CSV format.
                      </div>
                    )}
                  </div>
                )}

                {/* NATIVE PDF / OFFICE VIEWERS */}
                {!isTextBased && (
                  <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e]">
                    {isPdf ? (
                      <iframe
                        src={iframeSrc}
                        className="w-full h-full border-none bg-white"
                        title={title}
                      />
                    ) : isOffice ? (
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`}
                        className="w-full h-full border-none bg-white"
                        title={title}
                      />
                    ) : fileInfo.type === "embed" ? (
                      <iframe
                        src={iframeSrc}
                        className="w-full h-full border-none bg-white"
                        title={title}
                        allow="autoplay; encrypted-media; fullscreen"
                      />
                    ) : isArchive ? (
                      <div className="flex flex-col items-center justify-center text-white p-8 max-w-lg text-center bg-black/40 rounded-2xl border border-white/10 shadow-2xl">
                        <FileArchive className="w-20 h-20 opacity-60 mb-5 text-blue-400" />
                        <h2 className="text-2xl font-bold mb-3">
                          Compressed Archive
                        </h2>
                        <p className="opacity-80 text-sm mb-6 leading-relaxed">
                          This is a compressed <b>.{ext}</b> file containing
                          multiple files or folders. Web browsers cannot
                          securely extract archives directly in memory.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {isDownloadAllowed ? (
                            <button
                              onClick={handleDownload}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
                            >
                              <Download className="w-5 h-5" /> Download Archive
                            </button>
                          ) : (
                            <p className="text-red-400 font-bold bg-red-400/10 px-4 py-3 rounded-xl border border-red-400/20 shadow-sm flex items-center justify-center">
                              Downloads Disabled
                            </p>
                          )}
                          <button
                            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                          >
                            <ExternalLink className="w-5 h-5" /> Open Externally
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-white p-8 max-w-lg text-center bg-black/40 rounded-2xl border border-white/10 shadow-2xl">
                        <File className="w-20 h-20 opacity-40 mb-5 text-gray-400" />
                        <h2 className="text-2xl font-bold mb-3">
                          Unsupported Format
                        </h2>
                        <p className="opacity-80 text-sm mb-6 leading-relaxed">
                          Native browser preview for <b>.{ext}</b> files is not
                          supported by the embedded document engine.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          {isDownloadAllowed ? (
                            <button
                              onClick={handleDownload}
                              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
                            >
                              <Download className="w-5 h-5" /> Download File
                            </button>
                          ) : (
                            <p className="text-red-400 font-bold bg-red-400/10 px-4 py-3 rounded-xl border border-red-400/20 shadow-sm flex items-center justify-center">
                              Downloads Disabled
                            </p>
                          )}
                          <button
                            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-transform active:scale-95 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                          >
                            <ExternalLink className="w-5 h-5" /> Open Externally
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* --- BOTTOM STATUS BAR --- */}
              {isTextBased && (
                <div className="h-6 shrink-0 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] font-mono select-none z-10 w-full shadow-inner">
                  <div className="flex items-center gap-4">
                    <span
                      className="flex items-center gap-1 opacity-90 hover:bg-white/20 px-1 cursor-pointer transition-colors"
                      title="Language Mode"
                    >
                      <Code2 className="w-3 h-3" />{" "}
                      {editorLanguage.toUpperCase()}
                    </span>
                    <span
                      className="flex items-center gap-1 opacity-90 hover:bg-white/20 px-1 cursor-pointer transition-colors"
                      title={isEditing ? "Editing Enabled" : "Read-Only Mode"}
                    >
                      {isEditing ? (
                        <Edit2 className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}{" "}
                      {isEditing ? "EDIT" : "READ"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 opacity-90">
                    <span title="Total Lines">Ln: {stats.lines}</span>
                    <span title="Total Words">Wd: {stats.words}</span>
                    <span title="Total Characters">Ch: {stats.chars}</span>
                    <span title="File Size">
                      {(stats.size / 1024).toFixed(1)} KB
                    </span>
                    <span className="hover:bg-white/20 px-1 cursor-pointer transition-colors">
                      UTF-8
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DocumentViewer;
