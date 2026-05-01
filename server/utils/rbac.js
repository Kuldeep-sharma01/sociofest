/**
 * server/utils/rbac.js
 * Enhanced Role-Based Access Control System
 * Defines permissions for each role with resource-level granularity
 */

export const ROLES = {
  ADMIN: 'Admin',
  HOD: 'HOD',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  SELLER: 'Seller',
  GUEST: 'Guest',
};

export const VALID_ROLES = [
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.HOD,
  ROLES.ADMIN,
  ROLES.SELLER
];

/**
 * Permission Matrix: Defines what each role can do
 * Structure: PERMISSIONS[role][resource][action]
 */
export const PERMISSIONS = {
  [ROLES.ADMIN]: {
    // Admin: Full access to everything
    users: {
      view: 'selfAndAll',       // Can view all users
      create: true,
      edit: 'all',              // Can edit any user
      delete: 'all',
      approve: true,
      block: true,
      viewActivity: 'all',      // Can view all user activities
    },
    departments: {
      view: 'all',
      create: true,
      edit: 'all',
      delete: 'all',
      manage: true,
    },
    events: {
      view: 'all',
      create: true,
      edit: 'all',
      delete: 'all',
      publish: true,
    },
    assignments: {
      view: 'all',
      create: 'allDepartments',
      edit: 'all',
      delete: 'all',
      grade: 'all',
    },
    quizzes: {
      view: 'all',
      create: 'allDepartments',
      edit: 'all',
      delete: 'all',
      grade: 'all',
    },
    materials: {
      view: 'all',
      create: 'allDepartments',
      edit: 'all',
      delete: 'all',
    },
    posts: {
      view: 'all',
      create: 'allDepartments',
      edit: 'all',
      delete: 'all',
      approve: true,
    },
    activityLogs: {
      view: 'all',              // Macro view: all activities
      export: true,
      analyze: true,
    },
    reports: {
      view: 'all',
      create: true,
      export: true,
      analyze: true,
    },
    analytics: {
      view: 'all',              // Global dashboard
      drill: true,
    },
  },

  [ROLES.HOD]: {
    // HOD: Department-level admin
    users: {
      view: 'departmentAndSelf',
      create: false,            // Cannot create users
      edit: 'department',       // Can edit department users only
      delete: false,
      approve: false,
      block: 'department',      // Can block department users
      viewActivity: 'department', // Can view department member activities
    },
    departments: {
      view: 'ownDepartment',
      create: false,
      edit: 'ownDepartment',
      delete: false,
      manage: true,             // Can manage own department
    },
    events: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreatedAndDepartment',
      delete: 'ownCreated',
      publish: 'ownDepartment',
    },
    assignments: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreatedAndDepartment',
      delete: 'ownCreated',
      grade: 'ownDepartment',
    },
    quizzes: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreatedAndDepartment',
      delete: 'ownCreated',
      grade: 'ownDepartment',
    },
    materials: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreatedAndDepartment',
      delete: 'ownCreated',
    },
    posts: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreatedAndDepartment',
      delete: 'ownCreated',
      approve: 'department',
    },
    activityLogs: {
      view: 'department',        // Macro view: department activities
      export: true,
      analyze: true,
    },
    reports: {
      view: 'department',
      create: true,
      export: true,
      analyze: true,
    },
    analytics: {
      view: 'department',        // Department dashboard
      drill: true,
    },
  },

  [ROLES.TEACHER]: {
    // Teacher: Can manage own content and view department data
    users: {
      view: 'departmentAndConnections',
      create: false,
      edit: 'self',
      delete: false,
      approve: false,
      block: false,
      viewActivity: 'self',     // Can only view own activities
    },
    departments: {
      view: 'ownDepartment',
      create: false,
      edit: false,
      delete: false,
      manage: false,
    },
    events: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreated',
      delete: 'ownCreated',
      publish: 'ownCreated',
    },
    assignments: {
      view: 'ownSubjectsAndPublic',
      create: 'ownSubjects',
      edit: 'ownCreated',
      delete: 'ownCreated',
      grade: 'ownSubjects',
    },
    quizzes: {
      view: 'ownSubjectsAndPublic',
      create: 'ownSubjects',
      edit: 'ownCreated',
      delete: 'ownCreated',
      grade: 'ownSubjects',
    },
    materials: {
      view: 'ownSubjectsAndPublic',
      create: 'ownSubjects',
      edit: 'ownCreated',
      delete: 'ownCreated',
    },
    posts: {
      view: 'departmentAndPublic',
      create: 'ownDepartment',
      edit: 'ownCreated',
      delete: 'ownCreated',
      approve: false,
    },
    activityLogs: {
      view: 'self',              // Micro view: personal activities only
      export: false,
      analyze: false,
    },
    reports: {
      view: 'ownCreated',
      create: false,
      export: false,
      analyze: false,
    },
    analytics: {
      view: 'ownContent',        // Personal dashboard
      drill: false,
    },
  },

  [ROLES.SELLER]: {
    // Seller: Can manage their own products and view their own profile
    users: {
      view: 'self',
      create: false,
      edit: 'self',
      delete: false,
      approve: false,
      block: false,
      viewActivity: 'self',
    },
    events: {
      view: 'departmentAndPublic',
      create: false,
      edit: false,
      delete: false,
      publish: false,
    },
    assignments: {
      view: 'public',
      create: false,
      edit: false,
      delete: false,
      grade: false,
    },
    quizzes: {
      view: 'public',
      create: false,
      edit: false,
      delete: false,
      grade: false,
    },
    materials: {
      view: 'public',
      create: false,
      edit: false,
      delete: false,
    },
    posts: {
      view: 'public',
      create: false,
      edit: false,
      delete: false,
      approve: false,
    },
    activityLogs: {
      view: 'self',
      export: false,
      analyze: false,
    },
    reports: {
      view: 'self',
      create: false,
      export: false,
      analyze: false,
    },
    analytics: {
      view: 'self',
      drill: false,
    },
  },

  [ROLES.STUDENT]: {
    // Student: Can only access own content
    users: {
      view: 'publicAndConnections',
      create: false,
      edit: 'self',
      delete: false,
      approve: false,
      block: false,
      viewActivity: 'self',
    },
    departments: {
      view: 'ownDepartment',
      create: false,
      edit: false,
      delete: false,
      manage: false,
    },
    events: {
      view: 'departmentAndPublic',
      create: false,
      edit: false,
      delete: false,
      publish: false,
    },
    assignments: {
      view: 'enrolledSubjects',
      create: false,
      edit: false,
      delete: false,
      grade: false,
    },
    quizzes: {
      view: 'enrolledSubjects',
      create: false,
      edit: false,
      delete: false,
      grade: false,
    },
    materials: {
      view: 'enrolledSubjects',
      create: false,
      edit: false,
      delete: false,
    },
    posts: {
      view: 'public',
      create: 'ownDepartment',
      edit: 'ownCreated',
      delete: 'ownCreated',
      approve: false,
    },
    activityLogs: {
      view: 'self',              // Micro view: only own activities
      export: false,
      analyze: false,
    },
    reports: {
      view: 'ownSubmissions',
      create: false,
      export: false,
      analyze: false,
    },
    analytics: {
      view: 'self',              // Student personal dashboard
      drill: false,
    },
  },

  [ROLES.GUEST]: {
    // Guest: Read-only public access
    users: {
      view: 'public',
      create: false,
      edit: false,
      delete: false,
      approve: false,
      block: false,
      viewActivity: false,
    },
    events: {
      view: 'publicOnly',
      create: false,
      edit: false,
      delete: false,
      publish: false,
    },
    posts: {
      view: 'publicOnly',
      create: false,
      edit: false,
      delete: false,
      approve: false,
    },
  },
};

