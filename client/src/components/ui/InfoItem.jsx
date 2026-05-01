import React from "react";

const InfoItem = ({
  icon: Icon,
  label,
  value,
  colorClass = "text-blue-600 bg-blue-50",
}) => {
  return (
    <div className="flex items-center gap-4 p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-inherit/30 shadow-sm hover:shadow-md transition-all duration-300 group text-inherit">
      <div
        className={`p-3 rounded-xl ${colorClass} bg-opacity-20 group-hover:scale-110 transition-transform duration-300 shrink-0`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold opacity-60 uppercase tracking-wider mb-0.5 text-inherit">
          {label}
        </p>
        <p className="font-semibold text-inherit text-sm md:text-base truncate">
          {value || "N/A"}
        </p>
      </div>
    </div>
  );
};

export default InfoItem;
