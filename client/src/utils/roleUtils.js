import { getAllSubjects } from "@/services/subjectService";
import { getHODProfile, getStudentProfile, getTeacherProfile } from "@/services/userService";

export const ROLE_STUDENT = "Student";
export const ROLE_TEACHER = "Teacher";
export const ROLE_HOD = "HOD";
export const ROLE_ADMIN = "Admin";

export const isStudentRole = (role) => role === ROLE_STUDENT;
export const isTeacherRole = (role) => role === ROLE_TEACHER;
export const isHODRole = (role) => role === ROLE_HOD;
export const isAdminRole = (role) => role === ROLE_ADMIN;
export const isAdminOrHOD = (role) => isAdminRole(role) || isHODRole(role);
export const isTeacherOrHOD = (role) => isTeacherRole(role) || isHODRole(role);
export const isFacultyRole = (role) => isAdminOrHOD(role) || isTeacherRole(role);
export const isNonStudentRole = isFacultyRole;

export const canViewDepartmentContent = (role, isSameDept) =>
  isAdminRole(role) || isSameDept;

export const canConfigureCodeCompiler = isAdminOrHOD;

export const canViewOtherDashboard = (currentRole, targetRole) => {
  if (!currentRole || !targetRole) return false;
  if (currentRole === ROLE_ADMIN) return true;
  if (currentRole === ROLE_STUDENT) return false;
  if (currentRole === ROLE_TEACHER) return targetRole === ROLE_STUDENT;
  if (currentRole === ROLE_HOD)
    return targetRole === ROLE_STUDENT || targetRole === ROLE_TEACHER;
  return false;
};

export const getRoleProfile = async (role, userId) => {
  if (!role || !userId) return null;
  if (isStudentRole(role)) return getStudentProfile(userId);
  if (isTeacherRole(role)) return getTeacherProfile(userId);
  if (isHODRole(role)) return getHODProfile(userId);
  return null;
};

export const getRoleSubjects = async (role, user) => {
  if (!role) return [];
  if (isAdminRole(role)) return getAllSubjects();
  if (!user?._id) return [];

  const profile = await getRoleProfile(role, user._id);
  return profile?.subjects || [];
};
