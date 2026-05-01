import React from "react";
import { CheckCircle } from "lucide-react";

const SuccessAlert = ({ message, className = "" }) => {
  if (!message) return null;

  return (
    <div
      className={`bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in transition-colors ${className}`}
    >
      <CheckCircle className="w-5 h-5 shrink-0" />
      <p className="font-medium text-sm">{message}</p>
    </div>
  );
};

export default SuccessAlert;
