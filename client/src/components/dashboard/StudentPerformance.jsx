import React from "react";
import {
  ClipboardList,
  FileQuestion,
  Award,
  CalendarDays,
  Clock,
  MapPin,
} from "lucide-react";
import CertificateCard from "@/components/ui/CertificateCard";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses } from "@/utils/themeUtils";

const StudentPerformance = ({
  quizHistory = [],
  certificates = [],
  events = [],
  handleDownloadCertificate,
  loading = false,
  web3Config,
  onMintSuccess,
}) => {
  const { appTheme } = useTheme();

  return (
    <>
      {/* Quiz History */}
      <section id="quiz-history" className="scroll-mt-20">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-inherit">
          <ClipboardList className="text-current opacity-80 w-7 h-7" /> Quiz History
        </h2>
        {loading ? (
          <LoadingSkeleton count={2} />
        ) : quizHistory.length === 0 ? (
          <EmptyState
            icon={FileQuestion}
            title="No Quizzes Attempted"
            description="Quizzes you complete will appear here."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
            {quizHistory.map((q, i) => {
              const isExcellent = q.score >= 80;
              const isPass = q.score >= 50 && q.score < 80;
              const colorClass = isExcellent
                ? "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20"
                : isPass
                  ? "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                  : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20";
              const progressColor = isExcellent
                ? "bg-green-500"
                : isPass
                  ? "bg-yellow-500"
                  : "bg-red-500";

              return (
                <div
                  key={i}
                  className={`flex flex-col rounded-2xl shadow-sm border p-5 hover:shadow-md hover:scale-[1.02] transition-all duration-300 group ${getCardThemeClasses(appTheme)}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl border ${colorClass} bg-opacity-20 group-hover:scale-110 transition-transform`}
                      >
                        <FileQuestion className="w-6 h-6" />
                      </div>
                      <div>
                        <h4
                          className="font-bold text-inherit text-lg leading-tight line-clamp-1"
                          title={q.title}
                        >
                          {q.title}
                        </h4>
                        <p className="text-xs text-inherit opacity-70 font-medium mt-1 uppercase tracking-wide">
                          {new Date(q.date).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-3 py-1.5 text-sm font-bold rounded-full border shadow-sm ${colorClass}`}
                      >
                        {(q.score || 0).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 mb-1.5 overflow-hidden shadow-inner">
                      <div
                        className={`h-2 rounded-full ${progressColor} transition-all duration-1000`}
                        style={{ width: `${q.score || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-right text-[10px] font-bold text-inherit opacity-60 uppercase tracking-wider">
                      {isExcellent
                        ? "Excellent Score 🌟"
                        : isPass
                          ? "Passed ✓"
                          : "Needs Improvement 💡"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Certificates Section */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-inherit">
          <Award className="text-current opacity-80 w-7 h-7" /> Earned Certificates
        </h2>
        {loading ? (
          <LoadingSkeleton count={2} />
        ) : certificates.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No Certificates Yet"
            description="Score 80% or higher on quizzes to earn verified credentials."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-5 max-h-[450px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full p-1">
            {certificates.map((cert, i) => (
              <CertificateCard
                key={cert._id || i}
                cert={cert}
                onDownload={handleDownloadCertificate}
                web3Config={web3Config}
                onMintSuccess={onMintSuccess}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section>
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-inherit">
          <CalendarDays className="text-current opacity-80 w-7 h-7" /> Upcoming Events
        </h2>
        {loading ? (
          <LoadingSkeleton count={2} />
        ) : events.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No Upcoming Events"
            description="Your schedule is clear for now."
          />
        ) : (
          <div className="grid gap-3 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
            {events.map((event, i) => {
              const startDate = new Date(event.start);
              return (
                <div
                  key={i}
                  className={`flex rounded-xl shadow-sm border overflow-hidden group hover:border-orange-400/50 hover:shadow-md hover:scale-[1.02] transition-all duration-300 ${getCardThemeClasses(appTheme)}`}
                >
                  <div className="flex flex-col items-center justify-center bg-orange-500/10 border-r border-orange-500/20 min-w-[80px] p-3 text-orange-600 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {startDate.toLocaleString("default", { month: "short" })}
                    </span>
                    <span className="text-2xl font-black leading-none my-0.5">
                      {startDate.getDate()}
                    </span>
                  </div>
                  <div className="p-4 flex-1">
                    <div className="flex flex-col h-full justify-between gap-2">
                      <div className="w-full">
                        <div className="mb-1.5">
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 text-[10px] font-bold uppercase tracking-wider rounded-full inline-block">
                            {event.category || "Event"}
                          </span>
                        </div>
                        <h4 className="font-bold text-inherit text-lg leading-tight mb-1">
                          {event.title}
                        </h4>
                        <p className="text-sm text-inherit opacity-80 line-clamp-2">
                          {event.description || "No description provided."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-inherit opacity-70 mt-2">
                        <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 shadow-sm">
                          <Clock className="w-3.5 h-3.5" />
                          {startDate.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30 shadow-sm">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[120px] sm:max-w-[200px]">
                              {event.location}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default StudentPerformance;
