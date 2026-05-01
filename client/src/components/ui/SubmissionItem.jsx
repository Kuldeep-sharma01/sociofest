import React from "react";
import { Download, Eye } from "lucide-react";
import UserInfo from "./UserInfo";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const SubmissionItem = ({
  submission,
  studentName,
  studentAvatar,
  gradingState,
  onEditGrade,
  onSaveGrade,
  onGradeChange,
  onFeedbackChange,
  onViewMedia,
}) => {
  const { appTheme } = useTheme();

  return (
    <div className={`${getCardThemeClasses(appTheme)} p-4 rounded-xl text-sm border border-inherit/30 shadow-sm hover:border-purple-500/20 transition-colors text-inherit`}>
      <div className="flex justify-between items-center mb-3">
        <UserInfo
          user={{
            name: studentName,
            profilePicture: studentAvatar
          }}
          avatarSize="w-8 h-8"
          nameClassName="text-base"
        />
        <span className="text-xs font-semibold opacity-70 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-md border border-inherit/30">
          {new Date(submission.submittedAt).toLocaleString()}
        </span>
      </div>
      
      {submission.textAnswer && (
        <div className="bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/30 mb-3 ml-11 shadow-inner">
          <p className="opacity-90 whitespace-pre-wrap font-medium">
            {submission.textAnswer}
          </p>
        </div>
      )}

      {submission.fileUrls?.length > 0 ? (
        <div className="ml-11 flex flex-wrap gap-2 mb-3">
          {submission.fileUrls.map((url, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); 
                const safeUrl = typeof url === 'string' ? url.replace(/\\/g, '/') : url;
                if(onViewMedia) onViewMedia(safeUrl, `Attachment ${i + 1}`); 
              }}
              className="inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20 shadow-sm"
            >
              <Eye className="w-4 h-4" /> View Attachment {i + 1}
            </button>
          ))}
        </div>
      ) : submission.fileUrl ? (
        <button
          onClick={(e) => { e.preventDefault(); 
            const safeUrl = typeof submission.fileUrl === 'string' ? submission.fileUrl.replace(/\\/g, '/') : submission.fileUrl;
            if(onViewMedia) onViewMedia(safeUrl, "Attachment"); 
          }}
          className="ml-11 inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20 mb-3 shadow-sm"
        >
          <Eye className="w-4 h-4" /> View Attachment
        </button>
      ) : null}

      {/* Grading UI */}
      <div className="mt-2 pt-3 border-t border-inherit/30 ml-11">
        {gradingState?.editing ? (
          <div className="flex flex-wrap gap-2 items-center bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
            <input
              type="number"
              placeholder="Grade (0-100)"
              className="border border-inherit/30 p-2 w-28 rounded-lg text-sm bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none shadow-sm"
              value={gradingState.grade || ""}
              onChange={(e) => onGradeChange(e.target.value)}
            />
            <input
              type="text"
              placeholder="Feedback (optional)"
              className="border border-inherit/30 p-2 flex-1 min-w-[150px] rounded-lg text-sm bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none shadow-sm"
              value={gradingState.feedback || ""}
              onChange={(e) => onFeedbackChange(e.target.value)}
            />
            <button
              onClick={onSaveGrade}
              className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors ${getPrimaryButtonClasses(appTheme)}`}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {submission.grade !== null && submission.grade !== undefined ? (
                <span className="font-black text-green-500 bg-green-500/10 border border-green-500/30 px-3 py-1 rounded-lg shadow-sm">
                  Score: {submission.grade}/100
                </span>
              ) : (
                <span className="opacity-70 italic font-medium">
                  Not graded yet
                </span>
              )}
              {submission.feedback && (
                <p className="opacity-90 mt-2 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20 italic font-medium">
                  Teacher's Note: "{submission.feedback}"
                </p>
              )}
            </div>
            <button
              onClick={onEditGrade}
              className="text-xs font-bold text-purple-500 dark:text-purple-400 hover:text-white transition-colors bg-purple-500/10 hover:bg-purple-600 border border-purple-500/30 px-4 py-2 rounded-lg shadow-sm active:scale-95"
            >
              {submission.grade !== null && submission.grade !== undefined
                ? "Edit Grade"
                : "Evaluate"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default SubmissionItem;
