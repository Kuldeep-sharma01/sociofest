export const getPrimaryEmail = (user) => {
  if (!user) return "";
  if (user.email) return user.email;
  if (user.emails && user.emails.length > 0) return user.emails[0].address;
  return "";
};

export const getUserSubtitle = (user) => {
  if (!user) return "";
  if (user.isGroup) return `${user.participants?.length || 0} Members`;
  const roleStr = user.role || "";
  const deptStr = user.department?.name ? `• ${user.department.name}` : "";
  return `${roleStr} ${deptStr}`.trim();
};
