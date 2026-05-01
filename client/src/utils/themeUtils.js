export const getCardThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-[#e9edef] dark:border-[#222d34] text-[#111b21] dark:text-[#e9edef]";
    case "discord": return "bg-[#2b2d31] text-gray-100 border-[#1e1f22]";
    case "midnight": return "bg-slate-900 text-slate-100 border-slate-800";
    case "hacker": return "bg-black border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] border-pink-900 text-pink-400";
    case "dracula": return "bg-[#44475a] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#f0f9ff] border-[#bae6fd] text-[#0c4a6e]";
    default: return "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100";
  }
};

export const getPrimaryButtonClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent";
    case "discord": return "bg-indigo-500 hover:bg-indigo-600 text-white border-transparent";
    case "midnight": return "bg-sky-600 hover:bg-sky-700 text-white border-transparent";
    case "hacker": return "bg-green-600 hover:bg-green-700 text-black border-transparent";
    case "sunset": return "bg-orange-500 hover:bg-orange-600 text-white border-transparent";
    case "cyberpunk": return "bg-pink-600 hover:bg-pink-700 text-white border-transparent";
    case "dracula": return "bg-purple-600 hover:bg-purple-700 text-white border-transparent";
    case "ocean": return "bg-cyan-600 hover:bg-cyan-700 text-white border-transparent";
    default: return "bg-blue-600 hover:bg-blue-700 text-white border-transparent";
  }
};

export const getBannerThemeClasses = (appTheme, defaultGradient = "bg-gradient-to-r from-blue-600 to-indigo-700 text-white") => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#00a884] dark:bg-[#202c33] text-white";
    case "discord": return "bg-[#1e1f22] text-gray-100 border border-[#1e1f22]";
    case "midnight": return "bg-slate-900 border border-slate-800 text-slate-100";
    case "hacker": return "bg-green-900/20 border border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-pink-900/20 border border-pink-900 text-pink-400";
    case "dracula": return "bg-[#44475a] border border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#0ea5e9] border border-[#0284c7] text-white";
    default: return defaultGradient;
  }
};

export const getWrapperThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#efeae2] dark:bg-[#0b141a] text-[#111b21] dark:text-[#e9edef]";
    case "discord": return "bg-[#313338] text-gray-100";
    case "midnight": return "bg-slate-950 text-slate-100";
    case "hacker": return "bg-black text-green-500";
    case "sunset": return "bg-[#fffcf9] text-orange-900";
    case "cyberpunk": return "bg-[#050505] text-pink-400";
    case "dracula": return "bg-[#282a36] text-[#f8f8f2]";
    case "ocean": return "bg-[#f0f9ff] text-[#0c4a6e]";
    default: return "bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100";
  }
};

export const getNavbarThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
    case "discord": return "bg-[#1e1f22] border-[#1e1f22] text-gray-100";
    case "midnight": return "bg-slate-900 border-slate-800 text-slate-100";
    case "hacker": return "bg-green-900/20 border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-pink-900/20 border-pink-900 text-pink-400";
    case "dracula": return "bg-[#282a36] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#bae6fd] border-[#7dd3fc] text-[#0c4a6e]";
    default: return "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
  }
};

export const getSidebarThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-white dark:bg-[#111b21] border-[#e9edef] dark:border-[#222d34]";
    case "discord": return "bg-[#2b2d31] border-[#1e1f22] text-gray-100";
    case "midnight": return "bg-slate-950 border-slate-900 text-slate-100";
    case "hacker": return "bg-black border-green-900 text-green-500";
    case "sunset": return "bg-[#fff5eb] border-[#fed7aa] text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] border-[#831843] text-pink-400";
    case "dracula": return "bg-[#282a36] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#f0f9ff] border-[#bae6fd] text-[#0c4a6e]";
    default: return "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
  }
};

export const getOptionClasses = (appTheme, isDark) => {
  switch (appTheme) {
    case "whatsapp": return isDark ? "bg-[#111b21] text-[#e9edef]" : "bg-white text-[#111b21]";
    case "discord": return "bg-[#2b2d31] text-gray-100";
    case "midnight": return "bg-slate-900 text-slate-100";
    case "hacker": return "bg-black text-green-500";
    case "sunset": return "bg-[#ffedd5] text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] text-pink-400";
    case "dracula": return "bg-[#44475a] text-[#f8f8f2]";
    case "ocean": return "bg-[#f0f9ff] text-[#0c4a6e]";
    default: return isDark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-900";
  }
};

