import React, { useEffect, useState } from "react";
import {
  Play,
  Code2,
  Terminal,
  AlertCircle,
  RefreshCw,
  Keyboard,
  Download,
  Key,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { useSelector } from "react-redux";
import { useTheme } from "@/context/ThemeContext";
import { getDepartmentHODKeys, updateUserProfile } from "@/services/userService";
import axios from 'axios';
import { compileCode } from "@/services/compilerService";
import { canConfigureCodeCompiler } from "@/utils/roleUtils";
import { getBannerThemeClasses, getCardThemeClasses, getOptionClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const LANGUAGES = [
  {
    id: "javascript",
    name: "JavaScript (Node.js)",
    version: "18.15.0",
    defaultCode: 'console.log("Hello, World!");',
  },
  {
    id: "python",
    name: "Python",
    version: "3.10.0",
    defaultCode: 'print("Hello, World!")',
  },
  {
    id: "java",
    name: "Java",
    version: "15.0.2",
    defaultCode:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  },
  {
    id: "cpp",
    name: "C++",
    version: "10.2.0",
    defaultCode:
      '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  },
  {
    id: "c",
    name: "C",
    version: "10.2.0",
    defaultCode:
      '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  },
];

const CodeCompiler = () => {
  const user = useSelector((state) => state.auth.user);
  const { appTheme, isDark } = useTheme();
  const canConfigure = canConfigureCodeCompiler(user?.role);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].defaultCode);
  const [output, setOutput] = useState("");
  const [stdin, setStdin] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const fetchKeys = async () => {
      const deptIdentifier = user?.department?.name || user?.department;
      if (deptIdentifier) {
        try {
          const data = await getDepartmentHODKeys(deptIdentifier);
          if (data.rapidApiKey) {
            setApiKey(data.rapidApiKey);
          }
        } catch (err) {
          console.error("Failed to fetch department API keys", err);
        }
      }
    };
    fetchKeys();
  }, [user]);

  const handleSaveKey = async (key) => {
    setApiKey(key);
    if (canConfigure) {
      try {
        await updateUserProfile(user._id, { rapidApiKey: key });
      } catch (err) {
        console.error("Failed to save RapidAPI key", err);
      }
    }
  };

  const handleLanguageChange = (e) => {
    const selected = LANGUAGES.find((l) => l.id === e.target.value);
    setLanguage(selected);
    setCode(selected.defaultCode);
    setOutput("");
    setError("");
  };

  // Map our language IDs to Judge0 expected language IDs
  const getJudge0LanguageId = (langId) => {
    switch (langId) {
      case "javascript":
        return 63;
      case "python":
        return 71;
      case "java":
        return 62;
      case "cpp":
        return 54;
      case "c":
        return 50;
      default:
        return 63;
    }
  };

  // Map our language IDs to Codex API expected names
  const runCode = async () => {
    if (!code.trim()) return;
    setIsRunning(true);
    setError("");
    setOutput("Running code...");
    try {
      const result = await compileCode(language.id, code, stdin, apiKey);
      // Handle Wandbox response format + Java stdout
      const stdout = result.stdout || result.program_output || result.output || '';
      const stderr = result.stderr || result.program_stderr || '';
      setOutput(stdout || 'No output');
      if (stderr) setError(stderr);
      else window.dispatchEvent(new CustomEvent("showToast", { detail: "Code executed successfully! 🚀" }));
    } catch (err) {
      console.error('Compiler error:', err);
      setError(err.message || 'Compilation failed');
      setOutput('');
    }
    setIsRunning(false);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    let ext = "txt";
    if (language.id === "javascript") ext = "js";
    else if (language.id === "python") ext = "py";
    else if (language.id === "java") ext = "java";
    else if (language.id === "cpp") ext = "cpp";
    else if (language.id === "c") ext = "c";

    a.download = `main.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-gray-800 to-gray-900 text-white")} rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors`}>
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            <Code2 className="w-8 h-8 text-blue-400" />
            Code Compiler
            {apiKey ? (
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-500/20 text-green-100 border border-green-500/30 rounded-full font-medium items-center gap-1.5 tracking-wide uppercase hidden sm:flex">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>{" "}
                Premium
              </span>
            ) : (
              <span className="ml-2 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-100 border border-orange-500/30 rounded-full font-medium items-center gap-1.5 tracking-wide uppercase hidden sm:flex">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>{" "}
                Free Fallback
              </span>
            )}
          </h1>
          <p className="text-gray-300 mt-2 text-sm sm:text-base md:text-lg font-medium max-w-xl">
            Write, compile, and execute code in multiple languages directly from
            your browser.
          </p>
        </div>
        {canConfigure && (
          <form onSubmit={(e) => e.preventDefault()} className="w-full md:w-auto flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/30 transition-colors">
            <label className="text-xs font-semibold opacity-70 text-inherit uppercase tracking-wider">
              RapidAPI Key (Judge0)
            </label>
            <div className="flex relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 text-inherit" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={(e) => handleSaveKey(e.target.value)}
                placeholder="Paste API Key here..."
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                autoComplete="new-password"
                className="w-full md:w-64 pl-9 pr-3 py-2 bg-black/10 dark:bg-white/10 border border-inherit/50 rounded-lg text-sm focus:outline-none focus:border-current text-inherit select-none transition-colors"
              />
            </div>
            <p className="text-[10px] opacity-50 text-inherit">
              Auto-saves on blur. Shared with your department.
            </p>
          </form>
        )}
      </div>

      {!apiKey && !canConfigure && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-orange-600 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Premium Compiler Offline</p>
            <p className="text-sm mt-1">
              Your HOD hasn't set a Premium API key. The compiler is currently
              using slower, free public servers. Some executions might fail
              during high traffic.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Section */}
        <div className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[400px] lg:h-[600px] transition-colors`}>
          <div className="p-3 sm:p-4 border-b border-inherit/30 bg-black/5 dark:bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
              <select
                value={language.id}
                onChange={handleLanguageChange}
                className="flex-1 sm:flex-none bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit py-2 px-3 sm:px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-current font-medium cursor-pointer shadow-sm text-sm"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id} className={getOptionClasses(appTheme, isDark)}>
                    {lang.name}
                  </option>
                ))}
              </select>

              <button
                onClick={downloadCode}
                className="flex items-center gap-1.5 text-inherit opacity-70 hover:opacity-100 hover:text-blue-500 transition-colors font-medium text-sm p-2"
                title="Download Source Code"
              >
                <Download className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>

            <button
              onClick={runCode}
              disabled={isRunning}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
            >
              {isRunning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              {isRunning ? "Running..." : "Run Code"}
            </button>
          </div>
          <div className="flex-1 bg-[#1e1e1e]">
            <Editor
              height="100%"
              language={language.id}
                theme={isDark ? "vs-dark" : "light"}
              value={code}
              onChange={(value) => setCode(value || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        {/* Output Section */}
        <div className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[400px] lg:h-[600px] transition-colors`}>
          <div className="p-4 border-b border-inherit/30 bg-black/5 dark:bg-white/5 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-inherit opacity-70" />
            <h3 className="font-bold text-inherit">Console Output</h3>
          </div>

          {/* Standard Input Section */}
          <div className="h-1/3 border-b border-gray-700 flex flex-col bg-[#1e1e1e]">
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 flex items-center gap-2 border-b border-gray-800">
              <Keyboard className="w-3 h-3" /> Standard Input (stdin)
            </div>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              className="flex-1 w-full bg-transparent text-gray-300 font-mono text-sm resize-none focus:outline-none p-4"
              spellCheck="false"
              placeholder="Enter program input here..."
            />
          </div>

          {/* Standard Output Section */}
          <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 flex items-center gap-2 border-b border-gray-800">
              <Terminal className="w-3 h-3" /> Standard Output (stdout)
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <pre
                className={`font-mono text-sm whitespace-pre-wrap break-words ${output.includes("error") || output.includes("Exception") ? "text-red-400" : "text-gray-300"}`}
              >
                {output || "Output will appear here..."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeCompiler;
