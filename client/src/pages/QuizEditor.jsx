import React, { useState, useEffect, useCallback } from "react";

import { getQuizById, updateQuiz, createQuiz } from "@/services/quizService";
import { getTeacherOverview, getAllQuizStats } from "@/services/statsService";
import { getAllSubjects } from "@/services/subjectService";
import { getRoleSubjects } from "@/utils/roleUtils";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Plus,
  Trash2,
  Save,
  Pen,
  Clock,
  Shuffle,
  Upload,
  FileDown,
  RefreshCcw,
  RefreshCw,
  FileQuestion,
  Sparkles,
} from "lucide-react";
import { useSelector } from "react-redux";
import EmptyState from "@/components/ui/EmptyState";
import AIQuizGenerator from "@/components/ui/AIQuizGenerator";
import ErrorAlert from "@/components/ui/ErrorAlert";
import SuccessAlert from "@/components/ui/SuccessAlert";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses, getBannerThemeClasses, getOptionClasses } from "@/utils/themeUtils";

const getNewQuestion = () => ({
  question: "",
  options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
  correctAnswer: null,
});

const QuizEditor = () => {
  const [searchParams] = useSearchParams();
  const { appTheme, isDark } = useTheme();
  const [selectedQuizId, setSelectedQuizId] = useState("");

  const [quizStats, setQuizStats] = useState([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const user = useSelector((state) => state.auth.user);
  const loadStats = useCallback(async () => {
    if (!user) return;
    let res;
    try {
      if (user.role === "Teacher") {
        res = await getTeacherOverview();
      } else if (user.role === "HOD" || user.role === "Admin") {
        res = await getAllQuizStats();
      }
      if (res) {
        setQuizStats(res.quizStats || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load existing quizzes.");
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const getExistingQuiz = useCallback(
    async (id) => {
      setError("");
      setSuccess("");

      if (id) {
        try {
          const quiz = await getQuizById(id);

          setQuizTitle(quiz.title || "");
          setSubject(quiz.subject || "");
          setShuffleQuestions(quiz.shuffle || null);
          setIsActive(quiz.isActive !== false); // Default to true if undefined
          setQuestions(quiz.questions || []);

          if (quiz.startDate) {
            const date = new Date(quiz.startDate);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = (date.getMonth() + 1).toString().padStart(2, "0");
              const day = date.getDate().toString().padStart(2, "0");
              const hours = date.getHours().toString().padStart(2, "0");
              const minutes = date.getMinutes().toString().padStart(2, "0");
              setStartDate(`${year}-${month}-${day}T${hours}:${minutes}`);
            } else {
              setStartDate("");
            }
          } else {
            setStartDate("");
          }
        } catch (err) {
          console.error("Error fetching quiz:", err);
          setError("Failed to load the selected quiz.");
          setSelectedQuizId("");
          setQuizTitle("");
          setShuffleQuestions("");
          setSubject("");
          setIsActive(true);
          setStartDate("");
          setQuestions([]);
        }
      } else {
        setShuffleQuestions(null);
        setStartDate("");
        setSubject("");
        setQuizTitle("");
        setIsActive(true);
        setQuestions([getNewQuestion()]);
      }
    },
    [],
  );

  const navigate = useNavigate();
  useEffect(() => {
    const quizIdFromUrl = searchParams.get("id");
    const fromAi = searchParams.get("fromAi");

    if (quizIdFromUrl) {
      setSelectedQuizId(quizIdFromUrl);
      getExistingQuiz(quizIdFromUrl);
    } else if (fromAi === "true") {
      const aiQuizStr = sessionStorage.getItem("aiGeneratedQuiz");
      if (aiQuizStr) {
        try {
          const aiQuiz = JSON.parse(aiQuizStr);
          setQuizTitle(aiQuiz.title || "");
          if (aiQuiz.questions && Array.isArray(aiQuiz.questions)) {
            const safeQuestions = aiQuiz.questions.map((q) => {
              const opts = Array.isArray(q.options) ? q.options : [];
              const paddedOpts = Array(4)
                .fill({ text: "" })
                .map((def, i) => {
                  if (opts[i] && typeof opts[i].text === "string")
                    return { text: opts[i].text };
                  if (typeof opts[i] === "string") return { text: opts[i] };
                  return def;
                });
              return {
                question: q.question || "",
                options: paddedOpts,
                correctAnswer:
                  typeof q.correctAnswer === "number" &&
                  q.correctAnswer >= 0 &&
                  q.correctAnswer <= 3
                    ? q.correctAnswer
                    : 0,
              };
            });
            setQuestions(safeQuestions);
          } else {
            setQuestions([getNewQuestion()]);
          }
        } catch (e) {
          console.error("Failed to parse AI quiz", e);
          setQuestions([getNewQuestion()]);
        }
      }
    } else {
      setQuestions([getNewQuestion()]);
    }
  }, [searchParams, getExistingQuiz]);

  // Add new question
  const addQuestion = () => {
    setQuestions([...questions, getNewQuestion()]);
  };

  // Remove question
  const removeQuestion = (index) => {
    if (questions.length > 1) {
      const newQuestions = questions.filter((_, i) => i !== index);
      setQuestions(newQuestions);
      if (
        shuffleQuestions !== null &&
        Number(shuffleQuestions) > newQuestions.length
      ) {
        setShuffleQuestions(newQuestions.length);
      }
    }
  };

  // Clear all questions
  const clearAllQuestions = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all questions? This action cannot be undone.",
      )
    ) {
      setQuestions([]);
      setShuffleQuestions(null);
    }
  };

  const handleQuestionsGenerated = (aiQuestions) => {
    const safeQuestions = aiQuestions.map((q) => ({
      question: q.question || "",
      options: (Array.isArray(q.options) ? q.options : []).map((opt) => ({
        // ✅ Handle both string and { text } formats from AI
        text: typeof opt === "string" ? opt : (opt?.text ?? ""),
      })),
      correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
    }));
    
    const append = window.confirm(`Add ${safeQuestions.length} AI questions to the existing ${questions.length} questions?`);
    if (append) {
      setQuestions((prev) => [...prev, ...safeQuestions]);
    } else {
      setQuestions(safeQuestions);
    }
  };

  // Download CSV Template
  const downloadTemplate = () => {
    const template =
      "Question,Option 1,Option 2,Option 3,Option 4,Correct Answer (1-4)\nWhat is the capital of France?,Berlin,Madrid,Paris,Rome,3\nWhich planet is known as the Red Planet?,Earth,Mars,Jupiter,Saturn,2";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "SocioFest_Quiz_Template.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      window.URL.revokeObjectURL(url);
    }
  };

  // Export Quiz to CSV
  const exportToCSV = () => {
    const header = [
      "Question",
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4",
      "Correct Answer (1-4)",
    ];
    const escapeCSV = (str) => {
      if (str == null) return "";
      const s = String(str);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = questions.map((q) => {
      const row = [
        q.question,
        q.options[0]?.text,
        q.options[1]?.text,
        q.options[2]?.text,
        q.options[3]?.text,
        q.correctAnswer !== null ? q.correctAnswer + 1 : "",
      ];
      return row.map(escapeCSV).join(",");
    });

    const csvContent = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = quizTitle
        ? `${quizTitle.replace(/\s+/g, "_")}_Export.csv`
        : "Quiz_Export.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      window.URL.revokeObjectURL(url);
    }
  };

  // Handle CSV Import
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split(/\r?\n/).filter((line) => line.trim());
      const parsedQuestions = [];

      // Simple CSV parser that supports quotes
      const parseRow = (str) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
          if (str[i] === '"') {
            inQuotes = !inQuotes;
          } else if (str[i] === "," && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ""));
            current = "";
          } else {
            current += str[i];
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ""));
        return result;
      };

      // Start from 1 to skip header row
      for (let i = 1; i < rows.length; i++) {
        const cols = parseRow(rows[i]);
        if (cols.length >= 2) {
          const rawCorrect = cols.length >= 6 ? cols[5] : cols[cols.length - 1];
          const correctIdx = parseInt(rawCorrect, 10) - 1;
          parsedQuestions.push({
            question: cols[0] || "",
            options: [
              { text: cols[1] || "" },
              { text: cols[2] || "" },
              { text: cols[3] || "" },
              { text: cols[4] || "" },
            ],
            correctAnswer:
              isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3
                ? null
                : correctIdx,
          });
        }
      }

      if (parsedQuestions.length > 0) {
        setQuestions((prev) => {
          // Filter out the initial empty question block if nothing was typed in it
          const filtered = prev.filter(
            (q) =>
              q.question.trim() !== "" ||
              q.options.some((o) => o.text.trim() !== ""),
          );
          return [...filtered, ...parsedQuestions];
        });
        setSuccess(
          `Imported ${parsedQuestions.length} questions successfully!`,
        );
        window.dispatchEvent(new CustomEvent("showToast", { detail: `Imported ${parsedQuestions.length} questions! 📥` }));
        if (shuffleQuestions !== null) {
          setShuffleQuestions((prev) => {
            const current = Number(prev);
            return isNaN(current) ? null : current + parsedQuestions.length;
          });
        }
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(
          "Could not parse any questions. Please check your CSV format.",
        );
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to parse CSV. Check format. ❌" }));
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input so the same file can be uploaded again if needed
  };

  // Update question text
  const handleQuestionChange = (index, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], question: value };
    setQuestions(updated);
  };

  // Update individual options
  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options];
    newOptions[optIndex] = { ...newOptions[optIndex], text: value };
    updated[qIndex] = { ...updated[qIndex], options: newOptions };
    setQuestions(updated);
  };

  // Select correct answer
  const handleAnswerSelect = (qIndex, optIndex) => {
    const updated = [...questions];
    updated[qIndex] = { ...updated[qIndex], correctAnswer: optIndex };
    setQuestions(updated);
  };

  // Save Quiz to backend
  const saveQuiz = async () => {
    if (!quizTitle.trim()) {
      setError("Please enter a quiz title.");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }
    if (questions.length === 0) {
      setError("Please add at least one question.");
      return;
    }

    const parsedShuffle = Number(shuffleQuestions);
    if (
      shuffleQuestions !== null &&
      (isNaN(parsedShuffle) ||
        parsedShuffle < 1 ||
        parsedShuffle > questions.length)
    ) {
      setError(`Shuffle questions must be between 1 and ${questions.length}.`);
      return;
    }
    if (!startDate) {
      setError("Please set a start date and time for the quiz.");
      return;
    }
    if (
      questions.some(
        (q) =>
          !q.question.trim() ||
          q.options.some((opt) => !opt.text.trim()) ||
          q.correctAnswer === null,
      )
    ) {
      setError(
        "Please fill in all questions, options, and select a correct answer for each.",
      );
      (document.getElementById("main-scroll-container") || window).scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    const selectedSubjObj = subjects.find(
      (s) => (s.name || s.subject) === subject,
    );
    const department =
      user?.role === "Admin"
        ? selectedSubjObj?.department?._id || selectedSubjObj?.department
            : user?.department?._id ||
              (typeof user?.department === "string" ? user.department : null);

        if (!department || typeof department === "object") {
      setError(
            "Unable to determine department ID. Ensure your profile has a department assigned."
      );
          setSaving(false);
      return;
    }

    try {
      const payload = {
        title: quizTitle.trim(),
        subject,
        shuffle: shuffleQuestions !== null ? parsedShuffle : 0,
        department,
        isActive,
        startDate: startDate,
        questions: questions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((opt) => ({
            text: opt.text.trim(),
          })),
          correctAnswer: Number(q.correctAnswer),
        })),
      };

      if (!selectedQuizId) {
        await createQuiz(payload);
        setSuccess("Created");
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Quiz created successfully! 🎉" }));
      } else {
        await updateQuiz(selectedQuizId, payload);
        setSuccess("Updated");
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Quiz updated successfully! ✏️" }));
        setSelectedQuizId("");
        if (searchParams.get("id")) {
          navigate("/teacher/quiz-editor", { replace: true });
        }
      }
      setShuffleQuestions(null);
      setQuizTitle("");
      setSubject("");
      setIsActive(true);
      setStartDate("");
      setQuestions([getNewQuestion()]);
      await loadStats();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to save quiz. Please try again.";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjectsList = await getRoleSubjects(user.role, user);
        setSubjects(Array.isArray(subjectsList) ? subjectsList : subjectsList?.subjects || []);
      } catch (err) {
        console.error("Failed to load subjects:", err);
        setSubjects([]);
      }
    };
    if (user) loadSubjects();
  }, [user]);

  const isDetailsFilled = quizTitle.trim() && subject && startDate;
  const hasQuestions =
    questions.length > 1 ||
    (questions.length === 1 && questions[0].question.trim() !== "");

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 p-4 sm:p-6">
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-pink-500 to-rose-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <FileQuestion className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            Quiz Editor
          </h1>
          <p className="text-pink-100 mt-2 text-base md:text-lg font-medium max-w-xl">
            Create and manage quizzes for your students.
          </p>
        </div>
        <button
          onClick={() => setShowAIGenerator(true)}
          title={
            hasQuestions
                ? "Regenerate questions with AI"
                : "Generate questions with AI"
          }
          className={`relative z-10 rounded-xl px-5 py-3 border border-inherit/30 text-inherit bg-black/5 dark:bg-white/5 transition-all flex items-center justify-center gap-2 shadow-sm group shrink-0 w-full sm:w-auto hover:bg-black/10 dark:hover:bg-white/10`}
        >
          {hasQuestions ? (
            <RefreshCw
              className={`w-5 h-5 ${!isDetailsFilled ? "" : "group-hover:rotate-180 transition-transform duration-500"}`}
            />
          ) : (
            <Sparkles
              className={`w-5 h-5 ${!isDetailsFilled ? "" : "group-hover:rotate-12 transition-transform"}`}
            />
          )}
          <span className="font-bold">
            {hasQuestions ? "Regenerate with AI" : "Generate with AI"}
          </span>
        </button>
      </div>

      <SuccessAlert message={success ? `Quiz ${success} successfully!` : ""} />
      <ErrorAlert message={error} />

      {quizStats.length > 0 && (
        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-xl shadow-sm border border-inherit/30 backdrop-blur-sm transition-colors">
          <h3 className="text-lg font-bold text-inherit mb-4 flex items-center gap-2">
            <Pen className="w-5 h-5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10" /> Load & Edit Quiz
          </h3>
          <div>
            <select
              value={selectedQuizId || ""}
              onChange={(e) => {
                const quizId = e.target.value;
                setSelectedQuizId(quizId);
                getExistingQuiz(quizId);
              }}
              className="w-full border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" className={getOptionClasses(appTheme, isDark)}>Creating a New Quiz ...</option>
              {selectedQuizId &&
                !quizStats.some((q) => q.quizId === selectedQuizId) && (
                  <option value={selectedQuizId} className={getOptionClasses(appTheme, isDark)}>
                    {quizTitle || "Editing Selected Quiz..."}
                  </option>
                )}
              {quizStats.map((q, idx) => (
                <option key={q.quizId || idx} value={q.quizId} className={getOptionClasses(appTheme, isDark)}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {/* Quiz Details */}
      <div className="bg-black/5 dark:bg-white/5 p-6 rounded-xl shadow-sm border border-inherit/30 backdrop-blur-sm transition-colors">
        <h3 className="text-lg font-bold text-inherit mb-4 flex items-center gap-2">
          <FileQuestion className="w-5 h-5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10" /> Quiz Details
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="quiz-title" className="block text-sm font-medium mb-1">
              Quiz Title *
            </label>
            <input
              id="quiz-title"
              type="text"
              placeholder="Enter Quiz Title"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="w-full border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
            />
          </div>
          <div>
            <label htmlFor="quiz-subject" className="block text-sm font-medium mb-1">Subject *</label>
            {
              <select
                id="quiz-subject"
                value={subject || ""}
                onChange={(e) => {
                  setSubject(e.target.value);
                }}
              className="w-full border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
              >
              <option value="" disabled className={getOptionClasses(appTheme, isDark)}>
                  Select a Subject
                </option>
                {subjects.map((s, idx) => ( 
                <option key={s._id || idx} value={s.name || s.subject} className={getOptionClasses(appTheme, isDark)}>
                    {s.name || s.subject}{" "}
                    {user?.role === "Admin" && s.department?.name
                      ? `(${s.department.name})`
                      : ""}
                  </option>
                ))}
              </select>
            }
          </div>
          <div>
            <label htmlFor="quiz-shuffle" className=" text-sm flex gap-2 font-medium mb-1">
              <Shuffle className="w-4 h-4" /> Shuffle Questions (Optional) *
            </label>
            <input
              id="quiz-shuffle"
              type="number"
              placeholder={`Leave blank to ask all ${questions.length} questions`}
              value={shuffleQuestions ?? ""}
              min={1}
              max={questions.length}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setShuffleQuestions(null);
                } else {
                  const num = Number(val);
                  setShuffleQuestions(
                    num <= questions.length ? num : questions.length,
                  );
                }
              }}
            className="w-full border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
            />
            <div className="text-xs  mt-1.5 font-medium">
              {shuffleQuestions === null ? (
                <span className="text-red-500 dark:text-red-400">
                  Currently asking all {questions.length} questions in original
                  order.
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">
                  Asking {shuffleQuestions} random question
                  {Number(shuffleQuestions) > 1 ? "s" : ""} out of{" "}
                  {questions.length} total.
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="quiz-start" className="text-sm font-medium mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Quiz Start Date & Time *
              </label>
              <input
                id="quiz-start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-current"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2">
                Quiz Status
              </label>
              <div
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  isActive
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-black/10 dark:bg-white/10 border-inherit/30"
                }`}
                onClick={() => setIsActive(!isActive)} 
              >
                <span
                  className={`text-sm font-medium ${isActive ? "text-green-600 dark:text-green-400" : "text-inherit opacity-70"}`}
                >
                  {isActive
                    ? "Active (Accepting Submissions)"
                    : "Closed (Hidden/Locked)"}
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${isActive ? "border-green-500 bg-green-500" : "border-inherit/50"}`}
                >
                  {isActive && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Import Section */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit rounded-xl transition-colors shadow-sm">
        <div className="text-center md:text-left">
          <h3 className="font-bold flex items-center justify-center md:justify-start gap-2">
            <Upload className="w-4 h-4" /> Bulk Import Questions
          </h3>
          <p className="text-sm opacity-90 mt-1">
            Upload a CSV file to add multiple questions at once.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-black/10 dark:bg-white/10 border border-inherit/30 text-inherit hover:bg-black/20 dark:hover:bg-white/20 rounded-lg text-sm font-bold transition-colors shadow-sm w-full sm:w-auto flex-1 sm:flex-none"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-black/10 dark:bg-white/10 border border-inherit/30 text-inherit hover:bg-black/20 dark:hover:bg-white/20 rounded-lg text-sm font-bold transition-colors shadow-sm w-full sm:w-auto flex-1 sm:flex-none"
          >
            <FileDown className="w-4 h-4" /> Template
          </button>
          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-black/10 dark:bg-white/10 border border-inherit/30 text-inherit hover:bg-black/20 dark:hover:bg-white/20 rounded-lg text-sm font-bold transition-colors shadow-sm w-full sm:w-auto flex-1 sm:flex-none cursor-pointer">
            <Upload className="w-4 h-4" /> Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Questions Section */}
      {questions.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No Questions Added"
          description="Start building your quiz by adding the first question below or use AI to generate one."
        />
      ) : (
          <div className="flex flex-col gap-4">
          {questions.map((q, i) => {
            const isMissingAnswer =
              q.correctAnswer === null &&
              (q.question.trim() !== "" ||
                q.options.some((opt) => opt.text.trim() !== ""));
            return (
              <div
                key={i}
                className={`bg-black/5 dark:bg-white/5 p-4 sm:p-6 rounded-2xl shadow-sm border group relative overflow-hidden transition-all backdrop-blur-sm ${isMissingAnswer ? "border-red-500/50 bg-red-500/10" : "border-inherit/30 hover:shadow-md"}`}
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${isMissingAnswer ? "bg-red-500" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"}`}
                ></div>
                <div className="flex justify-between items-center mb-4 pl-2">
                  <div className={`font-bold text-base sm:text-lg ${isMissingAnswer ? "text-red-500 flex flex-wrap items-center gap-2" : "text-inherit"}`}>
                    Question {i + 1}
                    {isMissingAnswer && (
                      <span className="text-xs bg-red-500/10 text-red-500 dark:text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold">
                        Select Correct Answer
                      </span>
                    )}
                  </div>
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(i)}
                      className="text-inherit opacity-40 hover:text-red-500 hover:opacity-100 p-1.5 rounded-lg transition-colors"
                      title="Remove Question"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="pl-2">
                  <input
                    key={`q-${i}`}
                    aria-label={`Question ${i + 1}`}
                    type="text"
                    placeholder="Enter your question"
                    value={q.question}
                    onChange={(e) => handleQuestionChange(i, e.target.value)}
                    className={`w-full border p-3 rounded-xl mb-4 focus:outline-none focus:ring-2 bg-black/5 dark:bg-white/5 text-inherit ${isMissingAnswer ? "border-red-500/50 focus:ring-red-500" : "border-inherit/30 focus:ring-current"}`}
                  />
                  <div className="flex flex-col gap-3">
                    {q.options.map((opt, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center">
                          <input
                            aria-label={`Mark Option ${j + 1} as correct for Question ${i + 1}`}
                            type="radio" 
                            name={`correct-${i}`}
                            checked={q.correctAnswer === j}
                            onChange={() => handleAnswerSelect(i, j)}
                            className="w-5 h-5 text-current cursor-pointer peer relative appearance-none rounded-full border-2 border-inherit/30 checked:border-current"
                          />
                          <div className="absolute w-2.5 h-2.5 bg-current rounded-full scale-0 peer-checked:scale-100 transition-transform pointer-events-none"></div>
                        </div>
                        <input
                          key={`opt-${i}-${j}`}
                          aria-label={`Option ${j + 1} for Question ${i + 1}`}
                          type="text"
                          placeholder={`Option ${j + 1}`}
                          value={opt.text}
                          onChange={(e) =>
                            handleOptionChange(i, j, e.target.value)
                          }
                          className={`flex-1 min-w-0 border p-2.5 rounded-lg focus:outline-none focus:ring-2 text-sm text-inherit ${q.correctAnswer === j ? "bg-black/10 dark:bg-white/10 border-current/50 focus:ring-current font-medium" : isMissingAnswer ? "border-red-500/30 focus:ring-red-400 bg-black/5 dark:bg-white/5" : "border-inherit/30 focus:ring-current bg-black/5 dark:bg-white/5"}`}
                        />
                        {q.correctAnswer === j && (
                          <span className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest bg-green-500/10 border border-green-500/20 px-1.5 sm:px-2 py-1 rounded-md shrink-0">
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-5 mt-6">
        <button
          onClick={clearAllQuestions}
          variant="outline"
          className={`flex items-center justify-center py-2 px-4 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all font-medium shadow-sm w-full sm:w-auto`}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          <span>Clear All</span>
        </button>
        <button
          onClick={addQuestion}
          variant="outline"
          className={`flex items-center justify-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-sm font-medium transition-colors shadow-sm w-full sm:w-auto`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </button>
        <button
          onClick={saveQuiz}
          disabled={saving}
          className={`flex items-center justify-center py-2 px-5 rounded-xl transition-all shadow-sm font-bold disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto ${getPrimaryButtonClasses(appTheme)}`}
        >
          {saving ? (
            <>
              <div
                className="loader mr-2"
                style={{ "--s": "10px", "--g": "2px" }}
              ></div>
              Saving...
            </>
          ) : selectedQuizId ? (
            <>
              <Pen className="w-4 h-4 mr-2" />
              Update Quiz
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Quiz
            </>
          )}
        </button>
      </div>

      {/* AI Quiz Modal */}
      {showAIGenerator && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <AIQuizGenerator 
              onQuestionsGenerated={handleQuestionsGenerated} 
              onClose={() => setShowAIGenerator(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizEditor;
