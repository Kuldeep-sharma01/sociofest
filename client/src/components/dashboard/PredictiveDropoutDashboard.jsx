import React, { useState } from "react";
import { AlertTriangle, TrendingDown, UserX, BrainCircuit, Sparkles, X, Mail } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
import { useGetAtRiskStudentsQuery } from "@/redux/hodApi";
import { generateContent } from "@/services/aiService";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";

const PredictiveDropoutDashboard = () => {
  const { appTheme } = useTheme();
  const { data: atRiskStudents = [], isLoading } = useGetAtRiskStudentsQuery();
  
  const [aiPlan, setAiPlan] = useState("");
  const [generatingFor, setGeneratingFor] = useState(null);
  const [showAiModal, setShowAiModal] = useState(false);

  const handleGenerateIntervention = async (student) => {
    setGeneratingFor(student._id);
    setShowAiModal(true);
    setAiPlan("");

    try {
      const prompt = `You are a supportive College Head of Department (HOD). 
Write a short, encouraging, and professional intervention email to a student who is at risk of failing.
Student Name: ${student.name}
Attendance: ${student.attendance}%
Average Quiz Score: ${student.avgScore}%
Reason for risk: ${student.riskFactor}

Provide actionable advice (like attending office hours or reviewing specific materials) and keep the tone uplifting but firm.`;

      const response = await generateContent({ prompt, contentType: "intervention_plan" });
      const responseText = response.generated_content || response;
      setAiPlan(responseText);
    } catch (error) {
      console.error("Failed to generate AI plan:", error);
      setAiPlan("Error: Could not generate intervention plan. Please try again.");
    } finally {
      setGeneratingFor(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" /> At-Risk Students</h2>
        <LoadingSkeleton count={2} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-inherit">
          <AlertTriangle className="w-6 h-6 text-red-500" /> 
          Predictive Dropout Alerts
        </h2>
        <span className="text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full border border-red-500/20">
          {atRiskStudents.length} Students Flagged
        </span>
      </div>

      {atRiskStudents.length === 0 ? (
        <EmptyState 
          icon={UserX} 
          title="All Clear!" 
          description="No students are currently predicted to be at risk of dropping out or failing." 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {atRiskStudents.map((student) => (
            <div key={student._id} className={`p-5 rounded-2xl border shadow-sm flex flex-col gap-4 relative overflow-hidden group transition-all hover:shadow-md ${getCardThemeClasses(appTheme)}`}>
              <div className={`absolute top-0 left-0 w-1.5 h-full ${student.riskLevel === 'High' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg leading-tight truncate text-inherit">{student.name}</h3>
                  <p className="text-xs opacity-70 text-inherit font-mono mt-0.5">ID: {student.rollNumber || student._id.substring(0, 8)}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${student.riskLevel === 'High' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'}`}>
                  {student.riskLevel} Risk
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1 text-inherit">
                <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-inherit/10 text-center">
                  <div className={`text-lg font-bold ${student.attendance < 75 ? 'text-red-500' : ''}`}>{student.attendance}%</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-60">Attendance</div>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-inherit/10 text-center">
                  <div className={`text-lg font-bold ${student.avgScore < 50 ? 'text-red-500' : ''}`}>{student.avgScore}%</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-60">Avg Score</div>
                </div>
              </div>

              <p className="text-xs text-inherit opacity-80 mt-1 flex items-start gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                <span className="line-clamp-2">{student.riskFactor}</span>
              </p>

              <button 
                onClick={() => handleGenerateIntervention(student)}
                className={`mt-auto w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
              >
                <BrainCircuit className="w-4 h-4" /> AI Intervention Plan
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Intervention Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${getCardThemeClasses(appTheme)} animate-in zoom-in-95 duration-200`}>
            <div className="p-4 border-b border-inherit/20 bg-black/5 dark:bg-white/5 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2 text-inherit">
                <Sparkles className="w-5 h-5 text-current opacity-80" /> AI Intervention Drafter
              </h3>
              <button onClick={() => setShowAiModal(false)} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 text-inherit">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-inherit opacity-90 leading-relaxed">
              {generatingFor ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-70">
                  <div className="loader mb-4" style={{ '--s': '20px', '--g': '4px' }}></div>
                  <p className="font-bold">Analyzing student data & drafting email...</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-inherit/20 font-medium">
                  {aiPlan}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-inherit/20 bg-black/5 dark:bg-white/5 flex justify-end gap-3">
              <button onClick={() => setShowAiModal(false)} className="px-4 py-2 font-bold text-sm opacity-80 hover:opacity-100 transition-opacity text-inherit">Close</button>
              <button 
                disabled={generatingFor}
                onClick={() => {
                  navigator.clipboard.writeText(aiPlan);
                  window.dispatchEvent(new CustomEvent("showToast", { detail: "Email copied to clipboard! 📋" }));
                }}
                className={`px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
              >
                <Mail className="w-4 h-4" /> Copy Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictiveDropoutDashboard;
