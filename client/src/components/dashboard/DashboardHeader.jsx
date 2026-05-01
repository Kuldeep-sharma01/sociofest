import React from "react";
import { useTheme } from "@/context/ThemeContext";
import { getBannerThemeClasses } from "@/utils/themeUtils";

const DashboardHeader = ({
  icon: Icon,
  title,
  subtitle,
  gradientClass = "from-blue-600 to-indigo-700",
}) => {
  const { appTheme } = useTheme();
  const defaultGradient = `bg-gradient-to-r ${gradientClass} text-white`;

  return (
    <div
      className={`${getBannerThemeClasses(appTheme, defaultGradient)} rounded-3xl p-8 shadow-lg relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
        {Icon && <Icon className="w-64 h-64" />}
      </div>
      <div className="relative z-10">
        <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3 text-inherit">
          {title}
        </h1>
        <p className="mt-2 text-base md:text-lg font-medium max-w-xl text-inherit opacity-80">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
