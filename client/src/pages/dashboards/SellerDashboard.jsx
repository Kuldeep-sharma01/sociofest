import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Store,
  Mail,
  MapPin,
  Tag,
  Box,
  BarChart3,
  Edit2,
  Briefcase,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser as updateAuthUser } from "@/redux/authSlice";
import { updateUserProfile, getAllUsers } from "@/services/userService";
import { getProducts } from "@/services/productService";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import InfoItem from "@/components/ui/InfoItem";
import Signup from "@/pages/Signup";
import { useTheme } from "@/context/ThemeContext";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
);

const SellerDashboard = ({ userId, isViewingOther, targetUser }) => {
  const authUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const activeUserId = userId || authUser?._id;
  const activeUserObj = targetUser || authUser;
  const { appTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [myProducts, setMyProducts] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [productsRes, usersRes] = await Promise.all([
          getProducts().catch(() => []),
          getAllUsers({ role: "Student" }).catch(() => []),
        ]);

        setMyProducts(
          productsRes.filter(
            (p) => String(p.seller._id) === String(activeUserId),
          ),
        );
        setStudents(Array.isArray(usersRes) ? usersRes : []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (activeUserId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [activeUserId]);

  const handleUpdateProfile = async (payload) => {
    setUpdating(true);
    try {
      const data = await updateUserProfile(activeUserId, payload);
      if (!isViewingOther) dispatch(updateAuthUser(data.user));
      setIsEditing(false);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Profile updated successfully! 🎉",
        }),
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to update profile. ❌",
        }),
      );
    } finally {
      setUpdating(false);
    }
  };

  // Advanced Market Analytics Aggregation
  const { deptChartData, semChartData } = useMemo(() => {
    const deptCounts = {};
    const semCounts = {};

    students.forEach((s) => {
      const dName = s.department?.name || "Unknown";
      const sem = s.semester ? `Sem ${s.semester}` : "Unknown";
      deptCounts[dName] = (deptCounts[dName] || 0) + 1;
      semCounts[sem] = (semCounts[sem] || 0) + 1;
    });

    return {
      deptChartData: {
        labels: Object.keys(deptCounts),
        datasets: [
          {
            label: "Students Enrolled",
            data: Object.values(deptCounts),
            backgroundColor: [
              "#3b82f6",
              "#8b5cf6",
              "#ec4899",
              "#f97316",
              "#10b981",
            ],
            borderRadius: 4,
          },
        ],
      },
      semChartData: {
        labels: Object.keys(semCounts),
        datasets: [
          {
            data: Object.values(semCounts),
            backgroundColor: [
              "#60a5fa",
              "#a78bfa",
              "#f472b6",
              "#fb923c",
              "#34d399",
              "#facc15",
              "#f87171",
              "#818cf8",
            ],
            borderWidth: 0,
          },
        ],
      },
    };
  }, [students]);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto p-6">
        <LoadingSkeleton count={3} />
      </div>
    );

  if (isEditing) {
    return (
      <div className="flex flex-col">
        <Signup
          isEditMode={true}
          initialData={{ user: activeUserObj }}
          onSave={handleUpdateProfile}
          onCancel={() => setIsEditing(false)}
          isUpdating={updating}
        />
        <div className="max-w-xl mx-auto w-full px-4 sm:px-6 mb-10 mt-4">
          <div
            className={`p-6 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
          >
            <EmailManager
              user={activeUserObj}
              setUser={(u) => dispatch(updateAuthUser(u))}
            />
          </div>
        </div>
      </div>
    );
  }

  const sellerData = activeUserObj?.sellerData || activeUserObj || {};

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-8 animate-in fade-in duration-500">
      <DashboardHeader
        icon={Store}
        title={
          isViewingOther
            ? `${activeUserObj?.name}'s Merchant Profile`
            : `Welcome back, ${activeUserObj?.name}! 🏪`
        }
        subtitle="Manage your industrial listings, monitor store performance, and analyze campus demographics."
        gradientClass="from-emerald-600 to-teal-800"
      />

      {/* Merchant Profile Details */}
      <div
        className={`p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-inherit">
            <Briefcase className="text-current opacity-80 w-7 h-7" /> Business Details
          </h2>
          {!isViewingOther && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-inherit/30 text-inherit hover:bg-black/10 dark:hover:bg-white/10 hover:scale-105 rounded-xl font-bold shadow-sm transition-all active:scale-95"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoItem
            icon={Store}
            label="Merchant Name"
            value={sellerData?.companyName || activeUserObj?.name}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Mail}
            label="Business Email"
            value={activeUserObj?.email}
            colorClass="text-current opacity-80"
          />
          <InfoItem
            icon={Tag}
            label="Store Type"
            value={sellerData?.businessType || "Industrial Seller"}
            colorClass="text-current opacity-80"
          />
          {activeUserObj?.location && (
            <InfoItem
              icon={MapPin}
              label="Location"
              value={activeUserObj.location}
              colorClass="text-current opacity-80"
            />
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* My Products Section */}
        <div
          className={`lg:col-span-2 p-6 rounded-2xl shadow-sm border transition-colors flex flex-col ${getCardThemeClasses(appTheme)}`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-inherit">
              <Box className="w-6 h-6 text-current opacity-80" /> Active Listings
            </h2>
            {!isViewingOther && (
              <Link
                to="/marketplace"
                className={`text-sm font-bold px-4 py-2 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
              >
                Manage Products
              </Link>
            )}
          </div>
          {myProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-60 text-center py-10">
              <Box className="w-16 h-16 mb-4" />
              <p className="font-bold text-lg">No Products Listed</p>
              <p className="text-sm">Go to the Marketplace to start selling.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full pr-2">
              {myProducts.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-inherit/30 shadow-sm relative overflow-hidden group"
                >
                  <img
                    src={(() => {
                      const imgPath =
                        typeof p.images?.[0] === "string"
                          ? p.images[0]
                          : p.images?.[0]?.path;
                      return imgPath?.startsWith("http")
                        ? imgPath
                        : `/${imgPath}`;
                    })()}
                    className="w-20 h-20 object-cover rounded-lg bg-black/10 shrink-0"
                    alt="Product"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-inherit truncate">
                      {p.title}
                    </h4>
                    <p className="text-sm text-green-600 dark:text-green-400 font-black mb-1">
                      ₹{p.price}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-white shadow-sm ${p.status === "Available" ? "bg-green-500" : p.status === "Reserved" ? "bg-yellow-500" : "bg-red-500"}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.status === "Sold" && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                      <span className="text-white font-black text-xl rotate-[-15deg] uppercase tracking-widest drop-shadow-md">
                        Sold
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Market Insights (Student Demographics) */}
        <div
          className={`p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
        >
          <h2 className="text-xl font-bold flex items-center gap-2 text-inherit mb-2">
            <BarChart3 className="w-6 h-6 text-current opacity-80" /> Market Insights
          </h2>
          <p className="text-xs opacity-70 mb-6 text-inherit">
            Analyze campus student distribution to target your inventory better.
          </p>

          <div className="flex flex-col gap-8">
            <div>
              <h4 className="text-sm font-bold text-center mb-4 text-inherit uppercase tracking-wider opacity-80">
                Students by Semester
              </h4>
              <div className="w-48 h-48 mx-auto">
                {students.length > 0 ? (
                  <Doughnut
                    data={semChartData}
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-black/5 rounded-full flex items-center justify-center opacity-50 text-xs">
                    No Data
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-center mb-4 text-inherit uppercase tracking-wider opacity-80">
                Top Departments
              </h4>
              <div className="w-full h-40">
                {students.length > 0 ? (
                  <Bar
                    data={deptChartData}
                    options={{
                      maintainAspectRatio: false,
                      indexAxis: "y",
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { display: false },
                        y: {
                          ticks: {
                            color:
                              appTheme === "midnight" || appTheme === "discord"
                                ? "#fff"
                                : "#888",
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-black/5 rounded-xl flex items-center justify-center opacity-50 text-xs">
                    No Data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
