import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, AlertCircle, ArrowLeft, KeyRound } from "lucide-react";
import { useDispatch } from "react-redux";
import { login } from "@/redux/authSlice";
import { loginUser, oauthLogin, requestPasswordReset, resetPassword, verifyResetOtp, verifyOTP, resendVerificationOTP } from "@/services/userService";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/config/firebase";
import { signInWithPopup, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { getWrapperThemeClasses, getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
const logo = "/sociofest_transparent_logo.png";

// ✅ Map all known Firebase error codes to user-friendly messages
const FIREBASE_ERROR_MESSAGES = {
  'auth/popup-closed-by-user':     'Login cancelled. You closed the popup too early.',
  'auth/popup-blocked':            'Popup was blocked. Please allow popups for this site.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email.',
  'auth/network-request-failed':   'Network error. Check your connection and try again.',
  'auth/cancelled-popup-request':  'Another popup is already open.',
  'auth/user-disabled':            'This account has been disabled. Contact support.',
};

export const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { appTheme } = useTheme();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Password Reset State
  const [view, setView] = useState("login"); // 'login' | 'forgot' | 'verify' | 'reset'
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [unverifiedUserId, setUnverifiedUserId] = useState(null);
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await loginUser(formData);
      
      if (data.requiresOTP) {
        setUnverifiedUserId(data.userId);
        setView("verifyEmail");
        setResendTimer(60);
        return;
      }
      
      // Dispatch Redux action which also handles localStorage automatically
      dispatch(login({ user: data.user, token: data.token }));
      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      setErrorMsg(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (providerName) => {
    try {
      let authProvider;
      if (providerName === 'Google') authProvider = new GoogleAuthProvider();
      else if (providerName === 'GitHub') authProvider = new GithubAuthProvider();
      else if (providerName === 'Facebook') authProvider = new FacebookAuthProvider();

      const result = await signInWithPopup(auth, authProvider);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const data = await oauthLogin({
        name: fbUser.displayName || `User`,
        email: fbUser.email,
        profilePicture: fbUser.photoURL,
      }, idToken);

      dispatch(login({ user: data.user, token: data.token }));
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const userMsg = FIREBASE_ERROR_MESSAGES[err.code]
        ?? (err.response ? err.response.data?.message : null)
        ?? 'Authentication failed. Please try again.';
      setErrorMsg(userMsg);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      await requestPasswordReset(resetEmail);
      setView("verify");
      setResendTimer(60);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "OTP sent to your email! 📧" }));
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await verifyResetOtp({ email: resetEmail, otp: resetOtp });
      setResetToken(data.resetToken);
      setView("reset");
      window.dispatchEvent(new CustomEvent("showToast", { detail: "OTP verified! Please enter your new password. 🔑" }));
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const [emailFromToken, otpFromToken] = String(resetToken || "").split(":");
      await resetPassword({
        email: emailFromToken || resetEmail,
        otp: otpFromToken || resetOtp,
        newPassword,
      });
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Password reset successfully! You can now log in. 🎉" }));
      setView("login");
      setResetEmail("");
      setResetOtp("");
      setNewPassword("");
      setResetToken("");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      await verifyOTP({ email: formData.email, otp: otpCode });
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Email verified successfully! You can now log in. 🎉" }));
      setView("login");
      setOtpCode("");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await resendVerificationOTP(unverifiedUserId);
      setResendTimer(60);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "New verification code sent! 📧" }));
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-[calc(100dvh-64px)] flex items-center justify-center p-4 transition-colors duration-500 ${getWrapperThemeClasses(appTheme)} w-full`}>
      
      {view === "forgot" && (
        <form onSubmit={handleForgotPassword} className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-md flex flex-col gap-4 transition-colors duration-300 animate-in fade-in zoom-in-95`}>
          <button type="button" onClick={() => setView("login")} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors opacity-70 hover:opacity-100 -ml-2 -mt-2">
             <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
             <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-80 text-inherit" />
             <h2 className="text-2xl font-bold text-inherit mb-2">Reset Password</h2>
             <p className="text-sm opacity-80 font-medium">Enter your email address and we'll send you a 6-digit recovery code.</p>
          </div>
          <ErrorAlert message={errorMsg} />
          
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
            required
          />

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || !resetEmail}
              className={`w-full py-2 h-11 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
            >
              {loading ? (
                <div
                  className="loader mx-auto"
                  style={{ "--s": "15px", "--g": "3px" }}
                ></div>
              ) : "Send Reset Code"}
            </button>
          </div>
        </form>
      )}

      {view === "verify" && (
        <form onSubmit={handleVerifyResetOtp} className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-md flex flex-col gap-4 transition-colors duration-300 animate-in fade-in zoom-in-95`}>
          <div className="text-center">
             <Lock className="w-12 h-12 mx-auto mb-3 opacity-80 text-inherit" />
             <h2 className="text-2xl font-bold text-inherit mb-2">Verify OTP</h2>
             <p className="text-sm opacity-80 font-medium">Please enter the 6-digit code sent to <b>{resetEmail}</b></p>
          </div>
          <ErrorAlert message={errorMsg} />
          
          <input
            type="text"
            value={resetOtp}
            onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="6-Digit OTP"
            maxLength={6}
            className="w-full text-center text-2xl tracking-[0.5em] font-mono px-3 py-3 border border-inherit/30 rounded-xl bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
            required
          />

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || resetOtp.length < 6}
              className={`w-full py-2 h-11 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
            >
              {loading ? (
                <div
                  className="loader mx-auto"
                  style={{ "--s": "15px", "--g": "3px" }}
                ></div>
              ) : "Verify Code"}
            </button>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resendTimer > 0 || loading}
              className="text-sm text-blue-500 hover:text-blue-600 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
            </button>
            <button
              type="button"
              onClick={() => setView("forgot")}
              className="text-sm text-inherit opacity-70 hover:opacity-100 font-bold transition-colors"
            >
              Change Email
            </button>
          </div>
        </form>
      )}

      {view === "reset" && (
        <form onSubmit={handleResetPassword} className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-md flex flex-col gap-4 transition-colors duration-300 animate-in fade-in zoom-in-95`}>
          <div className="text-center">
             <Lock className="w-12 h-12 mx-auto mb-3 opacity-80 text-inherit" />
             <h2 className="text-2xl font-bold text-inherit mb-2">Create New Password</h2>
             <p className="text-sm opacity-80 font-medium">Please enter your new password below.</p>
          </div>
          <ErrorAlert message={errorMsg} />
          
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
            required
          />

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || !newPassword}
              className={`w-full py-2 h-11 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
            >
              {loading ? (
                <div
                  className="loader mx-auto"
                  style={{ "--s": "15px", "--g": "3px" }}
                ></div>
              ) : "Reset Password & Login"}
            </button>
          </div>
        </form>
      )}

      {view === "verifyEmail" && (
        <form onSubmit={handleVerifyEmail} className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-md flex flex-col gap-4 transition-colors duration-300 animate-in fade-in zoom-in-95`}>
           <button type="button" onClick={() => setView("login")} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors opacity-70 hover:opacity-100 -ml-2 -mt-2 w-fit">
             <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
             <Lock className="w-12 h-12 mx-auto mb-3 opacity-80 text-inherit" />
             <h2 className="text-2xl font-bold text-inherit mb-2">Verify Your Account</h2>
             <p className="text-sm opacity-80 font-medium">Please enter the 6-digit code sent to <b>{formData.email}</b> to complete your registration.</p>
          </div>
          <ErrorAlert message={errorMsg} />
          
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="6-Digit OTP"
            maxLength={6}
            className="w-full text-center text-2xl tracking-[0.5em] font-mono px-3 py-3 border border-inherit/30 rounded-xl bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
            required
          />

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className={`w-full py-2 h-11 rounded-lg font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
            >
              {loading ? (
                <div
                  className="loader mx-auto"
                  style={{ "--s": "15px", "--g": "3px" }}
                ></div>
              ) : "Verify & Activate"}
            </button>
          </div>
          
          <div className="flex flex-col gap-2 items-center mt-4">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendTimer > 0 || loading}
              className="text-sm text-blue-500 hover:text-blue-600 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Verification Code"}
            </button>
          </div>
        </form>
      )}

      {view === "login" && (
      <form
        onSubmit={handleLogin}
        className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-xl flex flex-col gap-4 transition-colors duration-300`}
      >
        <div className="mx-auto w-14 h-14 rounded-full text-white flex items-center justify-center text-2xl font-bold shadow-md">
          <img
            referrerPolicy="no-referrer"
            src={logo}
            alt="SocioFest Logo"
            className="w-10 h-10 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <p className="w-full text-center text-sm opacity-80 font-medium">
          Login to continue to <span className="font-bold text-inherit">SocioFest</span>
        </p>
        <ErrorAlert message={errorMsg} />

        <div className="flex flex-col gap-3 pb-2">
          <button type="button" onClick={() => handleOAuthLogin('Google')} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" /> Continue with Google
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleOAuthLogin('GitHub')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
              <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-4 h-4" alt="GitHub" /> GitHub
            </button>
            <button type="button" onClick={() => handleOAuthLogin('Facebook')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
              <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-4 h-4" alt="Facebook" /> Facebook
            </button>
          </div>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-inherit/30"></div>
            <span className="flex-shrink-0 mx-4 text-inherit opacity-50 text-[10px] font-bold uppercase tracking-widest">Or login with email</span>
            <div className="flex-grow border-t border-inherit/30"></div>
          </div>
        </div>

        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
          required
        />

        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
          className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
          required
        />

        <div className="flex justify-end mt-1">
           <button type="button" onClick={() => { setView("forgot"); setResetEmail(formData.email); }} className="text-xs font-bold text-inherit opacity-70 hover:opacity-100 hover:underline transition-colors">
             Forgot Password?
           </button>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 h-11 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
          >
            {loading ? (
              <div
                className="loader mx-auto"
                style={{ "--s": "15px", "--g": "3px" }}
              ></div>
            ) : (
              "Login"
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-sm text-center font-medium opacity-80">
          Don’t have an account?{" "}
          <Link
            to="/signup"
              className="text-blue-500 hover:text-blue-600 font-bold hover:no-underline transition-colors"
          >
            Create one
          </Link>
        </p>
      </form>
      )}
    </div>
  );
};

export default Login;
