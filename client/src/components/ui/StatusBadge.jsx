import React from "react";

const STATUS_STYLE_MAP = {
  Approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Rejected: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  Active: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  Inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  default: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const StatusBadge = ({ status = "Unknown" }) => {
  const normalized = String(status || "Unknown");
  const classes = STATUS_STYLE_MAP[normalized] || STATUS_STYLE_MAP.default;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold tracking-wide border shadow-sm ${classes}`}>
      <span className="sr-only">Status: </span>
      {normalized}
    </span>
  );
};

export default StatusBadge;
