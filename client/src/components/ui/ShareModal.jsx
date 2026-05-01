import React from "react";
import { createPortal } from "react-dom";
import { X, Send } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import UserInfo from "./UserInfo";
import { getCardThemeClasses } from "@/utils/themeUtils";

const ShareModal = ({ isOpen, onClose, users, onShare }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <ShareModalContent users={users} onShare={onShare} onClose={onClose} />
    </div>,
    document.body
  );
};

const ShareModalContent = ({ users = [], onShare, onClose }) => {
  const { appTheme } = useTheme();


  return (
    <div className={`${getCardThemeClasses(appTheme)} rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200`}>
      <div className="p-4 border-b flex justify-between items-center bg-black/5 dark:bg-white/5">
        <h3 className="font-bold text-lg text-inherit">Share as Message</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-inherit opacity-70" />
        </button>
      </div>
      <div className="p-4 max-h-80 overflow-y-auto flex flex-col gap-2">
        {users.length === 0 ? (
          <p className="text-center opacity-70 py-4">
            No recent conversations found.
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u._id}
              className="flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg border border-transparent hover:border-inherit/30 transition-all cursor-pointer w-full"
              onClick={() => {
                onShare(u._id);
                window.dispatchEvent(new CustomEvent("showToast", { detail: "Shared successfully! 🚀" }));
                onClose();
              }}
            >
              <UserInfo 
                user={u} 
                subtitle={u.role} 
                nameClassName="text-inherit" 
                subtitleClassName="opacity-70" 
              />
              <Send className="w-4 h-4 text-blue-500" />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ShareModal;
export { ShareModalContent };