export const getPanelTheme = (appTheme) => {
  switch (appTheme) {
    case "hacker": return "bg-black/90 text-green-400 border-green-900/50";
    case "cyberpunk": return "bg-[#0f0f13]/90 text-pink-400 border-pink-900/50";
    case "dracula": return "bg-[#282a36]/90 text-[#f8f8f2] border-[#6272a4]/50";
    case "discord": return "bg-[#2b2d31]/90 text-gray-100 border-[#1e1f22]";
    case "midnight": return "bg-slate-900/90 text-sky-100 border-slate-700/50";
    case "ocean": return "bg-[#082f49]/90 text-cyan-100 border-cyan-900/50";
    case "sunset": return "bg-[#431407]/90 text-orange-200 border-orange-900/50";
    case "whatsapp": return "bg-[#111b21]/90 text-[#e9edef] border-[#222d34]";
    default: return "bg-black/80 text-white border-white/10";
  }
};

export const getModalBg = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-[#e9edef] dark:border-[#222d34] text-[#111b21] dark:text-[#e9edef]";
    case "discord": return "bg-[#2b2d31] text-gray-100 border-[#1e1f22]";
    case "midnight": return "bg-slate-900 text-slate-100 border-slate-800";
    case "hacker": return "bg-black border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] border-pink-900 text-pink-400";
    case "dracula": return "bg-[#44475a] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-white border-[#7dd3fc] text-[#0c4a6e]";
    default: return "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-100 dark:border-gray-800";
  }
};

export const getModalHeaderBg = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-[#e9edef] dark:border-[#222d34] text-[#111b21] dark:text-[#e9edef]";
    case "discord": return "bg-[#1e1f22] border-[#1e1f22] text-gray-100";
    case "midnight": return "bg-slate-950 border-slate-800 text-slate-100";
    case "hacker": return "bg-green-900/20 border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-pink-900/20 border-pink-900 text-pink-400";
    case "dracula": return "bg-[#282a36] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#bae6fd] border-[#7dd3fc] text-[#0c4a6e]";
    default: return "bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100";
  }
};

export const getThemeSoftBg = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#00a884]/10";
    case "discord": return "bg-white/10 dark:bg-white/5";
    case "midnight": return "bg-blue-500/10";
    case "hacker": return "bg-green-500/10";
    case "sunset": return "bg-orange-500/10";
    case "cyberpunk": return "bg-pink-500/10";
    case "dracula": return "bg-[#bd93f9]/10";
    case "ocean": return "bg-sky-500/10";
    default: return "bg-indigo-500/10";
  }
};

export const getThemeHoverBg = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "hover:bg-[#00a884]/20";
    case "discord": return "hover:bg-white/20 dark:hover:bg-white/10";
    case "midnight": return "hover:bg-blue-500/20";
    case "hacker": return "hover:bg-green-500/20";
    case "sunset": return "hover:bg-orange-500/20";
    case "cyberpunk": return "hover:bg-pink-500/20";
    case "dracula": return "hover:bg-[#bd93f9]/20";
    case "ocean": return "hover:bg-sky-500/20";
    default: return "hover:bg-indigo-500/20";
  }
};

export const getStatusColor = (status) => {
  switch (String(status).toLowerCase()) {
    case "present":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200";
    case "absent":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200";
    case "late":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200";
    case "excused":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200";
    case "approved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-200";
  }
};

export const getChatWindowBg = (chatTheme) => {
  switch (chatTheme) {
    case "whatsapp": return "bg-[#efeae2] dark:bg-[#0b141a] text-gray-900 dark:text-gray-100";
    case "discord": return "bg-[#313338] text-gray-100";
    case "midnight": return "bg-slate-950 text-slate-100";
    case "hacker": return "bg-black text-green-500";
    case "sunset": return "bg-[#fffcf9] text-orange-900";
    case "cyberpunk": return "bg-[#050505] text-pink-400";
    case "dracula": return "bg-[#282a36] text-[#f8f8f2]";
    case "ocean": return "bg-[#f0f9ff] text-[#0c4a6e]";
    default: return "bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100";
  }
};

export const getChatHeaderBg = (chatTheme) => {
  switch (chatTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
    case "discord": return "bg-[#2b2d31] border-[#1e1f22] text-gray-100";
    case "midnight": return "bg-slate-900 border-slate-800 text-slate-100";
    case "hacker": return "bg-black border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] border-pink-900 text-pink-400";
    case "dracula": return "bg-[#282a36] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-white border-[#bae6fd] text-[#0c4a6e]";
    default: return "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
  }
};