/**
 * Check if a user has permission for a resource action
 * @param {string} role - User role
 * @param {string} resource - Resource name (e.g., 'users', 'events')
 * @param {string} action - Action name (e.g., 'view', 'edit', 'delete')
 * @returns {string|boolean} Permission scope or boolean
 */
export const hasPermission = (role, resource, action) => {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  
  const permission = resourcePermissions[action];
  return permission || false;
};

/**
 * Check multiple permissions (can do any of them)
 */
export const hasAnyPermission = (role, checks) => {
  return checks.some(({ resource, action }) => hasPermission(role, resource, action));
};

/**
 * Check multiple permissions (must do all of them)
 */
export const hasAllPermissions = (role, checks) => {
  return checks.every(({ resource, action }) => hasPermission(role, resource, action));
};

/**
 * Role hierarchy: Admin > HOD > Teacher > Student
 */
export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.HOD]: 3,
  [ROLES.TEACHER]: 2,
  [ROLES.STUDENT]: 1,
  [ROLES.SELLER]: 1,
  [ROLES.GUEST]: 0,
};

/**
 * Check if one role is higher or equal in hierarchy than another
 */
export const isRoleHigherOrEqual = (role1, role2) => {
  return (ROLE_HIERARCHY[role1] || 0) >= (ROLE_HIERARCHY[role2] || 0);
};

/**
 * Get all roles that can perform an action on a resource
 */
export const getRolesWithPermission = (resource, action) => {
  return Object.entries(PERMISSIONS)
    .filter(([, perms]) => perms[resource] && perms[resource][action])
    .map(([role]) => role);
};
