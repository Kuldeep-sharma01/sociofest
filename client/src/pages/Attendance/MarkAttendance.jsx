import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";
import CameraCapture from "@/components/CameraCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, AlertCircle, Camera, MapPin, Wifi, RefreshCw, Bluetooth } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { markAttendance, selfMarkFace } from "@/services/attendanceService";
import { getRoleProfile } from "@/utils/roleUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as wifiAPI from "@/services/wifiService";
import { pythonAPI } from "@/lib/api";
import { getPublicSystemSettings } from "@/services/systemSettingsService";
import { useAIPing } from "@/hooks/useAIPing";
import { getBannerThemeClasses, getCardThemeClasses, getPrimaryButtonClasses, getOptionClasses } from "@/utils/themeUtils";

export default function MarkAttendancePage() {
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = !!user;
  const loading = false;
  const { appTheme, isDark } = useTheme();
  const navigate = useNavigate();
  
  // Consolidation Logic: Determine mode based on registration status
  const isRegistered = !!user?.faceEncodingVector;
  const [mode, setMode] = useState(isRegistered ? "mark" : "register");
  
  const [stage, setStage] = useState("capture");
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [error, setError] = useState("");
  const [wifiVerified, setWifiVerified] = useState(false);
  const [bluetoothVerified, setBluetoothVerified] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [curricula, setCurricula] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [runtimeControls, setRuntimeControls] = useState({
    faceRecognitionEnabled: true,
    wifiEnforcementEnabled: true,
    staffAttendanceEnabled: false,
    bluetoothEnforcementEnabled: true,
  });

  const checkBluetoothStatus = async () => {
    if (!navigator.bluetooth) {
      console.log("Bluetooth not supported");
      return;
    }
    try {
      // In a real scenario, we would look for a specific beacon UUID or name
      // For now, we simulate a scan for 'SOCIOFEST_BEACON'
      // This requires user interaction, so we will trigger it via a button if needed
      // but for this logic we check if we can at least see the adapter
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'SOCIOFEST' }],
        optionalServices: ['battery_service']
      });
      if (device) {
        setBluetoothVerified(true);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Bluetooth proximity verified! 📡" }));
      }
    } catch (err) {
      console.log("Bluetooth verification cancelled or failed:", err);
    }
  };

  // Teacher Mode Logic
  const queryParams = new URLSearchParams(window.location.search);
  const urlSubjectId = queryParams.get("subjectId");
  const urlStudentId = queryParams.get("studentId");
  
  const isTeacherMode = ["Teacher", "HOD", "Admin"].includes(user?.role);
  const [targetStudent, setTargetStudent] = useState(null);
  const [subjectStudents, setSubjectStudents] = useState([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    // Check Presence Proof (Required for Self-Marking, Skipped for Authority-Marking)
    const needsProof = !targetStudent || targetStudent._id === user._id;
    
    if (needsProof) {
      checkWiFiStatus();
      checkLocation();
      setBluetoothVerified(false);
    } else {
      setWifiVerified(true);
      setBluetoothVerified(true);
      setLocationVerified(true);
    }
    
    // Load Curricula
    loadCurricula();
    
    getPublicSystemSettings().then((s) =>
      setRuntimeControls({
        faceRecognitionEnabled: s.serviceControls?.faceRecognitionEnabled !== false,
        wifiEnforcementEnabled: s.serviceControls?.wifiEnforcementEnabled !== false,
        staffAttendanceEnabled: s.serviceControls?.staffAttendanceEnabled === true,
        bluetoothEnforcementEnabled: true,
      }),
    );
  }, [targetStudent]); // Re-run when target student changes

  useEffect(() => {
    if (isTeacherMode && selectedClass) {
      loadSubjectStudents(selectedClass);
    }
  }, [isTeacherMode, selectedClass]);

  useEffect(() => {
    if (isTeacherMode && urlStudentId && subjectStudents.length > 0) {
      const student = subjectStudents.find(s => s._id === urlStudentId);
      if (student) setTargetStudent(student);
    }
  }, [isTeacherMode, urlStudentId, subjectStudents]);

  const loadCurricula = async () => {
    try {
      const profile = await getRoleProfile(user.role, user._id);
      const data = profile?.subjects || [];
      setCurricula(data);
      
      if (urlSubjectId) {
        setSelectedClass(urlSubjectId);
      } else if (data && data.length > 0) {
        setSelectedClass(data[0]._id);
      }
    } catch (err) {
      console.error("Failed to load curricula:", err);
    }
  };

  const loadSubjectStudents = async (currId) => {
    try {
      const { getSubjectById } = await import("@/services/subjectService");
      const { getAllUsers } = await import("@/services/userService");
      
      const subjectRes = await getSubjectById(currId);
      let subject = subjectRes;
      if (Array.isArray(subject)) subject = subject[0];
      else if (subject?.subject) subject = subject.subject;
      
      if (!subject) return;

      const deptQuery = subject.department?._id || subject.department;
      
      // HOD can mark Teachers and Students. Teachers can only mark Students.
      const rolesToFetch = (user.role === 'HOD' || user.role === 'Admin') 
        ? ["Student", "Teacher"] 
        : ["Student"];

      const usersRes = await getAllUsers({ 
        status: "Approved", 
        department: deptQuery, 
        role: rolesToFetch.join(","),
        limit: 1000 
      });
      
      const users = Array.isArray(usersRes) ? usersRes : (usersRes?.users || []);
      const eligibleUsers = users.filter((u) => {
        // Don't include self in the "Others" list to avoid confusion
        if (u._id === user._id) return false;

        const uDeptId = u.department?._id || u.department;
        const explicitlyEnrolled = u.subjects?.some(
          (s) => String(s._id || s) === String(currId)
        );
        const defaultEnrolled = u.role === "Student" && u.semester === subject.semester && String(uDeptId) === String(deptQuery);
        const isAssignedTeacher = u.role === "Teacher" && (subject.assignedTeacher?.some(t => String(t._id || t) === String(u._id)));

        return explicitlyEnrolled || defaultEnrolled || isAssignedTeacher;
      });
      
      setSubjectStudents(eligibleUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleRetry = useCallback(() => {
    setStage("capture");
    setError("");
    setRecognitionResult(null);
  }, []);

  useAIPing(stage, handleRetry, mode === "mark" ? "verifyFace" : "registerFace");

  const checkWiFiStatus = async (showToast = false) => {
    try {
      const data = await wifiAPI.verifyWifi();
      if (data.verified) {
        setWifiVerified(true);
        if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "Campus network verified! ✅" }));
      } else {
        setWifiVerified(false);
        if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "You are not on a recognized campus network. ❌" }));
      }
    } catch (err) {
      console.log("WiFi check failed - may not be on school network");
      if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to reach network verification service. ❌" }));
    }
  };

  const checkLocation = (showToast = false) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationVerified(true);
          setCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude });
          if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "Location verified! 📍" }));
        },
        (error) => {
          console.log("Location access denied");
          setLocationVerified(false);
          if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "Location access denied. Please allow it in your browser settings. ❌" }));
        },
      );
    } else {
      if (showToast) window.dispatchEvent(new CustomEvent("showToast", { detail: "Geolocation is not supported by your browser. ❌" }));
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const handleCapture = async (imageBlob) => {
    if (!runtimeControls.faceRecognitionEnabled) {
      setError("Face recognition is currently disabled by admin.");
      setStage("error");
      return;
    }

    if (mode === "mark" && !selectedClass) {
      setError("Please select a class/curriculum first.");
      setStage("error");
      return;
    }

    if (isTeacherMode && mode === "mark" && !targetStudent) {
      setError("Please select a student to verify.");
      setStage("error");
      return;
    }

    try {
      setStage("processing");
      setError("");

      if (mode === "mark") {
        const imageFile = new File([imageBlob], "capture.jpg", { type: "image/jpeg" });
        let data;
        
        if (isTeacherMode) {
          // TEACHER MARKING STUDENT
          const { teacherVerifyFace } = await import("@/services/attendanceService");
          data = await teacherVerifyFace(targetStudent._id, selectedClass, imageFile);
        } else {
          // STUDENT SELF-MARKING
          if (user.role !== "Student" && !runtimeControls.staffAttendanceEnabled) {
            setError("Staff attendance marking is currently disabled by the administrator.");
            setStage("error");
            return;
          }
          
          // Import modified selfMarkFace that takes bluetoothVerified if needed, 
          // or just pass it in coordinates/metadata
          const { apiClient } = await import("@/services/apiClient");
          const formData = new FormData();
          formData.append("image", imageFile);
          formData.append("curriculum", selectedClass);
          formData.append("bluetoothVerified", bluetoothVerified);
          if (coordinates) {
            formData.append("latitude", coordinates.lat);
            formData.append("longitude", coordinates.lng);
          }
          
          const res = await apiClient.post("/attendance/self-mark-face", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          data = res.data;
        }
        
        setRecognitionResult({
          verified: true,
          confidence: data.recognitionConfidence || data.confidence || 0.95
        });

        window.dispatchEvent(new CustomEvent("showToast", { detail: "Attendance Marked Successfully! ✅" }));
        setStage("success");
      } else {
        // REGISTER FACE MODE (Existing logic)
        const formData = new FormData();
        formData.append('image', imageBlob, "register.jpg");
        formData.append('userId', user._id);
        formData.append('clientLivenessVerified', 'true');

        const data = await pythonAPI.registerFace(formData);
        setSuccessMessage(`Face registered successfully! You can now mark your attendance.`);
        setStage("success");
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Face registered successfully! ✅" }));
        
        setTimeout(() => {
          setMode("mark");
          setStage("capture");
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Operation failed";
      
      if (errorMessage.includes("Face not recognized") || errorMessage.includes("verification failed")) {
        setError("Face verification failed. Please ensure the student is looking clearly at the camera.");
        setStage("error");
      } else if (err.code === 'ECONNABORTED' || errorMessage.includes("timeout")) {
        setStage("offline");
      } else {
        setError(errorMessage);
        setStage("error");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
        {/* Header Banner */}
        <div className={`${getBannerThemeClasses(appTheme, mode === "mark" ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white" : "bg-gradient-to-r from-purple-600 to-pink-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Camera className="w-64 h-64" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
              {mode === "mark" ? "Mark Attendance" : "Register Face ID"}
            </h1>
            <p className="mt-2 opacity-90 max-w-xl text-lg font-medium">
              {mode === "mark" 
                ? "Verify your presence using AI facial recognition and campus WiFi."
                : "Set up your facial recognition profile for secure attendance marking."}
            </p>
          </div>
        </div>

        {/* Security Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Wifi
                  className={`h-5 w-5 ${wifiVerified ? "text-green-600 dark:text-green-400" : "text-inherit opacity-40"}`}
                />
                <div>
                  <p className="text-sm font-medium">WiFi Status</p>
                  <p className="text-xs text-inherit opacity-70">
                    {wifiVerified
                      ? "On school network"
                      : "Not on school WiFi"}
                  </p>
                </div>
                {wifiVerified && (
                  <Badge className="ml-auto bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    OK
                  </Badge>
                )}
                {!wifiVerified && !isTeacherMode && (
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs px-2 shadow-sm" onClick={() => checkWiFiStatus(true)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Bluetooth
                  className={`h-5 w-5 ${bluetoothVerified ? "text-blue-600 dark:text-blue-400" : "text-inherit opacity-40"}`}
                />
                <div>
                  <p className="text-sm font-medium">Bluetooth</p>
                  <p className="text-xs text-inherit opacity-70">
                    {bluetoothVerified
                      ? "Beacon found"
                      : "No beacon nearby"}
                  </p>
                </div>
                {bluetoothVerified && (
                  <Badge className="ml-auto bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                    OK
                  </Badge>
                )}
                {!bluetoothVerified && !isTeacherMode && (
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs px-2 shadow-sm" onClick={checkBluetoothStatus}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Scan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MapPin
                  className={`h-5 w-5 ${locationVerified ? "text-green-600 dark:text-green-400" : "text-inherit opacity-40"}`}
                />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-xs text-inherit opacity-70">
                    {locationVerified
                      ? "Position verified"
                      : "Location hidden"}
                  </p>
                </div>
                {locationVerified && (
                  <Badge className="ml-auto bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    OK
                  </Badge>
                )}
                {!locationVerified && !isTeacherMode && (
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs px-2 shadow-sm" onClick={() => checkLocation(true)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Allow
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {mode === "mark" ? "Facial Recognition Attendance" : "Face Registration Setup"}
            </CardTitle>
            {mode === "mark" && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setMode("register")}
                className="text-[10px] uppercase font-black tracking-widest opacity-50 hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 transition-all"
              >
                Reset & Re-register
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {mode === "mark" && !wifiVerified && !bluetoothVerified && runtimeControls.wifiEnforcementEnabled && stage === "capture" && !isTeacherMode && (
              <div className="mb-6 p-4 flex flex-col items-center justify-center text-center bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-8 w-8 mb-2 text-yellow-600 dark:text-yellow-400" />
                <p className="font-semibold">Presence Verification Required</p>
                <p className="text-sm mt-1">
                  To mark attendance, you must be connected to the campus WiFi <b>OR</b> verify proximity via Bluetooth.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => checkWiFiStatus(true)}>Retry WiFi</Button>
                  <Button variant="outline" size="sm" onClick={checkBluetoothStatus}>Scan Bluetooth</Button>
                </div>
              </div>
            )}

            {stage === "capture" && (wifiVerified || bluetoothVerified || !runtimeControls.wifiEnforcementEnabled || mode === "register" || isTeacherMode) && (
              <div className="space-y-6">
                {mode === "mark" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">Department Context</label>
                      <div className="flex h-10 w-full items-center rounded-md border border-inherit/20 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm font-semibold text-inherit opacity-80 cursor-not-allowed">
                        {user.department?.name || user.department || "General Department"}
                      </div>
                    </div>
                    
                    <div className="space-y-2 mt-4">
                      <label className="text-sm font-medium leading-none">Class / Subject Name</label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a class..." />
                        </SelectTrigger>
                        <SelectContent>
                          {curricula.map((c) => (
                            <SelectItem key={c._id} value={c._id} className={getOptionClasses(appTheme, isDark)}>
                              {c.name} ({c.code || 'N/A'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {isTeacherMode && subjectStudents.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <label className="text-sm font-medium leading-none">Select Student to Verify</label>
                        <Select 
                          value={targetStudent?._id || ""} 
                          onValueChange={(val) => setTargetStudent(subjectStudents.find(s => s._id === val))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a student..." />
                          </SelectTrigger>
                          <SelectContent>
                            {subjectStudents.map((s) => (
                              <SelectItem key={s._id} value={s._id} className={getOptionClasses(appTheme, isDark)}>
                                {s.name} ({s.rollNumber || 'No Roll'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {!isTeacherMode && user.role !== "Student" && !runtimeControls.staffAttendanceEnabled && (
                      <div className="p-4 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20">
                         <p className="text-sm font-bold flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Staff Attendance Mode</p>
                      </div>
                    )}
                  </>
                )}

                {mode === "register" && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-2">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> Your face will be securely encoded and stored for verification. We do NOT store raw images.
                    </p>
                  </div>
                )}

                <CameraCapture
                  onCapture={handleCapture}
                  onCancel={() => navigate("/dashboard")}
                  title={mode === "mark" ? (isTeacherMode ? `Verifying: ${targetStudent?.name || 'Student'}` : "Capture Your Face") : "Capture Registration Photo"}
                  description={mode === "mark" 
                    ? (isTeacherMode 
                        ? `Please point the camera at ${targetStudent?.name || 'the student'}'s face.`
                        : "Position your face in the center. It will be verified against records.")
                    : "Position your face clearly. This will be used for all future attendance."}
                />
              </div>
            )}

            {stage === "processing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="h-12 w-12 mb-4 text-blue-600 dark:text-blue-400" />
                <p className="text-lg font-semibold text-inherit mb-2">Processing...</p>
                <p className="text-sm text-inherit opacity-70">
                  {mode === "mark" ? "Analyzing your face and verifying records..." : "Creating a secure biometric encoding..."}
                </p>
              </div>
            )}

            {stage === "success" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mb-4" />
                <p className="text-xl font-bold text-inherit mb-2">
                  {mode === "mark" ? "Attendance Marked!" : "Face Registered!"}
                </p>
                
                {mode === "mark" ? (
                  <div className="w-full bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 text-inherit max-w-sm">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="opacity-70">Recognition:</span>
                        <span className="font-bold">{(recognitionResult?.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Time:</span>
                        <span className="font-bold">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm opacity-80 mb-6 max-w-md">{successMessage}</p>
                )}

                <div className="flex gap-3">
                  <Button onClick={() => navigate("/dashboard/attendance")} className={getPrimaryButtonClasses(appTheme)}>
                    View Records
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                <p className="text-lg font-bold text-inherit mb-2">Operation Failed</p>
                <p className="text-sm text-red-500 dark:text-red-400 mb-6 max-w-md">{error}</p>
                <div className="flex gap-3">
                  <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                    Try Again
                  </Button>
                  {mode === "mark" && !isRegistered && (
                    <Button variant="outline" onClick={() => setMode("register")}>
                      Register Now
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {stage === "offline" && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-16 w-16 text-orange-500 mb-4" />
                <p className="text-lg font-bold text-inherit">AI Service Offline</p>
                <p className="text-sm opacity-70 mb-6">The facial recognition service is currently unreachable.</p>
                <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                  Retry Connection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="bg-blue-500/10 border-blue-500/20 text-inherit">
          <CardHeader>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-inherit opacity-90">
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">1</span>
                <span>{mode === "mark" ? "Position your face in the camera frame" : "Look directly at the camera with a neutral expression"}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">2</span>
                <span>{mode === "mark" ? "Click Capture to verify your presence" : "Capture a clear photo for your biometric profile"}</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">3</span>
                <span>The AI will securely process your facial features</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">4</span>
                <span>{mode === "mark" ? "Attendance is marked upon successful verification" : "You're all set to use AI attendance features!"}</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
  );
}
