import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Confetti from "react-confetti";

import {
  Send,
  CheckCircle,
  XCircle,
  BookOpen,
  Award,
  Download,
  Bot,
  Volume2,
  VolumeX,
  FileQuestion,
  Edit2,
  Zap,
  Type,
} from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { generateContent, speakText, stopSpeaking } from "@/services/aiClient";
import { getQuizById, submitQuiz } from "@/services/quizService";
import { downloadCertificate } from "@/services/certificateService";
import { HIGHLIGHT_STYLES, HighlightedText } from "@/utils/textUtils.jsx";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useTheme } from "@/context/ThemeContext";
import { getPrimaryButtonClasses, getBannerThemeClasses, getOptionClasses } from "@/utils/themeUtils";

const Typewriter = ({ text, enabled }) => {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const [currentIndex, setCurrentIndex] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 15); // Adjust typing speed here
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, enabled]);

  return <>{displayedText}</>;
};

const QuizAttempt = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { appTheme, isDark } = useTheme();
  const user = useSelector((state) => state.auth.user);

  const [quiz, setQuiz] = useState(null);
  const [presentedQuestions, setPresentedQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [highlightStyle, setHighlightStyle] = useState(
    localStorage.getItem("aiHighlightStyle") || "yellow",
  );
  const [highlightSpeed, setHighlightSpeed] = useState(
    localStorage.getItem("aiHighlightSpeed") || "duration-300",
  );
  const [textSize, setTextSize] = useState(
    localStorage.getItem("aiTextSize") || "text-base",
  );

  // AI Tutor State
  const [aiExplanations, setAiExplanations] = useState({});
  const [loadingAi, setLoadingAi] = useState({});
  const [speakingState, setSpeakingState] = useState({
    id: null,
    text: "",
    offset: 0,
    charIndex: 0,
    charLength: 0,
  });
  const [typingEffectEnabled, setTypingEffectEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(
    parseFloat(localStorage.getItem("aiSpeechRate")) || 1,
  );
  const [voiceURI, setVoiceURI] = useState(
    localStorage.getItem("aiSpeechVoice") || "",
  );
  const [voices, setVoices] = useState([]);

  const isCancellingRef = useRef(false);

  // Responsive Confetti Sizing
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const fetchQuiz = useCallback(async () => {
    try {
      const data = await getQuizById(quizId);
      setQuiz(data);
      setAnswers(new Array(data.questions.length).fill(null));

      let questionsToPresent = data.questions.map((q, index) => ({
        ...q,
        originalIndex: index,
      }));

      if (
        data.shuffle > 0 &&
        data.shuffle <= data.questions.length
      ) {
        questionsToPresent = questionsToPresent
          .sort(() => Math.random() - 0.5)
          .slice(0, data.shuffle);
      }
      setPresentedQuestions(questionsToPresent);
    } catch (err) {
      setError("Failed to load the quiz. It may be closed or does not exist.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  const handleAnswerSelect = (questionIndex, optionIndex) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    const unanswered = presentedQuestions.some(
      (q) => answers[q.originalIndex] === null,
    );
    if (unanswered) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Build a compact map: originalIndex → selected option
      const submittedAnswers = presentedQuestions.map((q) => ({
        questionIndex: q.originalIndex,
        answer: answers[q.originalIndex],
      }));
      const data = await submitQuiz(quizId, { answers: submittedAnswers });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit quiz.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAskAi = async (
    questionId,
    questionText,
    correctOptText,
    userOptText,
  ) => {
    setLoadingAi((prev) => ({ ...prev, [questionId]: true }));
    try {
      const prompt = `The student answered a quiz question incorrectly. 
      Question: "${questionText}"
      Correct Answer: "${correctOptText}"
      Student's Wrong Answer: "${userOptText}"
      Please explain WHY the correct answer is right and WHY the student's answer is wrong in a brief, encouraging, and easy-to-understand way. Do not use complex markdown.`;

      const explanation = await generateContent(
        prompt,
        "You are a friendly and encouraging academic tutor.",
      );
      setAiExplanations((prev) => ({ ...prev, [questionId]: explanation }));
    } catch (err) {
      setAiExplanations((prev) => ({
        ...prev,
        [questionId]: `⚠️ ${err.message}`,
      }));
    } finally {
      setLoadingAi((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const speakFromOffset = useCallback((text, id, offset, rate) => {
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
  }, []);

  const handleToggleAudio = (id, text) => {
    if (speakingState.id === id) {
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
        setSpeakingState({ id, text, offset: 0, charIndex: 0, charLength: 0 });
        speakFromOffset(text, id, 0, speechRate);
      }, 50);
    }
  };

  const handleSpeechRateChange = (e) => {
    const newRate = parseFloat(e.target.value);
    setSpeechRate(newRate);
    localStorage.setItem("aiSpeechRate", newRate);

    if (speakingState.id) {
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

  const handleDownloadCertificate = async (certId, title) => {
    try {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Generating certificate... ⏳",
        }),
      );
      await downloadCertificate(certId);
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Certificate downloaded! 🎉" }),
      );
    } catch (err) {
      console.error("Certificate download failed:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to download certificate. ❌";
      window.dispatchEvent(new CustomEvent("showToast", { detail: errorMsg }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <LoadingSkeleton count={4} />
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="flex h-screen max-w-5xl  items-center justify-center text-center">
        <div className="p-8">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-500">Error</h2>
          <p className="opacity-80 text-inherit mt-2">{error}</p>
        <button
          onClick={() => navigate("/activities")}
          className={`mt-6 px-6 py-2 rounded-xl font-bold transition-all shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
        >
            Back to Activities
        </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {result.score >= 80 && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={600}
            gravity={0.15}
            style={{ position: "fixed", top: 0, left: 0, zIndex: 100 }}
          />
        )}
        {/* Summary Card */}
        <div className="bg-black/5 dark:bg-white/5 backdrop-blur-sm p-8 rounded-3xl shadow-sm border border-inherit/30 text-center relative overflow-hidden transition-colors">
          <div className="absolute -top-10 -right-10 opacity-5">
            <CheckCircle className="w-64 h-64 text-green-500" />
          </div>
          <div className="relative z-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-extrabold text-inherit">
              Quiz Submitted!
            </h2>
            <p className="opacity-80 mt-2 text-lg font-medium">
              {result.message}
            </p>
            <div className="my-8">
              <div className="inline-flex flex-col items-center justify-center w-40 h-40 rounded-full border-8 shadow-inner bg-black/5 dark:bg-white/5 border-inherit/30">
                <span
                  className={`text-4xl font-black ${result.score >= 80 ? "text-green-500" : result.score >= 50 ? "text-yellow-500" : "text-red-500"}`}
                >
                  {result.score.toFixed(0)}%
                </span>
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Score
                </span>
              </div>
            </div>
            {result.score >= 80 && (
              <div className="flex flex-col items-center justify-center gap-3 text-emerald-700 font-bold bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm mx-auto mb-6">
                <div className="flex items-center gap-2">
                  <Award className="w-6 h-6" />
                  Congratulations! A verified certificate has been issued to
                  your profile.
                </div>
                {result.certificateId && (
                  <button
                    onClick={() =>
                      handleDownloadCertificate(
                        result.certificateId,
                        `${quiz.title} - Certificate`,
                      )
                    }
                    className="flex items-center gap-2 px-6 py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Download className="w-5 h-5" /> Download Certificate
                  </button>
                )}
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={() => navigate("/dashboard#quiz-history")}
                className={`px-8 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 ${getPrimaryButtonClasses(appTheme)}`}
              >
                View in Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Review Section */}
        <div className="flex flex-col gap-6 pb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-4">
            <h3 className="text-2xl font-bold text-inherit flex items-center gap-2">
              <BookOpen className="text-blue-500" /> Detailed Review
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-inherit/30 shadow-sm text-sm font-bold text-inherit">
                <Edit2 className="w-4 h-4 text-blue-500" />
                <span className="whitespace-nowrap hidden sm:inline">
                  Style:
                </span>
                <select
                  value={highlightStyle}
                  onChange={(e) => {
                    setHighlightStyle(e.target.value);
                    localStorage.setItem("aiHighlightStyle", e.target.value);
                  }}
                  className="bg-transparent focus:outline-none focus:ring-2 focus:ring-current rounded cursor-pointer text-blue-700 max-w-[100px] sm:max-w-[150px] truncate"
                >
                  {Object.entries(HIGHLIGHT_STYLES).map(([key, style]) => (
                    <option key={key} value={key} className={getOptionClasses(appTheme, isDark)}>
                      {style.name}
                    </option>
                  ))}
                </select>
                <div className="w-px h-4 bg-inherit opacity-30 mx-1"></div>
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="whitespace-nowrap hidden sm:inline">
                  Transition:
                </span>
                <select
                  value={highlightSpeed}
                  onChange={(e) => {
                    setHighlightSpeed(e.target.value);
                    localStorage.setItem("aiHighlightSpeed", e.target.value);
                  }}
                  className="bg-transparent focus:outline-none focus:ring-2 focus:ring-current rounded cursor-pointer text-blue-700 max-w-[100px] sm:max-w-[150px] truncate"
                >
                  <option value="duration-75" className={getOptionClasses(appTheme, isDark)}>Very Fast</option>
                  <option value="duration-150" className={getOptionClasses(appTheme, isDark)}>Fast</option>
                  <option value="duration-300" className={getOptionClasses(appTheme, isDark)}>Normal</option>
                  <option value="duration-500" className={getOptionClasses(appTheme, isDark)}>Smooth</option>
                  <option value="duration-700" className={getOptionClasses(appTheme, isDark)}>Slow</option>
                  <option value="duration-0" className={getOptionClasses(appTheme, isDark)}>Instant</option>
                </select>
                <div className="w-px h-4 bg-inherit opacity-30 mx-1"></div>
                <Type className="w-4 h-4 text-blue-500" />
                <span className="whitespace-nowrap hidden sm:inline">
                  Size:
                </span>
                <select
                  value={textSize}
                  onChange={(e) => {
                    setTextSize(e.target.value);
                    localStorage.setItem("aiTextSize", e.target.value);
                  }}
                  className="bg-transparent focus:outline-none focus:ring-2 focus:ring-current rounded cursor-pointer text-blue-700 max-w-[100px] sm:max-w-[150px] truncate"
                >
                  <option value="text-sm" className={getOptionClasses(appTheme, isDark)}>Small</option>
                  <option value="text-base" className={getOptionClasses(appTheme, isDark)}>Normal</option>
                  <option value="text-lg" className={getOptionClasses(appTheme, isDark)}>Large</option>
                  <option value="text-xl" className={getOptionClasses(appTheme, isDark)}>X-Large</option>
                </select>
                <div className="w-px h-4 bg-inherit opacity-30 mx-1"></div>
                <Volume2 className="w-4 h-4 text-blue-500" />
                <span className="whitespace-nowrap hidden sm:inline">
                  Voice:
                </span>
                <select
                  value={voiceURI}
                  onChange={handleVoiceChange}
                  className="bg-transparent focus:outline-none focus:ring-2 focus:ring-current rounded cursor-pointer text-blue-700 max-w-[100px] sm:max-w-[150px] truncate"
                >
                  <option value="" className={getOptionClasses(appTheme, isDark)}>System Default</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI} className={getOptionClasses(appTheme, isDark)}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <span className="whitespace-nowrap">
                  Speed: {speechRate.toFixed(1)}x
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={speechRate}
                  onChange={handleSpeechRateChange}
                  className="w-24 h-1.5 bg-black/20 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-inherit bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm">
                <input
                  type="checkbox"
                  checked={typingEffectEnabled}
                  onChange={(e) => setTypingEffectEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                AI Typing Effect
              </label>
            </div>
          </div>
          {presentedQuestions.map((q, qIndex) => {
            const userAnswer = answers[q.originalIndex];
            const isCorrect = userAnswer === q.correctAnswer;
            const correctOptText = q.options[q.correctAnswer]?.text;
            const userOptText = q.options[userAnswer]?.text || "No Answer";

            return (
              <div
                key={q._id}
                className={`bg-black/5 dark:bg-white/5 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-sm border-2 transition-colors ${isCorrect ? "border-green-500/50" : "border-red-500/50"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <h4 className="text-xl font-bold text-inherit leading-relaxed">
                    <span className="text-gray-400 mr-2">Q{qIndex + 1}.</span>{" "}
                    {q.question}
                  </h4>
                  {isCorrect ? (
                    <span className="flex items-center gap-1.5 text-green-700 bg-green-100 px-4 py-1.5 rounded-full text-sm font-black border border-green-200 shrink-0 shadow-sm">
                      <CheckCircle className="w-4 h-4" /> Correct
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-700 bg-red-100 px-4 py-1.5 rounded-full text-sm font-black border border-red-200 shrink-0 shadow-sm">
                      <XCircle className="w-4 h-4" /> Incorrect
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {q.options.map((opt, oIndex) => {
                    const isSelected = userAnswer === oIndex;
                    const isActualCorrect = q.correctAnswer === oIndex;

                    let optionStyle =
                      "border-inherit/30 bg-black/5 dark:bg-white/5 opacity-80"; // default unselected
                    if (isActualCorrect) {
                      optionStyle =
                        "border-green-500 bg-green-500/10 text-green-500 ring-2 ring-green-500/20 shadow-sm"; // Correct answer highlights green
                    } else if (isSelected && !isActualCorrect) {
                      optionStyle = "border-red-400 bg-red-50 text-red-800"; // Wrong selected highlights red
                    }

                    return (
                      <div
                        key={oIndex}
                        className={`flex items-center p-4 border-2 rounded-xl transition-all ${optionStyle}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 ${isActualCorrect ? "border-green-600 bg-green-600" : isSelected ? "border-red-500 bg-red-500" : "border-inherit/30 bg-black/5 dark:bg-white/5"}`}
                        >
                          {isActualCorrect && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                          {isSelected && !isActualCorrect && (
                            <XCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="font-semibold text-[15px]">
                          {opt.text}
                        </span>
                        {isActualCorrect && (
                          <span className="ml-auto text-[10px] sm:text-xs font-black text-green-600 uppercase tracking-widest bg-green-100 px-2 py-1 rounded-md">
                            Correct Answer
                          </span>
                        )}
                        {isSelected && !isActualCorrect && (
                          <span className="ml-auto text-[10px] sm:text-xs font-black text-red-600 uppercase tracking-widest bg-red-100 px-2 py-1 rounded-md">
                            Your Answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AI Tutor Integration */}
                {!isCorrect && (
                  <div className="mt-5 pt-5 border-t border-inherit/30">
                    {!aiExplanations[q._id] && !loadingAi[q._id] ? (
                      <button
                        onClick={() =>
                          handleAskAi(
                            q._id,
                            q.question,
                            correctOptText,
                            userOptText,
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl transition-colors shadow-sm text-sm border border-indigo-500/20"
                      >
                        <Bot className="w-4 h-4" /> Ask AI Tutor for Explanation
                      </button>
                    ) : loadingAi[q._id] ? (
                      <div className="flex items-center gap-3 text-indigo-600 text-sm font-bold bg-indigo-50/50 p-3 rounded-xl w-fit">
                        <div
                          className="loader"
                          style={{ "--s": "10px", "--g": "2px" }}
                        ></div>{" "}
                        Thinking...
                      </div>
                    ) : (
                      <div className="bg-black/5 dark:bg-white/5 border border-inherit/30 p-5 rounded-2xl relative text-inherit">
                        <button
                          onClick={() =>
                            handleToggleAudio(q._id, aiExplanations[q._id])
                          }
                          className="absolute top-4 right-4 p-2 bg-black/5 dark:bg-white/5 rounded-full text-inherit hover:bg-black/10 dark:hover:bg-white/10 shadow-sm transition-colors"
                        >
                          {speakingState.id === q._id ? (
                            <VolumeX className="w-4 h-4 opacity-70" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <h5 className="font-bold text-inherit opacity-90 flex items-center gap-2 mb-2">
                          <Bot className="w-5 h-5" /> AI Tutor Explanation
                        </h5>
                        <p 
                          className={`text-inherit opacity-90 leading-relaxed pr-8 whitespace-pre-wrap min-h-[3rem] ${textSize}`}
                        >
                          {speakingState.id === q._id ? (
                            <HighlightedText
                              text={aiExplanations[q._id]}
                              charIndex={speakingState.charIndex}
                              charLength={speakingState.charLength}
                              customClass={
                                HIGHLIGHT_STYLES[highlightStyle]?.classes
                              }
                              speedClass={highlightSpeed}
                              textSizeClass={textSize}
                            />
                          ) : (
                            <Typewriter
                              text={aiExplanations[q._id]}
                              enabled={typingEffectEnabled}
                            />
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ================= TAKING QUIZ MODE =================
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-indigo-700 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <FileQuestion className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold">{quiz.title}</h1>
          <p className="text-blue-100 mt-2 text-base md:text-lg font-medium flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> {quiz.subject}
          </p>
        </div>
        <div className="relative z-10 bg-white/20 backdrop-blur-sm text-white px-5 py-3 rounded-2xl font-bold border border-white/30 shadow-sm shrink-0 text-center">
          {presentedQuestions.length} Questions
        </div>
      </div>

      {presentedQuestions.map((q, qIndex) => (
        <div
          key={q._id}
                className="bg-black/5 dark:bg-white/5 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border border-inherit/30 transition-colors"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-inherit leading-relaxed">
              <span className="text-blue-500 mr-2">Q{qIndex + 1}.</span>{" "}
              {q.question}
            </h3>
          </div>
          <div>
            <div className="flex flex-col gap-3">
              {q.options.map((opt, oIndex) => (
                <label
                  key={oIndex}
                  className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all group ${
                    answers[q.originalIndex] === oIndex
                      ? "bg-blue-500/10 border-blue-500 shadow-sm"
                      : "border-inherit/30 hover:border-blue-500/50 hover:bg-blue-500/5"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 shrink-0 transition-colors ${answers[q.originalIndex] === oIndex ? "border-blue-600 bg-blue-600" : "border-gray-300 group-hover:border-blue-400"}`}
                  >
                    {answers[q.originalIndex] === oIndex && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name={`question-${q.originalIndex}`}
                    checked={answers[q.originalIndex] === oIndex}
                    onChange={() => handleAnswerSelect(q.originalIndex, oIndex)}
                    className="hidden"
                  />
                  <span
                    className={`font-medium ${answers[q.originalIndex] === oIndex ? "text-blue-500" : "text-inherit opacity-80"}`}
                  >
                    {opt.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}

      <ErrorAlert message={error} />

      <div className="flex justify-end mt-8">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`flex items-center px-8 py-3 text-lg font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
        >
          {submitting ? (
            <>
              <div
                className="loader mr-3"
                style={{ "--s": "15px", "--g": "3px" }}
              ></div>
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-6 h-6 mr-2" />
              Submit Quiz
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default QuizAttempt;
