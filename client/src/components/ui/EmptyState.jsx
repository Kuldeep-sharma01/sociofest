import React from "react";

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionButton,
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center p-8 bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-inherit/30 transition-colors ${className}`}
    >
      {Icon && <Icon className="w-12 h-12 opacity-40 mx-auto mb-3 text-inherit" aria-hidden="true" />}
      {title && (
        <h3 className="text-lg font-semibold text-inherit">{title}</h3>
      )}
      {description && (
        <p className="text-sm opacity-70 mt-1 text-inherit">{description}</p>
      )}
      {actionButton && <div className="mt-4">{actionButton}</div>}
    </div>
  );
};

export default EmptyState;
