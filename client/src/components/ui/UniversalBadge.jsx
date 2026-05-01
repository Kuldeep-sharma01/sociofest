import React from "react";

/**
 * UniversalBadge Component
 * Automatically detects the context of the badge based on text or explicit type.
 */
const UniversalBadge = ({ text, type, className = "", icon: Icon }) => {
  const getBadgeStyles = () => {
    const label = (text || "").toLowerCase();
    
    // 1. Success / Positive
    if (type === "success" || ["approved", "active", "ongoing", "verified", "correct", "public event", "accepted"].includes(label)) {
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    }
    
    // 2. Warning / Pending
    if (type === "warning" || ["pending", "upcoming", "retake", "study plan"].includes(label)) {
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
    }
    
    // 3. Danger / Critical
    if (type === "danger" || ["rejected", "blocked", "closed", "incorrect", "admin", "competition", "overdue"].includes(label)) {
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    }
    
    // 4. Primary / Role Info
    if (type === "primary" || ["teacher", "seminar", "student", "workshop"].includes(label)) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }

    // 5. Secondary / Specialized
    if (type === "secondary" || ["hod", "personal"].includes(label)) {
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    }

    // 6. Tertiary / Dark
    if (type === "tertiary" || ["festival", "orange"].includes(label)) {
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    }

    // Default / Neutral
    return "bg-black/5 dark:bg-white/5 text-inherit border-inherit/30";
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border shadow-sm flex items-center w-fit gap-1 transition-colors ${getBadgeStyles()} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      <span className="sr-only">Badge: </span>
      {text}
    </span>
  );
};

export default UniversalBadge;
