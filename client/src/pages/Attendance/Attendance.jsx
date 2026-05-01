import { useSelector } from "react-redux";
import { useTheme } from "@/context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  getStudentAttendance,
  getAttendanceStats,
  getCurriculumAttendance,
  markAttendance,
} from "@/services/attendanceService";
import { getAllUsers } from "@/services/userService";
import { getRoleProfile } from "@/utils/roleUtils";
import { Camera, Download, CheckCircle, XCircle, Calendar, Clock, Percent, ClipboardList, FileText, AlertCircle } from "lucide-react";
import {
  getStatusColor as getThemeStatusColor,
  getThemeSoftBg,
  getThemeHoverBg,
  getCardThemeClasses,
  getBannerThemeClasses,
} from "@/utils/themeUtils";

export default function AttendancePage() {
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = !!user;
  const loading = false;
  const { appTheme } = useTheme();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0,
  });
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user?.id) {
      if (user.role?.toLowerCase() === "student") {
        loadAttendance();
      } else {
        loadTeacherCurricula();
      }
    }
  }, [user]);

  useEffect(() => {
    if (user?.role?.toLowerCase() !== "student" && selectedClass) {
      loadTeacherData();
    }
  }, [selectedClass]);

  const loadAttendance = async () => {
    setPageLoading(true);
    try {
      const [attendanceData, statsData] = await Promise.all([
        getStudentAttendance(user.id || user._id),
        getAttendanceStats(user.id || user._id),
      ]);
      setAttendance(attendanceData);
      setStats(statsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load attendance";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setPageLoading(false);
    }
  };

  const loadTeacherCurricula = async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const profile = await getRoleProfile(user.role, user._id);
      const curriculaData = profile?.subjects || [];
      setTeacherClasses(curriculaData);
      if (curriculaData.length > 0) {
        setSelectedClass(curriculaData[0]._id);
      } else {
        setPageLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load teacher curricula";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
      setPageLoading(false);
    }
  };

  const loadTeacherData = async () => {
    try {
      const [studentsResponse, attendanceData] = await Promise.all([
        getAllUsers({ role: "Student" }),
        getCurriculumAttendance(selectedClass),
      ]);
      const studentsData = Array.isArray(studentsResponse) ? studentsResponse : (studentsResponse?.users || studentsResponse?.data || []);
      setStudents(studentsData.filter((s) => s.role === "Student")); // Now safely filtering an array
      setAttendance(attendanceData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load class data";
      setError(msg);
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      if (pageLoading) {
        setPageLoading(false);
      }
    }
  };

  const handleTeacherMark = async (studentId, status) => {
    try {
      await markAttendance({
        studentId: studentId,
        curriculum: selectedClass,
        status,
        recognitionMethod: "manual",
        recognitionConfidence: 0,
      });
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Attendance marked ${status} ✅` }));
      loadTeacherData(); // Refresh the list to show the new tick
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to mark attendance";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const handleExportCSV = () => {
    if (!attendance.length) return;

    const headers = ["Date", "Status", "Method", "Confidence", "Time"];
    const csvRows = attendance.map((record) => [
      new Date(record.date).toLocaleDateString(),
      record.status,
      record.recognitionMethod,
      record.recognitionConfidence
        ? `${(record.recognitionConfidence * 100).toFixed(1)}%`
        : "N/A",
      new Date(record.date).toLocaleTimeString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Attendance_Export_${selectedClass}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    window.dispatchEvent(new CustomEvent("showToast", { detail: "Attendance exported successfully! 📥" }));
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const getStatusColor = (status) => getThemeStatusColor(status);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header Banner */}
        <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-indigo-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <CheckCircle className="w-64 h-64" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Attendance Management</h1>
              <p className="mt-2 opacity-90 max-w-xl text-lg font-medium">Manage and analyze attendance with real-time insights.</p>
            </div>
            {user.role?.toLowerCase() === "student" && (
              <Button onClick={() => navigate("/dashboard/mark-attendance")} className="relative z-10 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shadow-sm transition-all active:scale-95 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shrink-0">
                <Camera className="w-5 h-5" /> Mark Attendance
              </Button>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        {user.role?.toLowerCase() === "student" && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-5 bg-gradient-to-br from-slate-500 to-slate-700 text-white rounded-2xl shadow-md relative overflow-hidden group">
              <Calendar className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-3xl font-extrabold">{stats.total || 0}</div>
                <div className="text-sm opacity-90 font-medium mt-1 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Total Classes</div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl shadow-md relative overflow-hidden group">
              <CheckCircle className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-3xl font-extrabold">{stats.present || 0}</div>
                <div className="text-sm opacity-90 font-medium mt-1 flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> Present</div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-2xl shadow-md relative overflow-hidden group">
              <XCircle className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-3xl font-extrabold">{stats.absent || 0}</div>
                <div className="text-sm opacity-90 font-medium mt-1 flex items-center gap-1.5"><XCircle className="w-4 h-4"/> Absent</div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-2xl shadow-md relative overflow-hidden group">
              <Clock className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-3xl font-extrabold">{stats.late || 0}</div>
                <div className="text-sm opacity-90 font-medium mt-1 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Late</div>
              </div>
            </div>
            <div className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-md relative overflow-hidden group">
              <Percent className="absolute -right-4 -bottom-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="text-3xl font-extrabold">{stats.percentage || 0}%</div>
                <div className="text-sm opacity-90 font-medium mt-1 flex items-center gap-1.5"><Percent className="w-4 h-4"/> Overall Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Teacher/HOD Verification View */}
        {user.role?.toLowerCase() !== "student" && (
          <>
            <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20 mb-6 rounded-2xl shadow-sm`}>
              <CardHeader className="bg-black/5 dark:bg-white/5 border-b border-inherit/10 pb-4 rounded-t-2xl">
                <CardTitle className="text-inherit flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                  Class Management
                </CardTitle>
                <p className="text-sm opacity-70 text-inherit font-medium mt-1">Select a curriculum to view students and mark manual attendance.</p>
              </CardHeader>
              <CardContent>
                {teacherClasses.length > 0 ? (
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherClasses.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name} ({c.code || 'N/A'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg flex items-center gap-2 text-sm font-medium border border-orange-500/20 mt-4">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    No curricula found. Please create a curriculum to manage class attendance.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`mb-6 ${getCardThemeClasses(appTheme)} border-inherit/20 rounded-2xl shadow-sm`}>
              <CardHeader
                className={`bg-black/5 dark:bg-white/5 border-b pb-4 rounded-t-2xl border-inherit/10`}
              >
                <CardTitle className="text-inherit flex items-center gap-2">
                   <CheckCircle className="w-5 h-5 text-emerald-500" /> 
                   Daily Verification
                </CardTitle>
                <p className="text-sm opacity-70 text-inherit font-medium mt-1">Review today's AI-marked attendance or manually override status for students in {teacherClasses.find(c => c._id === selectedClass)?.name || "the selected class"}.</p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-inherit/20 hover:bg-transparent uppercase tracking-wider text-xs">
                        <TableHead className="text-inherit opacity-80">Student Name</TableHead>
                        <TableHead className="text-inherit opacity-80">Enrollment No.</TableHead>
                        <TableHead className="text-inherit opacity-80">Today's Status</TableHead>
                        <TableHead className="text-inherit opacity-80 text-right">Manual Verification</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-inherit opacity-60 italic">No students enrolled in this class.</TableCell>
                        </TableRow>
                      ) : (
                        students.map((student) => {
                          const todayRecord = attendance.find(
                            (a) =>
                              String(a.student?._id) === String(student._id) &&
                              new Date(a.date).toDateString() ===
                                new Date().toDateString(),
                          );
                          return (
                            <TableRow key={student._id} className="border-inherit/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <TableCell className="font-bold text-inherit">
                                {student.name}
                              </TableCell>
                              <TableCell className="text-inherit opacity-80 font-mono text-sm">
                                {student.enrollmentNumber || "N/A"}
                              </TableCell>
                              <TableCell>
                                {todayRecord ? (
                                  <Badge
                                    className={getStatusColor(todayRecord.status)}
                                  >
                                    {todayRecord.status.toUpperCase()}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-inherit/30 text-inherit opacity-70">Not Marked</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={`text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 ${getThemeHoverBg(appTheme)}`}
                                    onClick={() =>
                                      handleTeacherMark(student._id, "present")
                                    }
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />{" "}
                                    Present
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                                    onClick={() =>
                                      handleTeacherMark(student._id, "absent")
                                    }
                                  >
                                    <XCircle className="w-4 h-4 mr-1" /> Absent
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Attendance Records */}
        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20 rounded-2xl shadow-sm overflow-hidden`}>
          <CardHeader className="flex flex-row items-center justify-between bg-black/5 dark:bg-white/5 border-b border-inherit/10 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-500" />
                Attendance History
              </CardTitle>
              <p className="text-sm opacity-70 text-inherit font-medium mt-1">A detailed log of all recorded attendance sessions.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={attendance.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : error ? (
              <div className="text-center text-red-600 dark:text-red-400 font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20 my-4">{error}</div>
            ) : attendance.length === 0 ? (
              <div className="text-center text-inherit opacity-70 py-8">
                <p>No attendance records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-inherit/20 hover:bg-transparent uppercase tracking-wider text-xs">
                      <TableHead className="text-inherit opacity-80">Date</TableHead>
                      <TableHead className="text-inherit opacity-80">Status</TableHead>
                      <TableHead className="text-inherit opacity-80">Method</TableHead>
                      <TableHead className="text-inherit opacity-80">Confidence</TableHead>
                      <TableHead className="text-inherit opacity-80">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record._id} className="border-inherit/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium text-inherit">
                          {new Date(record.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status.charAt(0).toUpperCase() +
                              record.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-inherit opacity-90">
                          {record.recognitionMethod === "facial_recognition"
                            ? "Face Recognition"
                            : record.recognitionMethod === "qr_code"
                              ? "QR Code"
                              : "Manual"}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-inherit opacity-80">
                          {record.recognitionConfidence
                            ? `${(record.recognitionConfidence * 100).toFixed(1)}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-inherit opacity-80">
                          {new Date(record.date).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
