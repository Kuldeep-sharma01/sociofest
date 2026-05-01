import React, { useState } from "react";
import { Sparkles, FileText, X, BrainCircuit } from "lucide-react";
import { generateContent } from "@/services/aiService";
import { useTheme } from "@/context/ThemeContext";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";

const AIQuizGenerator = ({ onQuestionsGenerated, onClose }) => {
  const { appTheme } = useTheme();
  const [sourceText, setSourceText] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!sourceText.trim()) {
      setError("Please provide some source material (notes, transcript, etc).");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const prompt = `You are an expert college educator. Based on the following source material, generate exactly ${numQuestions} multiple-choice questions.
Each question MUST have 4 options: 1 correct answer and 3 highly plausible but incorrect "distractors" designed to challenge the student's critical thinking.
Respond ONLY with a raw, valid JSON array. Do NOT wrap in markdown \`\`\`json blocks. Do not add any conversational text.
Format exactly like this:
[
  {
    "question": "Question text here?",
    "options": [{"text": "Distractor 1"}, {"text": "Correct Answer"}, {"text": "Distractor 2"}, {"text": "Distractor 3"}],
    "correctAnswer": 1
  }
]

Source Material:
${sourceText.substring(0, 20000)}`; // limit chars to prevent token overflow

      const response = await generateContent({ prompt, contentType: "quiz_generation" });
      const responseText = response.generated_content || response;

      // Securely clean potential markdown from AI output
      let cleanJson = responseText.trim();
      const jsonStart = cleanJson.indexOf("[");
      const jsonEnd = cleanJson.lastIndexOf("]") + 1;

      if (jsonStart === -1 || jsonEnd === 0)
        throw new Error("Invalid AI response format");

      cleanJson = cleanJson.substring(jsonStart, jsonEnd);
      const questions = JSON.parse(cleanJson);

      // Ensure options are strictly mapped to the Mongoose { text: String } schema
      const formattedQuestions = questions.map((q) => ({
        ...q,
        options: q.options.map((opt) =>
          typeof opt === "string" ? { text: opt } : opt,
        ),
      }));

      onQuestionsGenerated(formattedQuestions);
      if (onClose) onClose();
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Smart Quiz Generated! ✨" }),
      );
    } catch (err) {
      console.error("AI Quiz Gen Error:", err);
      setError(
        "Failed to generate quiz. Please ensure the source text is clear and try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className={`p-6 rounded-2xl shadow-xl border transition-colors ${getCardThemeClasses(appTheme)}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-inherit">
          <BrainCircuit className="w-5 h-5 text-current opacity-80" />
          AI Quiz Architect
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 opacity-70 hover:opacity-100 text-inherit" />
          </button>
        )}
      </div>

      <p className="text-sm opacity-80 mb-4 text-inherit">
        Paste your lecture transcript, syllabus, or study notes below. The AI
        will generate multiple-choice questions with smart, plausible
        distractors.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Paste lecture notes or text here..."
          className="w-full h-40 p-3 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-xl text-sm text-inherit focus:outline-none focus:ring-2 focus:ring-current resize-none"
        />

        <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-inherit/10">
          <span className="text-sm font-semibold opacity-90 text-inherit">
            Number of Questions:
          </span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="20"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="accent-current cursor-pointer w-32"
            />
            <span className="font-mono font-bold bg-black/10 dark:bg-white/10 px-2 py-1 rounded text-inherit">
              {numQuestions}
            </span>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !sourceText.trim()}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
        >
          {isGenerating ? (
            <div
              className="loader"
              style={{ "--s": "15px", "--g": "3px" }}
            ></div>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Generate Smart Distractors
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AIQuizGenerator;
