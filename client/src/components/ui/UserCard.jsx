import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import UserInfo from "./UserInfo";
import { getCardThemeClasses } from "@/utils/themeUtils";
import { getUserSubtitle } from "@/utils/userUtils";

const UserCard = ({
  user,
  subtitle,
  leftElement,
  rightElement,
  avatarSize = "w-10 h-10",
  className = "",
  to,
  onClick,
  showText = true,
  infoClassName = "",
}) => {
  const { appTheme } = useTheme();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl shadow-sm border transition-all ${getCardThemeClasses(appTheme)} ${className}`}
    >
      {leftElement && (
        <div className="shrink-0 flex items-center justify-center">
          {leftElement}
        </div>
      )}

      {to ? (
        <Link to={to} className="flex-1 min-w-0 hover:no-underline">
          <UserInfo
            user={user}
            subtitle={subtitle !== undefined ? subtitle : getUserSubtitle(user)}
            avatarSize={avatarSize}
            className={`cursor-pointer group ${infoClassName}`}
            nameClassName="group-hover:opacity-80 transition-colors"
            showText={showText}
          />
        </Link>
      ) : onClick ? (
        <button onClick={onClick} className="flex-1 min-w-0 text-left">
          <UserInfo
            user={user}
            subtitle={subtitle !== undefined ? subtitle : getUserSubtitle(user)}
            avatarSize={avatarSize}
            className={`cursor-pointer group ${infoClassName}`}
            nameClassName="group-hover:opacity-80 transition-colors"
            showText={showText}
          />
        </button>
      ) : (
        <UserInfo
          user={user}
          subtitle={subtitle !== undefined ? subtitle : getUserSubtitle(user)}
          avatarSize={avatarSize}
          className={`flex-1 min-w-0 ${infoClassName}`}
          showText={showText}
        />
      )}

      {rightElement && (
        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end w-full sm:w-auto gap-2 mt-2 sm:mt-0">
          {rightElement}
        </div>
      )}
    </div>
  );
};

export default UserCard;
