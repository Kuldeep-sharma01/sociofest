import React from 'react';
import { useTheme } from "@/context/ThemeContext";
import { getPrimaryButtonClasses, getCardThemeClasses } from "@/utils/themeUtils";

const roles = ['Student', 'Teacher', 'HOD', 'Admin'];

export default function RoleSelector({ selectedRole, setSelectedRole }) {
  const { appTheme } = useTheme();

  return (
    <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
      <h2 className="text-xl font-bold mb-4 text-inherit text-center">Select Your Role</h2>
      <div className="grid grid-cols-2 gap-3">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-sm ${selectedRole === role ? getPrimaryButtonClasses(appTheme) : "bg-black/5 dark:bg-white/5 text-inherit hover:bg-black/10 dark:hover:bg-white/10 border border-inherit/30"}`}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}
