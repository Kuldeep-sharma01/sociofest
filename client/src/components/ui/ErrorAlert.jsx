import React, { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { generateContent } from "@/services/aiService";

const ErrorAlert = ({ message, className = "" }) => {
  const [translatedMsg, setTranslatedMsg] = useState("");
  const [translating, setTranslating] = useState(false);

  if (!message) return null;

  const translateError = async () => {
    setTranslating(true);
    try {
      const prompt = `Translate this technical error into a friendly, helpful, short 1-sentence message for a college student (include an emoji). Error: "${message}"`;
      const response = await generateContent({ prompt, contentType: "error_translation" });
      const resText = response.generated_content || response;
      setTranslatedMsg(resText);
    } catch (e) {
      console.error("AI Error Translation Failed:", e);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div
      className={`bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in transition-colors ${className}`}
    >
      <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
      <div className="flex-1 flex flex-col gap-1">
        <p className="font-medium text-sm">{translatedMsg || message}</p>
        {!translatedMsg && (
          <button onClick={translateError} disabled={translating} className="text-xs text-red-600 flex items-center gap-1 w-fit hover:underline font-bold mt-1 opacity-80 hover:opacity-100 disabled:opacity-50">
            <Sparkles className="w-3 h-3" /> {translating ? "Translating..." : "Explain this error"}
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorAlert;
