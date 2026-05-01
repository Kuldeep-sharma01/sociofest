import React from "react";

const LoadingSkeleton = ({ count = 3, className = "" }) => {
  return (
    <div
      className={`w-full flex flex-col gap-4 animate-pulse py-2 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-inherit/30 shadow-sm w-full transition-colors"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-full shrink-0"></div>
            <div className="flex flex-col gap-2 flex-1">
              <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-1/3"></div>
              <div className="h-2 bg-black/10 dark:bg-white/10 rounded w-1/4"></div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-full"></div>
            <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-5/6"></div>
            <div className="h-3 bg-black/10 dark:bg-white/10 rounded w-4/6"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
