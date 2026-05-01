import React from 'react';
import { Users, User } from 'lucide-react';
import UserCard from './ui/UserCard';
import EmptyState from './ui/EmptyState';
import { getCardThemeClasses } from '../utils/themeUtils';

const ClassroomSection = ({
  subject,
  enrolledUsers,
  appTheme,
  user
}) => {
  const teachers = Array.isArray(subject?.assignedTeacher) 
    ? subject.assignedTeacher.filter(Boolean) 
    : subject?.assignedTeacher ? [subject.assignedTeacher] : [];

  const subjDeptId = subject?.department?._id || subject?.department;
  const students = enrolledUsers.filter((u) => {
    const uDeptId = u.department?._id || u.department;
    const explicitlyEnrolled = u.subjects?.some(
      (s) => String(s._id || s) === String(subject?._id)
    );
    const defaultEnrolled = u.semester === subject?.semester && String(uDeptId) === String(subjDeptId);
    return u.role === "Student" && (explicitlyEnrolled || defaultEnrolled);
  });

  return (
    <section>
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Users className="opacity-80" /> Classroom
      </h2>
      
      <div className={`p-8 rounded-3xl shadow-xl border ${getCardThemeClasses(appTheme)}`}>
        {/* Teachers */}
        <div className="mb-12">
          <h3 className="font-bold text-lg mb-6 border-b pb-3 border-inherit/30 flex items-center gap-2">
            👨‍🏫 Assigned Teachers ({teachers.length})
          </h3>
          {teachers.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {teachers.slice(0, 8).map((teacher, idx) => (
                <UserCard
                  key={teacher?._id || idx}
                  user={teacher}
                  subtitle="View Profile"
                  to={`/profile/${teacher?._id || teacher}`}
                  avatarSize="w-14 h-14"
                  className="flex-shrink-0 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 hover:from-indigo-500/20 hover:to-blue-500/20 border border-indigo-200/50 dark:border-indigo-800/50 shadow-lg hover:shadow-xl transition-all duration-300"
                />
              ))}
              {teachers.length > 8 && (
                <div className="flex items-center justify-center p-6 text-sm font-bold opacity-70 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl min-w-[180px]">
                  +{teachers.length - 8} more
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={User}
              title="No Teachers Assigned"
              description="Subject needs teacher assignment."
              className="py-12"
            />
          )}
        </div>

        {/* Students */}
        <div>
          <h3 className="font-bold text-lg mb-6 border-b pb-3 border-inherit/30 flex items-center gap-2">
            👥 Enrolled Students ({students.length})
          </h3>
          {students.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
              {students.slice(0, 24).map((student) => (
                <UserCard
                  key={student._id}
                  user={student}
                  subtitle={`Roll: ${student.rollNumber || 'N/A'}`}
                  to={`/profile/${student._id}`}
                  avatarSize="w-12 h-12"
                  className="p-3 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 hover:from-emerald-500/10 hover:to-teal-500/10 border border-emerald-200/50 dark:border-emerald-800/50 shadow-md hover:shadow-lg transition-all duration-300 group"
                />
              ))}
              {students.length > 24 && (
                <div className="col-span-full flex items-center justify-center p-8 text-lg font-bold opacity-70 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl">
                  +{students.length - 24} more students
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No Students Enrolled"
              description="Students will auto-enroll based on semester/department."
              className="py-12"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default ClassroomSection;