export const getChatComposerBg = (chatTheme) => {
  switch (chatTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
    case "discord": return "bg-[#2b2d31] border-[#1e1f22] text-gray-100";
    case "midnight": return "bg-slate-900 border-slate-800 text-slate-100";
    case "hacker": return "bg-black border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-[#0f0f13] border-pink-900 text-pink-400";
    case "dracula": return "bg-[#44475a] border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-white border-[#bae6fd] text-[#0c4a6e]";
    default: return "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100";
  }
};

export const getBubbleClasses = (chatTheme, isMe) => {
  if (chatTheme === "whatsapp") return isMe ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100" : "bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-transparent";
  if (chatTheme === "discord") return isMe ? "bg-[#2b2d31] text-gray-100 border border-transparent" : "bg-[#2b2d31] text-gray-100 border border-transparent";
  if (chatTheme === "midnight") return isMe ? "bg-blue-600 text-white border border-transparent" : "bg-slate-800 text-white border border-transparent";
  if (chatTheme === "hacker") return isMe ? "bg-green-900/40 border border-green-500/50 text-green-400" : "bg-black border border-green-800 text-green-500";
  if (chatTheme === "sunset") return isMe ? "bg-orange-200 text-orange-900 border border-orange-300" : "bg-white text-orange-900 border border-orange-200";
  if (chatTheme === "cyberpunk") return isMe ? "bg-pink-600 text-white border border-pink-500" : "bg-gray-900 text-pink-400 border border-pink-800";
  if (chatTheme === "dracula") return isMe ? "bg-[#ff79c6] text-[#282a36] border border-transparent" : "bg-[#44475a] text-[#f8f8f2] border border-[#6272a4]";
  if (chatTheme === "ocean") return isMe ? "bg-[#0ea5e9] text-white border border-[#38bdf8]" : "bg-white text-[#0c4a6e] border border-[#bae6fd]";
  return isMe ? "bg-indigo-200 dark:bg-indigo-600/90 text-black dark:text-indigo-50 border border-indigo-100 dark:border-indigo-700/50" : "bg-white dark:bg-gray-800 text-black dark:text-gray-100 border border-gray-100 dark:border-gray-700";
};

export const getAvatarThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#00a884]";
    case "discord": return "bg-[#5865f2]";
    case "midnight": return "bg-sky-600";
    case "hacker": return "bg-green-600";
    case "sunset": return "bg-orange-500";
    case "cyberpunk": return "bg-pink-600";
    case "dracula": return "bg-purple-600";
    case "ocean": return "bg-cyan-500";
    default: return "bg-gradient-to-tr from-blue-500 to-purple-600";
  }
};

export const getHeaderThemeClasses = (appTheme) => {
  switch (appTheme) {
    case "whatsapp": return "bg-[#00a884] dark:bg-[#128c7e] text-white";
    case "discord": return "bg-[#1e1f22] text-gray-100 border-b border-[#1e1f22]";
    case "midnight": return "bg-slate-900 border-b border-slate-800 text-slate-100";
    case "hacker": return "bg-green-900/20 border-b border-green-900 text-green-500";
    case "sunset": return "bg-[#ffedd5] border-b border-orange-200 text-orange-900";
    case "cyberpunk": return "bg-pink-900/20 border-b border-pink-900 text-pink-400";
    case "dracula": return "bg-[#44475a] border-b border-[#6272a4] text-[#f8f8f2]";
    case "ocean": return "bg-[#0ea5e9] border-b border-[#0284c7] text-white";
    default: return "bg-gradient-to-r from-violet-600 to-indigo-700 text-white";
  }
};

export const getRowClasses = (appTheme, role) => {
  if (role === "user") return "";
  switch (appTheme) {
    case "whatsapp": return "bg-[#f0f2f5] dark:bg-[#202c33] border-y border-gray-200 dark:border-gray-800";
    case "discord": return "bg-[#2b2d31] border-y border-[#1e1f22]";
    case "midnight": return "bg-slate-900 border-y border-slate-800";
    case "hacker": return "bg-green-900/10 border-y border-green-900/50";
    case "sunset": return "bg-[#ffedd5] border-y border-orange-200";
    case "cyberpunk": return "bg-pink-900/10 border-y border-pink-900/50";
    case "dracula": return "bg-[#44475a] border-y border-[#6272a4]";
    case "ocean": return "bg-[#e0f2fe] border-y border-[#bae6fd]";
    default: return "bg-gray-50 dark:bg-gray-800/50 border-y border-gray-100 dark:border-gray-800";
  }
};
