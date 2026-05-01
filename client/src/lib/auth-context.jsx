"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { login as reduxLogin, logout as reduxLogout } from "@/redux/authSlice";
import { loginUser, registerUser as apiRegisterUser } from "@/services/userService";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const [loading, setLoading] = useState(true);

  // Instantly clear loader, Redux initializes persistence locally.
  useEffect(() => {
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await loginUser({ email, password });
      const normalizedUser = {
        ...data.user,
        id: data.user?.id || data.user?._id,
      };
      dispatch(reduxLogin({ user: normalizedUser, token: data.token }));
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const data = await apiRegisterUser(userData);
      const normalizedUser = {
        ...data.user,
        id: data.user?.id || data.user?._id,
      };
      dispatch(reduxLogin({ user: normalizedUser, token: data.token }));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    dispatch(reduxLogout());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
