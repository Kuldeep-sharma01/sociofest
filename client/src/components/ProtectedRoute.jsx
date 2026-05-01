import React, { useMemo } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { jwtDecode } from "jwt-decode";
import { logout } from "@/redux/authSlice";

export default function ProtectedRoute({ allowedRoles }) {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();

  const tokenValid = useMemo(() => {
    if (!token) return false;
    try {
      const { exp } = jwtDecode(token);
      return exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }, [token]);

  if (!user || !tokenValid) {
    dispatch(logout());
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role?.toLowerCase();
    const roles = allowedRoles.map(r => r.toLowerCase());
    
    if (!roles.includes(userRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
