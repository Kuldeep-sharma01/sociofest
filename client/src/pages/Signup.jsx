import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getDepartments, getDepartmentSemesters, getTeachersByDepartment, registerUser, verifyOTP, resendVerificationOTP } from "@/services/userService";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { useDispatch } from "react-redux";
import { login } from "@/redux/authSlice";
import { auth } from "@/config/firebase";
import { signInWithPopup, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider } from "firebase/auth";

import StudentForm from "./forms/StudentForm";
import TeacherForm from "./forms/TeacherForm";
import HODForm from "./forms/HODForm";
import SellerForm from "./forms/SellerForm";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { useTheme } from "@/context/ThemeContext";
import { getPublicSystemSettings } from "@/services/systemSettingsService";
import * as wifiAPI from "@/services/wifiService";
import { getWrapperThemeClasses, getCardThemeClasses, getPrimaryButtonClasses, getOptionClasses } from "@/utils/themeUtils";
const logo = "/sociofest_transparent_logo.png";

/* ================= BACKGROUND ================= */

function BackgroundWrapper({ children, appTheme }) {

  return (
    <div className={`min-h-[calc(100dvh-64px)] flex items-center justify-center p-4 transition-colors duration-500 ${getWrapperThemeClasses(appTheme)} w-full`}>
      {children}
    </div>
  );
}

/* ================= DEFAULTS ================= */

const DEFAULT_FORM_DATA = {
  name: "",
  email: "",
  password: "",
  department: "",
  role: "",
  bio: "",
  contactNumber: "",
  location: "",
  dob: "",
  skills: "",
};

const DEFAULT_STUDENT_DATA = {
  rollNumber: "",
  semester: "",
};

const DEFAULT_TEACHER_DATA = {
  qualifications: "",
  experience: "",
  subjects: [],
};

const DEFAULT_HOD_DATA = {
  semesters: "",
  tenure: "",
  achievements: "",
};

const DEFAULT_SELLER_DATA = {
  companyName: "",
  businessType: "",
};

// ✅ Validate OAuth profile pictures against trusted hosts
const TRUSTED_AVATAR_HOSTS = [
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'graph.facebook.com',
  'platform-lookaside.fbsbx.com',
];
const isProfilePicTrusted = (url) => {
  if (!url) return false;
  try { return TRUSTED_AVATAR_HOSTS.includes(new URL(url).hostname); }
  catch { return false; }
};

// ✅ Map all known Firebase error codes to user-friendly messages
const FIREBASE_ERROR_MESSAGES = {
  'auth/popup-closed-by-user':     'Signup cancelled. You closed the popup too early.',
  'auth/popup-blocked':            'Popup was blocked. Please allow popups for this site.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email.',
  'auth/network-request-failed':   'Network error. Check your connection and try again.',
  'auth/cancelled-popup-request':  'Another popup is already open.',
  'auth/user-disabled':            'This account has been disabled. Contact support.',
};

/* ================= SIGNUP ================= */

