import React, { Suspense, lazy, useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getOptionClasses } from "@/utils/themeUtils";

const DynamicBarChart = lazy(async () => {
  const [
    { Bar },
    { Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend },
  ] = await Promise.all([import("react-chartjs-2"), import("chart.js")]);
  Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
  return { default: Bar };
});

const TeacherInsights = ({
  quizStats = [],
  selectedQuiz,
  setSelectedQuiz,
  leaderboard = [],
  statsLoading = false,
  leaderboardLoading = false,
}) => {
  const { appTheme, isDark } = useTheme();
  const selectedQuizId = selectedQuiz?.quizId || selectedQuiz?._id || "";

  const barData = {
    labels: quizStats.map((q) => q.title),
    datasets: [
      {
        label: "Average Score (%)",
        data: quizStats.map((q) => q.avgScore),
        backgroundColor: "#6366F1", // Matches Indigo 500 from RoleDistributionChart
      },
      {
        label: "Submission Count",
        data: quizStats.map((q) => q.count),
        backgroundColor: "#10B981", // Matches Emerald 500 from RoleDistributionChart
      },
    ],
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div
        className={`lg:col-span-3 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <h2 className="text-xl font-bold mb-4 text-inherit">
          📊 Quiz Insights
        </h2>
        {statsLoading ? (
          <div className="h-[300px] flex items-center justify-center opacity-70">
            <div
              className="loader"
              style={{ "--s": "20px", "--g": "4px" }}
            ></div>
          </div>
        ) : quizStats.length > 0 ? (
          <Suspense
            fallback={
              <div className="h-[300px] flex items-center justify-center opacity-70">
                Loading chart data...
              </div>
            }
          >
            <DynamicBarChart data={barData} />
          </Suspense>
        ) : (
          <p className="opacity-70 text-inherit">
            No quiz data available. Create a quiz to see insights.
          </p>
        )}
      </div>

      {quizStats.length > 0 && (
        <div
          className={`lg:col-span-2 p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
        >
          <h2 className="text-xl font-bold mb-4 text-inherit">
            🏆 Leaderboard
          </h2>
          <select
            onChange={(e) => {
              const q = quizStats.find(
                (q) => q.quizId === e.target.value || q._id === e.target.value,
              );
              if (setSelectedQuiz && q) setSelectedQuiz(q);
            }}
            value={selectedQuizId}
            className="w-full p-2 rounded-lg mb-4 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit focus:outline-none focus:ring-2 focus:ring-current"
          >
            {quizStats.map((q) => (
              <option
                key={q.quizId}
                value={q.quizId}
                className={getOptionClasses(appTheme, isDark)}
              >
                {q.title}
              </option>
            ))}
          </select>

          {leaderboardLoading ? (
            <div className="py-8 flex items-center justify-center opacity-70">
              Loading leaderboard...
            </div>
          ) : leaderboard.length > 0 ? (
            <ul className="divide-y divide-inherit/30 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={`${entry.studentId}-${index}`}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-inherit flex items-center gap-2">
                      {index + 1}. {entry.name}
                      {(entry.violations?.length > 0 || entry.flags > 0) && (
                        <span
                          className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full font-bold shadow-sm"
                          title={
                            entry.violations
                              ? `Violations: ${entry.violations.join(", ")}`
                              : "Anti-Cheat Flags Detected"
                          }
                        >
                          <ShieldAlert className="w-3 h-3" />
                          {entry.violations?.length || entry.flags} Flag(s)
                        </span>
                      )}
                    </p>
                    <p className="text-sm opacity-70 text-inherit">
                      Score: {(entry.score || 0).toFixed(0)}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="opacity-70 text-inherit">
              No submissions for this quiz yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default TeacherInsights;
