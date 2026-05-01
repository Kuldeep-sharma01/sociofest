import React, { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Activity, Users, BookOpen, TrendingUp } from "lucide-react";
import { getUserCounts } from "@/services/statsService";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { getBannerThemeClasses, getCardThemeClasses } from "@/utils/themeUtils";

const AnalyticsDashboard = () => {
  const { appTheme, isDark } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getUserCounts();
        const data = res.data || res;
        setStats({
          totalUsers: data.totalUsers || 0,
          students: data.students || 0,
          teachers: data.teachers || 0,
          departments: data.departments || []
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-6 max-w-6xl mx-auto"><LoadingSkeleton count={3} /></div>;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-blue-600 to-cyan-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Activity className="w-64 h-64" /></div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Platform Analytics</h1>
          <p className="mt-2 opacity-90 max-w-xl text-lg">Real-time insights and platform engagement metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className={`${getCardThemeClasses(appTheme)} p-6 rounded-2xl shadow-sm border flex items-center gap-4`}>
          <div className="p-4 bg-blue-500/10 rounded-xl text-blue-500"><Users className="w-6 h-6" /></div>
          <div><p className="text-sm opacity-70 font-bold uppercase">Total Users</p><p className="text-3xl font-black text-inherit">{stats?.totalUsers || 0}</p></div>
        </div>
        <div className={`${getCardThemeClasses(appTheme)} p-6 rounded-2xl shadow-sm border flex items-center gap-4`}>
          <div className="p-4 bg-green-500/10 rounded-xl text-green-500"><BookOpen className="w-6 h-6" /></div>
          <div><p className="text-sm opacity-70 font-bold uppercase">Students</p><p className="text-3xl font-black text-inherit">{stats?.students || 0}</p></div>
        </div>
        <div className={`${getCardThemeClasses(appTheme)} p-6 rounded-2xl shadow-sm border flex items-center gap-4`}>
          <div className="p-4 bg-purple-500/10 rounded-xl text-purple-500"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-sm opacity-70 font-bold uppercase">Teachers</p><p className="text-3xl font-black text-inherit">{stats?.teachers || 0}</p></div>
        </div>
      </div>

      {stats?.departments?.length > 0 && (
        <div className={`${getCardThemeClasses(appTheme)} p-6 rounded-2xl shadow-sm border mt-4 flex flex-col gap-4`}>
          <h3 className="text-xl font-bold text-inherit">Users by Department</h3>
          <div className="h-[300px] w-full mt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.departments}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="name" stroke="currentColor" opacity={0.6} /><YAxis stroke="currentColor" opacity={0.6} /><RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: 'transparent', borderRadius: '8px', color: isDark ? '#fff' : '#000' }} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
      )}
    </div>
  );
};
export default AnalyticsDashboard;