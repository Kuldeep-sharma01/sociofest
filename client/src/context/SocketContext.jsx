import React, { createContext, useContext, useEffect, useState } from "react";
import io from "socket.io-client";
import { useSelector } from "react-redux";
import { API_URL } from "@/config/constants";

const SocketContext = createContext(null);

export const useSocket = () => {
  return useContext(SocketContext);
};

const resolveSocketEndpoint = () => {
  // When API_URL is absolute (e.g. https://api.example.com/api), strip trailing /api.
  if (/^https?:\/\//i.test(API_URL)) {
    return API_URL.replace(/\/api\/?$/i, "");
  }

  // When API_URL is relative (e.g. /api), connect to current origin.
  return window.location.origin;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const user = useSelector((state) => state.auth.user);

  const userId = user?._id;

  useEffect(() => {
    if (user && userId) {
      const ENDPOINT = resolveSocketEndpoint();
      const newSocket = io(ENDPOINT, {
        auth: { token: localStorage.getItem("token") },
      });

      // Join user-specific and department rooms for real-time notifications
      newSocket.on("connected", () => {
        // Join department room so quiz/event notifications from dept are received
        if (user.department) {
          newSocket.emit("join-room", `dept:${user.department}`);
        }
      });
      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [userId]); // Only reconnect if userId changes

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
