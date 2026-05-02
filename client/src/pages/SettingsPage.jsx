import React, { useState, useEffect } from 'react';
import EmailManager from '@/components/settings/EmailManager';
import VoiceSettings from '@/components/settings/VoiceSettings';
import { useSelector } from 'react-redux';
import { getUserById } from '@/services/userService';
import { useTheme } from '@/context/ThemeContext';
import { Spinner } from '@/components/ui/spinner';
import { getCardThemeClasses } from '@/utils/themeUtils';

const SettingsPage = () => {
  const user = useSelector((state) => state.auth.user);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const { appTheme } = useTheme();

  // ✅ Use user._id as the sole dependency, not the full user object
  const userId = user?._id || user?.id;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    
    const controller = new AbortController();
    setLoading(true);
    getUserById(userId, controller.signal)
      .then(setUserDetails)
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to load account settings. ❌" }));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      
    return () => controller.abort();
  }, [userId]);

  const handleUserUpdate = (updatedUser) => {
    setUserDetails(updatedUser);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
        <h1 className="text-3xl font-bold text-inherit mb-6">Account Settings</h1>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner className="w-8 h-8 text-current opacity-70" />
          </div>
        ) : userDetails ? (
          <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            <div className={`p-6 rounded-2xl border border-inherit/20 shadow-xl ${getCardThemeClasses(appTheme)}`}>
              <EmailManager user={userDetails} setUser={handleUserUpdate} />
            </div>
            
            <div className={`p-6 rounded-2xl border border-inherit/20 shadow-xl ${getCardThemeClasses(appTheme)}`}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                Voice & Identity
              </h2>
              <VoiceSettings user={userDetails} />
            </div>
          </div>
        ) : (
          <div className={`p-8 text-center rounded-xl border border-inherit/20 shadow-sm ${getCardThemeClasses(appTheme)}`}>
            <p className="text-inherit opacity-70 font-medium">Could not load user data.</p>
          </div>
        )}
      </div>
  );
};

export default SettingsPage;
