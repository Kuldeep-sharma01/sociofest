import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { getSidebarThemeClasses } from "@/utils/themeUtils";

const UniversalSidebar = ({
  isOpen = true,
  isMobile = false,
  isHidden = false,
  onClose,
  className = "",
  children,
}) => {
  const { appTheme } = useTheme();

  return (
    <>
      {/* Shared Mobile Backdrop Overlay */}
      {isMobile && isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={onClose}
        />
      )}
      <div
className={`flex-col shrink-0 transition-all duration-300 ease-out border-r ${getSidebarThemeClasses(appTheme)} ${className} ${isHidden ? '-translate-x-full opacity-0 invisible md:opacity-100 md:visible md:translate-x-0' : ''}`}
      >
        {children}
      </div>
    </>
  );
};

export default UniversalSidebar;
