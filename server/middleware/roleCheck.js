// server/middleware/roleCheck.js

/**
 * Role-based Access Control Middleware
 * Ensures only users with allowed roles can access specific routes
 */

export const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }

  
  

    // Flatten array if nested and make case-insensitive comparison
    const roles = allowedRoles.flat();
    const userRole = String(req.user.role || "").toLowerCase();
const allowedRolesLower = allowedRoles.flat().map((r) => String(r).toLowerCase());

    if (!allowedRolesLower.includes(userRole.toLowerCase())) {
      console.warn(`[RoleCheck] Access denied for user ${req.user._id} (${userRole}) on path ${req.originalUrl}. Allowed: ${allowedRolesLower.join(', ')}`);
      return res.status(403).json({
        message: `Access denied. Role '${userRole}' not authorized.`,
      });
    }

    next();
  };
};
