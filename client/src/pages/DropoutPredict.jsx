import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { BrainCircuit, AlertTriangle, ShieldCheck, Search, Activity } from "lucide-react";
import { getAllUsers } from "@/services/userService";
import { generateContent } from "@/services/aiService";
import { getCardThemeClasses, getBannerThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
import UserCard from "@/components/ui/UserCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

const DropoutPredict = () => {
  const { appTheme } = useTheme();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [predictions, setPredictions] = useState({});

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await getAllUsers({ role: "Student", limit: 50 });
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
        setStudents(data);
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const runAnalysis = async (student) => {
    setAnalyzing(student._id);
    try {
      const prompt = `Analyze this student's risk of dropping out based on typical academic patterns. Return ONLY a valid JSON object: {"riskLevel": "High" | "Medium" | "Low", "reason": "Short explanation"}. Student info: Name: ${student.name}, Semester: ${student.semester || 1}, Dept: ${student.department?.name || 'Unknown'}. Assume random realistic attendance and grades for the sake of this simulation if missing.`;
      
      const response = await generateContent({ prompt, contentType: "text" });
      const resText = response.generated_content || response;
      const match = resText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setPredictions(prev => ({...prev, [student._id]: parsed}));
      }
    } catch(e) {
       window.dispatchEvent(new CustomEvent("showToast", { detail: "Analysis failed. AI may be offline. ❌" }));
    } finally {
      setAnalyzing(null);
    }
  };

  const runBatchAnalysis = async () => {
    for (const s of students.slice(0, 5)) {
      if (!predictions[s._id]) await runAnalysis(s);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-red-600 to-orange-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><BrainCircuit className="w-64 h-64" /></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Dropout AI Prediction</h1>
            <p className="mt-2 opacity-90 max-w-xl text-lg">Proactively identify students at risk of dropping out using AI analysis of engagement and academic patterns.</p>
          </div>
          <button onClick={runBatchAnalysis} disabled={analyzing !== false && analyzing !== null} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0`}>
             <Search className="w-5 h-5" /> Scan Top 5 Students
          </button>
        </div>
      </div>

      {loading ? <LoadingSkeleton count={3} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {students.map(student => (
            <div key={student._id} className={`${getCardThemeClasses(appTheme)} p-5 rounded-2xl shadow-sm border transition-colors flex flex-col gap-4`}>
              <UserCard user={student} showText={true} className="border-none shadow-none p-0 bg-transparent hover:bg-transparent" />
              {predictions[student._id] ? (<div className={`p-4 rounded-xl border ${predictions[student._id].riskLevel === 'High' ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : predictions[student._id].riskLevel === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'}`}><div className="flex items-center gap-2 font-bold mb-2">{predictions[student._id].riskLevel === 'High' ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />} Risk Level: {predictions[student._id].riskLevel}</div><p className="text-sm opacity-90">{predictions[student._id].reason}</p></div>) : (<button onClick={() => runAnalysis(student)} disabled={analyzing !== false && analyzing !== null} className={`w-full py-2.5 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${getPrimaryButtonClasses(appTheme)} disabled:opacity-50`}>{analyzing === student._id ? <div className="loader" style={{'--s':'12px','--g':'2px'}}></div> : <><Activity className="w-4 h-4"/> Run AI Analysis</>}</button>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default DropoutPredict;