// client/src/App.jsx
import React, { Suspense, lazy, useMemo, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "@/redux/authSlice";
import { jwtDecode } from "jwt-decode";

// Layouts
import MainLayout from "@/layouts/MainLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

// --- Lazy Loaded Pages (Code Splitting) ---
const QuizAttempt = lazy(() => import("@/pages/QuizAttempt"));
const MonetizationManager = lazy(
  () => import("@/components/MonetizationManager"),
);
const DocumentViewer = lazy(() => import("@/components/ui/DocumentViewer"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Network = lazy(() => import("@/pages/Network"));
const HomeFeed = lazy(() => import("@/pages/HomeFeed"));
const Marketplace = lazy(() => import("@/pages/Marketplace"));
const Chat = lazy(() => import("@/pages/Chat"));
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const NoticeBoard = lazy(() => import("@/pages/NoticeBoard"));
const AIGallery = lazy(() => import("@/pages/AIGallery"));
const Activities = lazy(() => import("@/pages/Activities"));
const SubjectPage = lazy(() => import("@/pages/SubjectPage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const QuizEditor = lazy(() => import("@/pages/QuizEditor"));
const UserApprovalList = lazy(() => import("@/pages/UserApprovalList"));
const AIHub = lazy(() => import("@/pages/AIHub"));
const HodManagement = lazy(() => import("@/pages/HodManagement"));
const StudyHub = lazy(() => import("@/pages/StudyHub"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const SearchResults = lazy(() => import("@/components/SearchResults"));
const CodeCompiler = lazy(() => import("@/pages/CodeCompiler"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AnalyticsDashboard = lazy(() => import("@/pages/AnalyticsDashboard"));
const TeachersManagement = lazy(() => import("@/pages/TeachersManagement"));
const DropoutPredict = lazy(() => import("@/pages/DropoutPredict"));

const MarkAttendancePage = lazy(
  () => import("@/pages/Attendance/MarkAttendance"),
);
const Attendance = lazy(() => import("@/pages/Attendance/Attendance"));
const WiFiConfigPage = lazy(() => import("@/pages/Attendance/AdminWifiConfig"));
const RegisterFace = lazy(() => import("@/pages/Attendance/RegisterFace"));

/* -------------------------------------------------------------------------- */
/*                             Protected Route                                */
/* -------------------------------------------------------------------------- */
const ProtectedRoute = ({ children, roles }) => {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const location = useLocation();

  // Validate token safely
  const tokenValid = useMemo(() => {
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);

      // Missing exp = invalid token
      if (!decoded?.exp) return false;

      return decoded.exp * 1000 > Date.now();
    } catch (error) {
      console.error("Invalid JWT:", error);
      return false;
    }
  }, [token]);

  // Logout ONLY after render cycle (fixes React warning)
  useEffect(() => {
    if ((!user || !tokenValid) && (user || token)) {
      dispatch(logout());
    }
  }, [user, token, tokenValid, dispatch]);

  // Not authenticated
  if (!user || !tokenValid) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // Unauthorized role
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
};

/* -------------------------------------------------------------------------- */
/*                                   App                                      */
/* -------------------------------------------------------------------------- */
const App = () => {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <div
                className="loader"
                style={{ "--s": "20px", "--g": "4px" }}
              ></div>
            </div>
          }
        >
          <MainLayout>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Auth */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected General */}
              <Route
                element={
                  <ProtectedRoute
                    roles={["Student", "Teacher", "HOD", "Admin"]}
                  />
                }
              >
                <Route path="/network" element={<Network />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/notice-board" element={<NoticeBoard />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/document" element={<DocumentViewer />} />
                <Route path="/subjects/:subjectId" element={<SubjectPage />} />
                <Route path="/quiz/attempt/:quizId" element={<QuizAttempt />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/ai-hub" element={<AIHub />} />
                <Route path="/ai-gallery" element={<AIGallery />} />
                <Route path="/study-hub" element={<StudyHub />} />
                <Route path="/compiler" element={<CodeCompiler />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/profile/:userId" element={<UserProfile />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<SettingsPage />} />

                <Route
                  path="/dashboard/admin/monetization"
                  element={<MonetizationManager />}
                />
                <Route
                  path="/monetization"
                  element={<MonetizationManager />}
                />
                <Route
                  path="/monitization"
                  element={<MonetizationManager />}
                />

                <Route
                  path="/dashboard/activities"
                  element={<Activities />}
                />
                <Route
                  path="/dashboard/analytics"
                  element={<AnalyticsDashboard />}
                />

                {/* Attendance */}
                <Route path="/attendance" element={<Attendance />} />
                <Route
                  path="/dashboard/attendance"
                  element={<Attendance />}
                />
                <Route
                  path="/dashboard/mark-attendance"
                  element={<MarkAttendancePage />}
                />
                <Route
                  path="/dashboard/curriculum"
                  element={<SubjectPage />}
                />
                <Route
                  path="/dashboard/register-face"
                  element={<RegisterFace />}
                />
              </Route>

              {/* Teacher */}
              <Route
                element={<ProtectedRoute roles={["Teacher", "HOD", "Admin"]} />}
              >
                <Route
                  path="/teacher/quiz-editor"
                  element={<QuizEditor />}
                />
              </Route>

              {/* Admin */}
              <Route element={<ProtectedRoute roles={["Admin"]} />}>
                <Route
                  path="/admin/hod-management"
                  element={<HodManagement />}
                />
                <Route
                  path="/admin/settings"
                  element={<AdminSettings />}
                />
                <Route
                  path="/dashboard/admin/wifi-config"
                  element={<WiFiConfigPage />}
                />
              </Route>

              {/* HOD */}
              <Route element={<ProtectedRoute roles={["Admin", "HOD"]} />}>
                <Route
                  path="/user-approvals"
                  element={<UserApprovalList />}
                />
                <Route
                  path="/dashboard/teachers"
                  element={<TeachersManagement />}
                />
                <Route
                  path="/dashboard/dropout-predict"
                  element={<DropoutPredict />}
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        </Suspense>
      </ErrorBoundary>
    </Router>
  );
};

export default App;