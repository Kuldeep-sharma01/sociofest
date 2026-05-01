import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Users, Briefcase, Mail, Shield } from "lucide-react";
import { getAllUsers } from "@/services/userService";
import { getBannerThemeClasses, getCardThemeClasses } from "@/utils/themeUtils";
import UserCard from "@/components/ui/UserCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

const TeachersManagement = () => {
  const { appTheme } = useTheme();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await getAllUsers({ role: "Teacher", limit: 500 });
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
        setTeachers(data);
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTeachers();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-indigo-600 to-purple-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Briefcase className="w-64 h-64" /></div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Teachers Management</h1>
          <p className="mt-2 opacity-90 max-w-xl text-lg">Oversee faculty members, assignments, and departmental workloads.</p>
        </div>
      </div>

      {loading ? <LoadingSkeleton count={3} /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {teachers.map(teacher => (
            <div key={teacher._id} className={`${getCardThemeClasses(appTheme)} p-5 rounded-2xl shadow-sm border transition-colors flex flex-col gap-4`}>
              <UserCard user={teacher} showText={true} className="border-none shadow-none p-0 bg-transparent hover:bg-transparent" />
              <div className="flex flex-col gap-2 pt-4 border-t border-inherit/20 text-sm text-inherit"><p className="flex items-center gap-2 opacity-80"><Mail className="w-4 h-4"/> {teacher.email}</p><p className="flex items-center gap-2 opacity-80"><Shield className="w-4 h-4"/> Dept: {teacher.department?.name || 'Unknown'}</p>{teacher.teacherData?.experience && (<p className="flex items-center gap-2 opacity-80"><Briefcase className="w-4 h-4"/> {teacher.teacherData.experience} Years Experience</p>)}</div>
            </div>
          ))}
          {teachers.length === 0 && <div className="col-span-full text-center py-12 opacity-60"><Users className="w-16 h-16 mx-auto mb-3 opacity-50" /><p>No teachers found.</p></div>}
        </div>
      )}
    </div>
  );
}
export default TeachersManagement;