import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { getAvatarThemeClasses } from "@/utils/themeUtils";

/**
 * UserInfo Component
 * A reusable module for displaying a user's avatar (with theme-based fallback)
 * along with their name and an optional subtitle.
 */
const UserInfo = ({
  user,
  subtitle,
  avatarSize = "w-10 h-10",
  showText = true,
  className = "",
  nameClassName = "",
  subtitleClassName = "",
}) => {
  const { appTheme } = useTheme();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.profilePicture]);

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <div className="relative shrink-0">
        <div
          className={`${avatarSize} rounded-full ${getAvatarThemeClasses(appTheme)} flex items-center justify-center text-white font-bold overflow-hidden transition-colors shadow-sm`}
        >
        {user?.profilePicture && !imgError ? (
            <img
              referrerPolicy="no-referrer"
              src={user.profilePicture}
            alt={user.name || "User avatar"}
              className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            />
          ) : (
            (user?.name || "U").charAt(0).toUpperCase()
          )}
        </div>
        {(user?.isOnline || user?.isDnd) && (
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full ${user?.isDnd ? "bg-red-500" : "bg-green-500"}`}
            title={user?.isDnd ? "Do Not Disturb" : "Online"}
          />
        )}
      </div>
      {showText && (
        <div className="flex-1 min-w-0 text-left">
          <h3 className={`font-semibold text-inherit truncate ${nameClassName}`}>
            {user?.name || "Unknown User"}
          </h3>
          {subtitle && (
            <div className={`text-sm opacity-70 truncate mt-0.5 ${subtitleClassName}`}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserInfo;
