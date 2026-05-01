import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert, MailPlus, Send } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import {
  getCardThemeClasses,
  getPrimaryButtonClasses,
} from "@/utils/themeUtils";
import { addEmail, verifyNewEmail } from "@/services/userService";

/**
 * A component to manage a user's email addresses.
 * NOTE: This component assumes it is rendered within a context that provides
 * the `user` object and a function to update it (`setUser`). It also assumes
 * you have a utility for making API calls (e.g., an axios instance).
 *
 * @param {object} props
 * @param {object} props.user The current logged-in user object.
 * @param {function} props.setUser Function to update the user object in the parent state/context.
 * @param {object} props.api Your API client (e.g., axios instance).
 */
const EmailManager = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState("");
  const [otpValues, setOtpValues] = useState({});
  // ✅ Use a granular loading state keyed by operation
  const [loading, setLoading] = useState({ addEmail: false });
  const { appTheme } = useTheme();

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Please enter an email address. ⚠️" }));
      return;
    }
    setLoading((prev) => ({ ...prev, addEmail: true }));
    try {
      const data = await addEmail(newEmail);
      if (setUser) {
        setUser(data.user); // Update user state with the new emails array
      }
      // ✅ Use safe, user-facing fallback messages; never surface raw server/DB errors
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Verification email sent! Check your inbox. ✅" }));
      setNewEmail("");
    } catch (err) {
      const friendlyError =
        err.response?.status === 409 ? "This email is already linked to an account." :
        err.response?.status === 422 ? "Please enter a valid email address." :
        "Failed to add email. Please try again.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${friendlyError} ❌` }));
    } finally {
      setLoading((prev) => ({ ...prev, addEmail: false }));
    }
  };

  const handleVerifyEmail = async (email, otp) => {
    if (!otp) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Please enter the OTP for ${email}. ⚠️` }));
      return;
    }
    setLoading((prev) => ({ ...prev, [email]: true }));
    try {
      const data = await verifyNewEmail({ email, otp });
      if (setUser) {
        setUser(data.user);
      }
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Email verified successfully! 🎉" }));
      setOtpValues((prev) => ({ ...prev, [email]: "" })); // Clear OTP input on success
      
      // Redirect to dashboard after successful actual email verification
      navigate("/dashboard");
    } catch (err) {
      const friendlyError = err.response?.status === 400 ? "Invalid or expired OTP." : "Failed to verify email. Please try again.";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${friendlyError} ❌` }));
    } finally {
      setLoading((prev) => ({ ...prev, [email]: false }));
    }
  };

  const handleOtpChange = (email, value) => {
    setOtpValues((prev) => ({ ...prev, [email]: value }));
  };

  if (!user) return <div>Loading user profile...</div>;

  return (
    <div
      className={`p-6 rounded-lg shadow-md border ${getCardThemeClasses(appTheme)}`}
    >
      <h2 className="text-2xl font-bold mb-4 text-inherit">
        Manage Email Addresses
      </h2>

      <div className="flex flex-col gap-4 mb-6">
        <h3 className="text-lg font-semibold text-inherit opacity-80">
          Your Emails
        </h3>
        {user.emails?.map((email, index) => (
          <div
            key={index}
            className="p-4 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit"
          >
            <div className="flex justify-between items-center">
              <span className="font-medium text-inherit">{email.address}</span>
              {email.isVerified ? (
                <span className="flex items-center text-sm text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded-full">
                  <ShieldCheck className="w-4 h-4 mr-1" /> Verified
                </span>
              ) : (
                <span className="flex items-center text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full">
                  <ShieldAlert className="w-4 h-4 mr-1" /> Pending Verification
                </span>
              )}
            </div>
            {!email.isVerified && (
              <div className="mt-3 flex items-center gap-2 text-inherit">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otpValues[email.address] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    handleOtpChange(email.address, val);
                  }}
                  className="flex-grow px-3 py-2 rounded-md border border-inherit/30 bg-transparent text-inherit focus:outline-none focus:ring-2 focus:ring-current"
                />
                <button
                  onClick={() =>
                    handleVerifyEmail(email.address, otpValues[email.address])
                  }
                  disabled={loading[email.address]}
                  className={`px-4 py-2 font-semibold rounded-md transition-colors flex items-center shadow-sm disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
                >
                  <Send className="w-4 h-4 mr-2" /> Verify
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-inherit/20 pt-6">
        <h3 className="text-lg font-semibold text-inherit opacity-80 mb-2">
          Add a New Email
        </h3>
        <form
          onSubmit={handleAddEmail}
          className="flex items-center gap-2 text-inherit"
        >
          <input
            type="email"
            placeholder="your.new.email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-grow px-4 py-2 rounded-md border border-inherit/30 bg-transparent text-inherit focus:outline-none focus:ring-2 focus:ring-current"
          />
          <button
            type="submit"
            disabled={loading.addEmail}
            className={`px-4 py-2 font-semibold rounded-md transition-colors flex items-center shadow-sm disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
          >
            <MailPlus className="w-4 h-4 mr-2" /> Add Email
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmailManager;