const Signup = ({
  isEditMode = false,
  onSave,
  onCancel,
  initialData = {},
  isUpdating = false,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { appTheme, isDark } = useTheme();
  const [totalSemesters, setTotalSemesters] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hodTeaches, setHodTeaches] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  /* -------- Core User -------- */
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  /* -------- Role Data -------- */
  const [studentData, setStudentData] = useState(DEFAULT_STUDENT_DATA);
  const [teacherData, setTeacherData] = useState(DEFAULT_TEACHER_DATA);
  const [hodData, setHodData] = useState(DEFAULT_HOD_DATA);
  const [sellerData, setSellerData] = useState(DEFAULT_SELLER_DATA);

  /* -------- Shared -------- */
  const [departments, setDepartments] = useState([]);
  const [studentSubjects, setStudentSubjects] = useState([]);
  const [oAuthProfile, setOAuthProfile] = useState(null);
  
  // OTP State
  const [otpStage, setOtpStage] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pendingVerificationToken, setPendingVerificationToken] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  const [sysSettings, setSysSettings] = useState(null);
  const [wifiVerified, setWifiVerified] = useState(true);

  /* ================= EFFECTS ================= */
  const normalizedDepartments = departments
    .map((d) => (typeof d === "object" ? d.name : d))
    .filter((d) => d && typeof d === "string" && d.trim() !== "")
    .map((d) => d.trim())
    .sort((a, b) => a.localeCompare(b));

  // Effect to populate form when in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      // Robust extraction: handles both raw user objects and { user, roleData } structures
      const user = initialData.user || initialData || {};
      const departmentName = (typeof user.department === "object" ? user.department?.name : user.department) || "";

      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
        department: departmentName,
        bio: user.bio || "",
        contactNumber: user.contactNumber || user.phone || "",
        location: user.location || "",
        dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : "",
        skills: Array.isArray(user.skills) ? user.skills.join(", ") : "",
        password: "", // Never pre-fill password
      }));

      // Role specific data extraction
      if (user.role === "Student") {
        const sData = initialData.studentData || user.studentData || initialData || {};
        setStudentData({
          rollNumber: sData.rollNumber || "",
          semester: sData.semester || "",
        });
      }

      const isTeacherOrHod = user.role === "Teacher" || user.role === "HOD";
      if (isTeacherOrHod) {
        const tData = initialData.teacherData || user.teacherData || initialData || {};
        const hasTeachingData =
          tData.qualifications ||
          tData.experience ||
          (tData.subjects && tData.subjects.length > 0);
        
        if (user.role === "HOD" && hasTeachingData) {
          setHodTeaches(true);
        }
        
        setTeacherData({
          qualifications: tData.qualifications || "",
          experience: tData.experience || "",
          subjects: (tData.subjects || []).filter(Boolean).map((s) => ({
            _id: s._id,
            subject: s.name || s.subject || "",
            semester: s.semester,
            code: s.code || "",
          })),
        });
      }

      if (user.role === "HOD") {
        const hData = initialData.hodData || user.hodData || initialData || {};
        setHodData({
          semesters: hData.semesters || "",
          tenure: hData.tenure || "",
          achievements: hData.achievements || ""
        });
      }

      if (user.role === "Seller") {
        const selData = initialData.sellerData || user.sellerData || initialData || {};
        setSellerData({
          companyName: selData.companyName || "",
          businessType: selData.businessType || ""
        });
      }
    }
  }, [isEditMode, initialData]);

  // Load departments for Student / Teacher / HOD
  useEffect(() => {
    if (["Student", "Teacher", "HOD"].includes(formData.role)) {
      getDepartments()
        .then((res) => {
          setDepartments(res.departments || (Array.isArray(res) ? res : []));
        })
        .catch((err) => {
          console.error("Failed to load departments:", err);
          setDepartments([]);
        });
    }
  }, [formData.role]);

  // Load total semesters for the selected department
  useEffect(() => {
    if (
      (formData.role === "Student" || formData.role === "Teacher") &&
      formData.department
    ) {
      getDepartmentSemesters(formData.department)
        .then((res) => {
          setTotalSemesters(res.Semesters || res.semesters || res.totalSemesters || 8);
        })
        .catch((err) => {
          console.error("Failed to load semester count:", err);
          setTotalSemesters(8);
        });
    } else {
      setTotalSemesters(0);
    }
  }, [formData.role, formData.department]);

  // Load subjects for a student when department and semester are selected
  useEffect(() => {
    if (
      formData.role === "Student" &&
      formData.department &&
      studentData.semester
    ) {
      getTeachersByDepartment(formData.department, studentData.semester)
        .then((res) => {
          setStudentSubjects(res.subjects || (Array.isArray(res) ? res : []));
        })
        .catch((err) => {
          console.error("Failed to load subjects for student:", err);
          setStudentSubjects([]);
        });
    } else {
      setStudentSubjects([]);
    }
  }, [formData.role, formData.department, studentData.semester]);

  // Fetch public system settings for dynamic registration policies
  useEffect(() => {
    getPublicSystemSettings().then(async (s) => {
      setSysSettings(s);
      if (s.serviceControls?.registrationRequiresWifi) {
        try {
          const data = await wifiAPI.verifyWifi();
          setWifiVerified(data.verified);
        } catch(e) {
          setWifiVerified(false);
        }
      }
    }).catch(err => console.error("Failed to fetch system settings", err));
  }, []);

  useEffect(() => {
    if (formData.role === "HOD") {
      setTotalSemesters(Number(hodData.semesters) || 0);
    }
  }, [formData.role, hodData.semesters]);

  // OTP Resend Cooldown Timer
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  /* ================= HANDLERS ================= */

  const handleRoleChange = (newRole) => {
    // ✅ Preserve department when switching between roles that share the same department field
    const keepDept =
      ["Student", "Teacher", "HOD"].includes(formData.role) &&
      ["Student", "Teacher", "HOD"].includes(newRole);

    setFormData((prev) => ({
      ...DEFAULT_FORM_DATA,
      name: prev.name,
      email: prev.email,
      password: prev.password,
      role: newRole,
      department: keepDept ? prev.department : "",
    }));

    setStudentData(DEFAULT_STUDENT_DATA);
    setTeacherData({ ...DEFAULT_TEACHER_DATA, subjects: [] });
    setHodData(DEFAULT_HOD_DATA);
    setSellerData(DEFAULT_SELLER_DATA);

    if (!keepDept) {
      setDepartments([]);
    }
    setTotalSemesters(0);
    setHodTeaches(false);
  };

  const handleBaseChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

      const profile = {
        name: fbUser.displayName || `SocioFest User`,
        email: fbUser.email,
        profilePicture: fbUser.photoURL,
        idToken,
      };
      
      setOAuthProfile(profile);
      setFormData(prev => ({ ...prev, name: profile.name, email: profile.email, password: "" }));
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${providerName} Account Linked Successfully! ✅` }));
    } catch (err) {
      console.error(err);
      const userMsg = FIREBASE_ERROR_MESSAGES[err.code]
        ?? (err.response ? err.response.data?.message : null)
        ?? 'Authentication failed. Please try again.';
      setErrorMsg(userMsg);
    }
  };

  /* ================= VALIDATION ================= */
  const analyzeTeacherForm = () => {
    const subjects = teacherData.subjects;

    let hasValidSubject = false;

    for (const s of subjects) {
      const hasSemester =
        s.semester !== "" && !Number.isNaN(Number(s.semester));

      const hasSubject = s.subject.trim() !== "";

      // ❌ Partial row
      if ((hasSemester && !hasSubject) || (!hasSemester && hasSubject)) {
        return { valid: false, shouldSubmit: false };
      }

      // ✅ Full row
      if (hasSemester && hasSubject) {
        hasValidSubject = true;
      }
    }

    const hasCoreData =
      teacherData.experience !== "" || teacherData.qualifications.trim() !== "";

    return {
      valid: true,
      shouldSubmit: hasValidSubject || hasCoreData,
    };
  };

  const isFormReady = () => {
    if (sysSettings && sysSettings.registrationEnabled === false) {
      return "Public registration is currently disabled by the administrator.";
    }

    if (sysSettings && sysSettings.serviceControls?.allowStaffPublicSignup === false && ["Teacher", "HOD", "Admin"].includes(formData.role)) {
      return "Staff registration must be done internally. Only Student registration is currently open.";
    }

    if (sysSettings?.serviceControls?.registrationRequiresWifi && !wifiVerified) {
      return "You must be connected to the campus WiFi network to register a new account.";
    }

    if (!formData.role) return "Role is required";
    if (!formData.name.trim()) return "Name is required";
    if (!formData.email.trim()) return "Email is required";
    if (!isEditMode && !oAuthProfile && !formData.password) return "Password is required";

    if (!["Admin", "Seller"].includes(formData.role) && !formData.department) {
      return "Department is required";
    }

    if (formData.role === "Student") {
      if (!studentData.rollNumber || Number(studentData.rollNumber) <= 0)
        return "Roll number must be a positive number";

      if (!studentData.semester) return "Semester must be selected";
    }

    if (
      formData.role === "Teacher" ||
      (formData.role === "HOD" && hodTeaches)
    ) {
      const teacherCheck = analyzeTeacherForm();

      if (!teacherCheck.valid) {
        return "Each subject row must have both semester and subject name, or be left completely empty";
      }
      if (formData.role === "Teacher" && !teacherCheck.shouldSubmit) {
        return "Teachers must provide at least their qualifications, experience, or one subject they teach.";
      }
    }

    if (formData.role === "HOD") {
      const sem = Number(hodData.semesters);

      if (!sem || sem < 1 || sem > 12)
        return "Total semesters must be between 1 and 12";

      const tenure = Number(hodData.tenure);
      if (isNaN(tenure) || tenure < 0 || tenure > 70) {
        return "Tenure must be a number between 0 and 70";
      }
    }

    if (formData.role === "Seller") {
      if (!sellerData.companyName.trim()) return "Company Name is required";
      if (!sellerData.businessType.trim()) return "Business Type is required";
    }

    return null;
  };

  /* ================= PAYLOAD PREVIEW ================= */

  const buildPayloadPreview = () => {
    const preview = {
      user: {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
      },
    };

    if (formData.role === "Student") preview.student = studentData;

    if (
      (formData.role === "Teacher" || hodTeaches) &&
      analyzeTeacherForm().shouldSubmit
    ) {
      preview.teacher = teacherData;
    }

    if (formData.role === "HOD") preview.hod = hodData;
    if (formData.role === "Seller") preview.seller = sellerData;

    return preview;
  };

  /* ================= SUBMIT ================= */

  const buildPayload = () => {
    // This refactors the signup process into a single, atomic API call
    // to prevent data inconsistency issues where a user might be created
    // without their corresponding role profile (Student, Teacher, etc.).
    const payload = { 
      ...formData,
      skills: formData.skills ? formData.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
    };
    const teacherCheck = analyzeTeacherForm();

    if (oAuthProfile) {
      payload.isOAuth = true;
      payload.profilePicture = isProfilePicTrusted(oAuthProfile.profilePicture)
        ? oAuthProfile.profilePicture
        : null;
    }

    if (formData.role === "Student") {
      payload.studentData = {
        ...studentData,
        rollNumber: Number(studentData.rollNumber),
        semester: Number(studentData.semester),
        subjects: studentSubjects.map((s) => s._id),
      };
    }
    if (
      (formData.role === "Teacher" && teacherCheck.shouldSubmit) ||
      (formData.role === "HOD" && hodTeaches && teacherCheck.shouldSubmit)
    ) {
      payload.teacherData = {
        ...teacherData,
        // experience is already calculated as years in TeacherForm.jsx
        experience: teacherData.experience ? Number(teacherData.experience) : 0,
        subjects: teacherData.subjects
          .filter(
            (s) =>
              s.subject.trim() !== "" &&
              s.semester !== "" &&
              !Number.isNaN(Number(s.semester)),
          )
          .map((s) => ({
            _id: s._id,
            subject: s.subject.trim(),
            semester: Number(s.semester),
            code: s.code?.trim() || "",
          })),
      };
    }

    if (formData.role === "HOD") {
      payload.hodData = {
        ...hodData,
        semesters: Number(hodData.semesters) || totalSemesters || 8,
        tenure: Number(hodData.tenure) || 0,
      };
    }

    if (formData.role === "Seller") {
      payload.sellerData = sellerData;
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    const error = isFormReady();
    if (error) {
      setErrorMsg(error);
      (document.getElementById("main-scroll-container") || window).scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const payload = buildPayload();

    if (isEditMode) {
      delete payload.password; // Don't send password on profile update
      onSave(payload);
      return;
    }

    setLoading(true);
    try {
      // Registration logic
      const idToken = oAuthProfile ? oAuthProfile.idToken : null;
      const data = await registerUser(payload, idToken);

      // If manual signup, server will ask for OTP
      if (data.requiresOTP) {
        setPendingVerificationToken(data.verificationToken);
        setOtpStage(true);
        setResendTimer(60); // Start 60s cooldown
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Verification code sent to your email! 📧" }));
        return;
      }

      if (data.token) {
        dispatch(login({ user: data.user, token: data.token }));
        navigate("/dashboard");
      } else if (data.requiresManualVerification) {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail:
              data.message ||
              "Signup completed in fallback mode. Contact admin for manual activation.",
          }),
        );
        navigate("/login");
      } else {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Signup successful. Please log in! 🎉",
          }),
        );
        navigate("/login");
      }
    } catch (err) {
      console.error(err);
      const apiErrors = err.response?.data?.errors;
      const firstApiError = Array.isArray(apiErrors) && apiErrors.length > 0 ? apiErrors[0].msg : null;
      const msg = firstApiError || err.response?.data?.message || "Signup failed. Please check your details and try again.";
      setErrorMsg(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      (document.getElementById("main-scroll-container") || window).scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const data = await verifyOTP({ email: formData.email, otp: otpCode });
      if (data.token) {
        dispatch(login({ user: data.user, token: data.token }));
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Email Verified Successfully! 🎉" }));
        navigate("/dashboard");
      } else {
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Email Verified Successfully! Your account is pending HOD approval. 🎉" }));
        navigate("/login");
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid or expired OTP.";
      setErrorMsg(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      await resendVerificationOTP(pendingVerificationToken);
      setResendTimer(60);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "A new verification code has been sent! 📧" }));
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to resend OTP.";
      setErrorMsg(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  if (otpStage) {
    return (
      <BackgroundWrapper appTheme={appTheme}>
        <div className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-md flex flex-col gap-6 transition-colors duration-300`}>
          <h2 className="text-2xl font-bold text-center">Verify Your Email</h2>
          <p className="text-sm opacity-80 text-center font-medium">We've sent a 6-digit security code to <b>{formData.email}</b>. Please enter it below to verify your account.</p>
          <ErrorAlert message={errorMsg} />
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="w-full text-center text-3xl tracking-[0.5em] font-mono px-3 py-4 border border-inherit/30 rounded-xl bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
          />
          <button
            onClick={handleVerifyOTP}
            disabled={loading || otpCode.length < 6}
            className={`w-full py-3 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
          >
            {loading ? "Verifying..." : "Verify & Login"}
          </button>
          
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={handleResendOTP}
              disabled={resendTimer > 0 || loading}
              className="text-sm text-blue-500 hover:text-blue-600 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : "Resend Code"}
            </button>
            <button
              onClick={() => setOtpStage(false)}
              className="text-sm text-inherit opacity-70 hover:opacity-100 font-bold transition-colors"
            >
              Change Email
            </button>
          </div>
        </div>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper appTheme={appTheme}>
      <form
        onSubmit={handleSubmit}
        className={`${getCardThemeClasses(appTheme)} backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-2xl border w-full max-w-xl flex flex-col gap-4 transition-colors duration-300`}
      >
        {!isEditMode && (
          <>
            <div className="mx-auto w-14 h-14 rounded-full text-white flex items-center justify-center text-2xl font-bold shadow-md">
              <img
                referrerPolicy="no-referrer"
                src={logo}
                alt="SocioFest Logo"
                className="w-10 h-10 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="w-full text-center text-sm opacity-80 font-medium">
              Sign up to continue to{" "}
              <span className="font-bold text-inherit">SocioFest</span>
            </p>
          </>
        )}
        <h2 className="text-xl font-bold text-center">
          {isEditMode ? "Edit Your Profile" : (formData.role) && "Select Your Role"}
        </h2>
      
      {sysSettings?.serviceControls?.registrationRequiresWifi && !wifiVerified && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Campus WiFi required. Connect to the school network to unlock registration.
        </div>
      )}

        <ErrorAlert message={errorMsg} />

        {!isEditMode && !oAuthProfile && (
          <div className="flex flex-col gap-3 pb-2">
            <button type="button" onClick={() => handleOAuthLogin('Google')} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" /> Continue with Google
            </button>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => handleOAuthLogin('GitHub')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
                <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-4 h-4" alt="GitHub" /> GitHub
              </button>
              <button type="button" onClick={() => handleOAuthLogin('Facebook')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-inherit/30 bg-black/5 hover:bg-black/10 transition-colors font-semibold text-sm text-inherit shadow-sm">
                <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-4 h-4" alt="Facebook" /> Facebook
              </button>
            </div>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-inherit/30"></div>
              <span className="flex-shrink-0 mx-4 text-inherit opacity-50 text-[10px] font-bold uppercase tracking-widest">Or sign up with email</span>
              <div className="flex-grow border-t border-inherit/30"></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {["Student", "Teacher", "HOD", "Seller"].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
              className={`border transition-colors flex-1 py-2 rounded-lg font-bold text-sm text-inherit shadow-sm ${
                formData.role === r
                  ? getPrimaryButtonClasses(appTheme) + " border-transparent"
                  : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-inherit/30 hover:border-inherit/50 hover:shadow-md"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {formData.role &&
          !["Admin", "Seller","HOD"].includes(formData.role) &&
          (
             <select
              name="department"
              value={formData.department || ""}
              onChange={handleBaseChange}
              required
              disabled={normalizedDepartments.length === 0}
              className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
            <option value="" disabled className={getOptionClasses(appTheme, isDark)}>
                Select Department
              </option>

              {normalizedDepartments.map((d) => (
              <option className={`text-center ${getOptionClasses(appTheme, isDark)}`} key={d} value={d}>
                  {d}
                </option>
              ))}
             </select>
          )}
        {formData.role &&
          ["HOD"].includes(formData.role) &&
          (
            <div className="flex flex-col gap-1">
              <input
                name="department"
                value={formData.department}
                placeholder="Proposed Department Name"
                onChange={handleBaseChange}
                required
                className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
              />
              <p className="text-xs opacity-60 text-inherit ml-1">
                ⚠️ Your account will be reviewed by an Admin before activation.
              </p>
            </div>
          )}

        {oAuthProfile && (
          <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg border border-inherit/30 shadow-inner">
            <img src={oAuthProfile.profilePicture} className="w-10 h-10 rounded-full shadow-sm" alt="Profile" />
            <div className="flex-1 min-w-0">
               <p className="font-bold text-inherit text-sm truncate">OAuth Connected</p>
               <p className="text-xs opacity-70 truncate">{oAuthProfile.email}</p>
            </div>
            <button type="button" onClick={() => {
              setOAuthProfile(null);
              setFormData(prev => ({ ...prev, name: "", email: "" }));
            }} className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-500/10 px-2 py-1 rounded-md transition-colors">
               Disconnect
            </button>
          </div>
        )}

        <input
          name="name"
          value={formData.name}
          placeholder="Full Name"
          onChange={handleBaseChange}
          required
          className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
        />
        
        {!oAuthProfile && (
          <>
            <input
              name="email"
              value={formData.email}
              type="email"
              placeholder="Email"
              onChange={handleBaseChange}
              required
              className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
            />
            {!isEditMode && (
              <input
                name="password"
                value={formData.password}
                type="password"
                placeholder="Password"
                onChange={handleBaseChange}
                required
                className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
              />
            )}
          </>
        )}

        {/* General Personal Info - visible ONLY during edit, not during signup */}
        {isEditMode && formData.role && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-inherit/10"></div>
              <span className="flex-shrink-0 mx-4 text-inherit opacity-40 text-[10px] font-bold uppercase tracking-widest">Personal Details</span>
              <div className="flex-grow border-t border-inherit/10"></div>
            </div>
            
            <textarea
              name="bio"
              value={formData.bio}
              placeholder="Tell us about yourself (Bio)"
              onChange={handleBaseChange}
              rows="2"
              className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors resize-none text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                name="contactNumber"
                value={formData.contactNumber}
                placeholder="Contact Number"
                onChange={handleBaseChange}
                className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors text-sm"
              />
              <input
                name="location"
                value={formData.location}
                placeholder="Location (City, Country)"
                onChange={handleBaseChange}
                className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 ml-1 mb-1 block">Date of Birth</label>
                <input
                  name="dob"
                  value={formData.dob}
                  type="date"
                  onChange={handleBaseChange}
                  className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-50 ml-1 mb-1 block">Skills (Comma separated)</label>
                <input
                  name="skills"
                  value={formData.skills}
                  placeholder="React, Design, Python..."
                  onChange={handleBaseChange}
                  className="w-full px-3 py-2 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors text-sm"
                />
              </div>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-inherit/10"></div>
              <span className="flex-shrink-0 mx-4 text-inherit opacity-40 text-[10px] font-bold uppercase tracking-widest">{formData.role} Information</span>
              <div className="flex-grow border-t border-inherit/10"></div>
            </div>
          </div>
        )}

        {/* Essential Role-Specific Info - visible during signup and edit */}
        {!isEditMode && formData.role && !["Personal Details"].some(s => s === formData.role) && (
           <div className="relative flex py-2 items-center md:hidden">
              <div className="flex-grow border-t border-inherit/10"></div>
              <span className="flex-shrink-0 mx-4 text-inherit opacity-40 text-[10px] font-bold uppercase tracking-widest">{formData.role} Information</span>
              <div className="flex-grow border-t border-inherit/10"></div>
           </div>
        )}

        {formData.role === "Student" && (
          <StudentForm
            studentData={studentData}
            setStudentData={setStudentData}
            totalSemesters={totalSemesters}
            studentSubjects={studentSubjects}
            department={formData.department}
            isEditMode={isEditMode}
          />
        )}

        {formData.role === "Teacher" && (
          <TeacherForm
            teacherData={teacherData}
            setTeacherData={setTeacherData}
            totalSemesters={totalSemesters}
          />
        )}

        {formData.role === "HOD" && (
          <HODForm
            hodData={hodData}
            setHodData={setHodData}
            teacherData={teacherData}
            setTeacherData={setTeacherData}
            hodTeaches={hodTeaches}
            setHodTeaches={setHodTeaches}
            totalSemesters={totalSemesters}
            // setTotalSemesters={setTotalSemesters}
          />
        )}

        {formData.role === "Seller" && (
          <SellerForm 
            sellerData={sellerData} 
            setSellerData={setSellerData} 
          />
        )}

        <div className="flex gap-4 pt-4">
          {isEditMode && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-inherit py-2 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!formData.role || loading || isUpdating}
            className={`w-full py-2 h-11 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${getPrimaryButtonClasses(appTheme)}`}
          >
            {loading || isUpdating ? (
              <div
                className="loader mx-auto"
                style={{ "--s": "15px", "--g": "3px" }}
              ></div>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Sign up"
            )}
          </button>
        </div>
        {!isEditMode && (
          <p className="mt-4 text-sm text-center opacity-80 font-medium">
            Already have an account?{" "}
            <Link
              to="/login"
                className="text-blue-500 hover:text-blue-600 font-bold hover:no-underline transition-colors"
            >
              Login
            </Link>
          </p>
        )}
      </form>
    </BackgroundWrapper>
  );
};

export default Signup;
