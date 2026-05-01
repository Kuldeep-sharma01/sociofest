import React, { useEffect, useState, useCallback } from "react";
import { UserCheck, UserX, Users, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import UserCard from "@/components/ui/UserCard";
import { useTheme } from "@/context/ThemeContext";
import { getConnectionRequests, getConnections as fetchConnections, respondToConnectionRequest } from "@/services/connectionService";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const Network = () => {
  const [requests, setRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { appTheme } = useTheme();

  const fetchData = useCallback(async (signal) => {
    try {
      const [reqRes, connRes] = await Promise.all([
        getConnectionRequests(),
        fetchConnections(),
      ]);
      if (signal?.aborted) return;
      setRequests(reqRes);
      setConnections(connRes);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Failed to fetch network data", error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleRespond = async (requestId, status) => {
    try {
      await respondToConnectionRequest(requestId, status);

      // Remove from requests list
      const handledReq = requests.find((r) => r._id === requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));

      // ✅ After accepting, re-fetch the connections list to get fully populated user objects
      if (status === "accepted") {
        try {
          const connRes = await fetchConnections();
          setConnections(connRes);
        } catch {
          // Optimistic fallback only if re-fetch fails
          if (handledReq) setConnections((prev) => [...prev, handledReq.requester]);
        }
      }
    } catch (error) {
      console.error("Failed to respond", error);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Action failed. Please try again. ❌",
        }),
      );
    }
  };

  if (loading) {
    return <LoadingSkeleton count={3} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pending Requests Section */}
      {requests.length > 0 && (

        <div className={`p-4 rounded-xl shadow-sm transition-colors ${getCardThemeClasses(appTheme)}`}>
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-inherit">
            <UserPlus className="w-5 h-5 text-orange-500" />
            Connection Requests
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {requests.length}
            </span>
          </h3>
          <div className="grid gap-3 grid-cols-1 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
            {requests.map((req) => (
              <UserCard
                key={req._id}
                user={req.requester}
                to={`/profile/${req.requester?._id}`}
                rightElement={
                  <div className="flex w-full sm:w-auto gap-2 shrink-0 mt-2 sm:mt-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRespond(req._id, "accepted");
                      }}
                      className={`flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                    >
                      <UserCheck className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRespond(req._id, "rejected");
                      }}
                      className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-2 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors shadow-sm"
                    >
                      <UserX className="w-4 h-4" /> Ignore
                    </button>
                  </div>
                }
                className="bg-black/5 dark:bg-white/5 border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10"
              />
            ))}
          </div>
        </div>
      )}

      {/* My Connections Section */}
      <div className={`p-4 rounded-xl shadow-sm transition-colors ${getCardThemeClasses(appTheme)}`}>
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-inherit">
          <Users className="w-5 h-5 text-green-600" />
          Your Connections
          <span className="opacity-70 text-sm font-normal">
            ({connections.length})
          </span>
        </h3>

        {connections.length === 0 ? (
          <div className="text-center opacity-70 py-4 text-sm">
            You haven't connected with anyone yet.
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
            {connections.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                to={`/profile/${user._id}`}
                rightElement={
                  <Link
                    to={`/chat?userId=${user._id}`}
                    onClick={(e) => e.stopPropagation()}
                        className="w-full sm:w-auto shrink-0 px-4 py-2 mt-2 sm:mt-0 text-sm font-bold border border-inherit/30 rounded-lg text-center bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-inherit hover:no-underline transition-colors shadow-sm"
                  >
                    Send Message
                  </Link>
                }
                    className="bg-black/5 dark:bg-white/5 border-inherit/30 hover:bg-black/10 dark:hover:bg-white/10"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Network;
