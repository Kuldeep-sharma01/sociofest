import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/context/ThemeContext";
import CameraCapture from "@/components/CameraCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, AlertCircle, Camera, MapPin, Wifi, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { markAttendance } from "@/services/attendanceService";
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
  const [stage, setStage] = useState("capture");
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [error, setError] = useState("");
  const [wifiVerified, setWifiVerified] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [selectedClass, setSelectedClass] = useState("");
  const [curricula, setCurricula] = useState([]);
  const [runtimeControls, setRuntimeControls] = useState({
    faceRecognitionEnabled: true,
    wifiEnforcementEnabled: true,
    staffAttendanceEnabled: false,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    // Check WiFi status
    checkWiFiStatus();
    // Check location
    checkLocation();
    // Load Curricula
    loadCurricula();
    getPublicSystemSettings().then((s) =>
      setRuntimeControls({
        faceRecognitionEnabled: s.serviceControls?.faceRecognitionEnabled !== false,
        wifiEnforcementEnabled: s.serviceControls?.wifiEnforcementEnabled !== false,
        staffAttendanceEnabled: s.serviceControls?.staffAttendanceEnabled === true,
      }),
    );
  }, []);

  const loadCurricula = async () => {
    try {
      const profile = await getRoleProfile(user.role, user._id);
      const data = profile?.subjects || [];
      setCurricula(data);
      if (data && data.length > 0) {
        setSelectedClass(data[0]._id);
      }
    } catch (err) {
      console.error("Failed to load curricula:", err);
    }
  };

  const handleRetry = useCallback(() => {
    setStage("capture");
    setError("");
    setRecognitionResult(null);
  }, []);

  useAIPing(stage, handleRetry, "verifyFace");

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
      setError("Face recognition attendance is currently disabled by admin.");
      setStage("error");
      return;
    }
    
    if (user.role !== "Student" && !runtimeControls.staffAttendanceEnabled) {
      setError("Staff attendance marking is currently disabled by the administrator.");
      setStage("error");
      return;
    }

    if (user.role === "Student" && !selectedClass) {
      setError("Please select or enter a valid class/curriculum first.");
      setStage("error");
      return;
    }

    setStage("processing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", imageBlob);
      formData.append("userId", user._id);
      formData.append("clientLivenessVerified", "true");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const data = await pythonAPI.verifyFace(formData, controller.signal);
      clearTimeout(timeoutId);

      setRecognitionResult(data);

      if (data.verified) {
        // Mark attendance
        await markAttendanceRecord(data.confidence);
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Attendance Marked Successfully! ✅" }));
        setStage("success");
      } else {
        setError(
          "Face not recognized. Please try again or register your face first.",
        );
        setStage("error");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to process attendance";
      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Load failed") ||
        errorMessage.includes("aborted")
      ) {
        setStage("offline");
      } else {
        setError(errorMessage);
        setStage("error");
      }
    }
  };

  const markAttendanceRecord = async (confidence) => {
    return await markAttendance({
      studentId: user._id,
      curriculum: user.role === "Student" ? selectedClass : (selectedClass || undefined),
      status: "present",
      recognitionMethod: "facial_recognition",
      recognitionConfidence: confidence,
      wifiVerified: wifiVerified,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
        {/* Header Banner */}
        <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-teal-600 to-emerald-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Camera className="w-64 h-64" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Mark Attendance</h1>
            <p className="mt-2 opacity-90 max-w-xl text-lg font-medium">Verify your presence using AI facial recognition and campus WiFi.</p>
          </div>
        </div>

        {/* Security Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      ? "Connected to school network"
                      : "Not on school network"}
                  </p>
                </div>
                {wifiVerified && (
                  <Badge className="ml-auto bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    Verified
                  </Badge>
                )}
                {!wifiVerified && (
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
                <MapPin
                  className={`h-5 w-5 ${locationVerified ? "text-green-600 dark:text-green-400" : "text-inherit opacity-40"}`}
                />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-xs text-inherit opacity-70">
                    {locationVerified
                      ? "Location verified"
                      : "Location not shared"}
                  </p>
                </div>
                {locationVerified && (
                  <Badge className="ml-auto bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    Verified
                  </Badge>
                )}
                {!locationVerified && (
                  <Button variant="outline" size="sm" className="ml-auto h-7 text-xs px-2 shadow-sm" onClick={() => checkLocation(true)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Allow
                  </Button>
                )}
              </div>
              {locationVerified && coordinates && (
                <div className="mt-4 w-full h-32 rounded-lg overflow-hidden border border-inherit/20 shadow-inner bg-black/5 dark:bg-white/5 animate-in fade-in zoom-in-95">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${coordinates.lng - 0.005},${coordinates.lat - 0.005},${coordinates.lng + 0.005},${coordinates.lat + 0.005}&layer=mapnik&marker=${coordinates.lat},${coordinates.lng}`}
                  ></iframe>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Card */}
        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Face Recognition Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!wifiVerified && runtimeControls.wifiEnforcementEnabled && stage === "capture" && (
              <div className="mb-6 p-4 flex flex-col items-center justify-center text-center bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-8 w-8 mb-2 text-yellow-600 dark:text-yellow-400" />
                <p className="font-semibold">Campus Verification Required</p>
                <p className="text-sm mt-1">
                  You must be connected to the school's authorized WiFi network
                  to mark your own attendance.
                </p>
              </div>
            )}

            {stage === "capture" && (wifiVerified || !runtimeControls.wifiEnforcementEnabled) && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Department Context
                  </label>
                  <div className="flex h-10 w-full items-center rounded-md border border-inherit/20 bg-black/5 dark:bg-white/5 px-3 py-2 text-sm font-semibold text-inherit opacity-80 cursor-not-allowed">
                    {user.department || "General Department"}
                  </div>
                  <p className="text-xs text-inherit opacity-70 mt-1">
                    Attendance will be strictly logged under your assigned
                    department structure.
                  </p>
                </div>
                {user.role === "Student" || curricula.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Class / Subject Name
                  </label>
                  {curricula.length > 0 ? (
                    <Select
                      value={selectedClass}
                      onValueChange={setSelectedClass}
                    >
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
                  ) : (
                    <Input
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      placeholder="Enter Curriculum ID"
                    />
                  )}
                  <p className="text-xs text-inherit opacity-70 mt-1">
                    Enter the class you are marking attendance for.
                  </p>
                </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-green-600 dark:text-green-400 font-bold flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Staff Attendance Mode</p>
                    <p className="text-xs opacity-70">Your attendance will be safely logged for the entire department.</p>
                  </div>
                )}
                <CameraCapture
                  onCapture={handleCapture}
                  onCancel={() => navigate("/dashboard")}
                  title="Capture Your Face for Attendance"
                  description="Position your face in the center of the frame. Your face will be verified against registered records."
                />
              </div>
            )}

            {stage === "processing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="h-12 w-12 mb-4 text-blue-600 dark:text-blue-400" />
                <p className="text-lg font-semibold text-inherit mb-2">
                  Verifying...
                </p>
                <p className="text-sm text-inherit opacity-70">
                  Analyzing your face and verifying against registered
                  records...
                </p>
              </div>
            )}

            {stage === "success" && recognitionResult && (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">
                  Attendance Marked!
                </p>
                <div className="w-full bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6 text-inherit">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-70">Status:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        Present
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">
                        Recognition Confidence:
                      </span>
                      <span className="font-semibold">
                        {(recognitionResult.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Method:</span>
                      <span className="font-semibold">Facial Recognition</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">WiFi Verified:</span>
                      <span className="font-semibold">
                        {wifiVerified ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Time:</span>
                      <span className="font-semibold">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => navigate("/dashboard/attendance")} className={getPrimaryButtonClasses(appTheme)}>
                    View Attendance Records
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            )}

            {stage === "error" && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">
                  Verification Failed
                </p>
                <p className="text-sm text-red-500 dark:text-red-400 text-center mb-6 max-w-md font-medium">
                  {error}
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard/profile")}
                  >
                    Register Face
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {stage === "offline" && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-16 w-16 text-orange-500 dark:text-orange-400 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">
                  AI Service Offline
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400 text-center mb-6 max-w-md">
                  The facial recognition service is currently unreachable.
                  Please ensure you are connected to the network or try again
                  later.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Retry Connection
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                  >
                    Go to Dashboard
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-inherit opacity-70">
                  <Spinner className="w-3 h-3" /> Auto-retrying every 5
                  seconds...
                </div>
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
                <span>Position your face in the camera frame</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">2</span>
                <span>Click Capture to take a photo</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">3</span>
                <span>Your face will be analyzed using AI</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-600 dark:text-blue-400">4</span>
                <span>
                  If verified, your attendance will be marked automatically
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
  );
}
