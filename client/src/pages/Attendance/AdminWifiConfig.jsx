import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Edit2, Wifi } from "lucide-react";
import * as wifiAPI from "@/services/wifiService";
import { getCardThemeClasses, getBannerThemeClasses } from "@/utils/themeUtils";

export default function WiFiConfigPage() {
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = !!user;
  const loading = false;
  const { appTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    ipRange: "",
    schoolName: "",
    location: "",
  });

  useEffect(() => {
    const isAdmin = user?.role?.toLowerCase() === "admin";
    if (!loading && (!isAuthenticated || !isAdmin)) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (user?.role?.toLowerCase() === "admin") {
      loadEntries();
    }
  }, [user]);

  const loadEntries = async () => {
    setPageLoading(true);
    try {
      const data = await wifiAPI.getWhitelist();
      setEntries(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load WiFi entries";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    } finally {
      setPageLoading(false);
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.ipRange || !formData.schoolName) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "IP Range and School Name are required ⚠️" }));
      return;
    }

    try {
      const newEntry = await wifiAPI.addWhitelist(formData);
      setEntries([...entries, newEntry]);
      setFormData({ ipRange: "", schoolName: "", location: "" });
      setShowForm(false);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "WiFi entry added successfully ✅" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add entry";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      await wifiAPI.deleteWhitelist(id);
      setEntries(entries.filter((entry) => entry._id !== id));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "WiFi entry deleted successfully ✅" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete entry";
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${msg} ❌` }));
    }
  };

  if (loading || !user || user.role?.toLowerCase() !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
        {/* Header Banner */}
        <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-cyan-600 to-blue-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors`}>
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Wifi className="w-64 h-64" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">WiFi Whitelist Configuration</h1>
            <p className="mt-2 opacity-90 max-w-xl text-lg font-medium">Manage secure campus networks for attendance verification.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="relative z-10 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm shadow-sm transition-all active:scale-95 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shrink-0">
            <Plus className="w-5 h-5" /> Add WiFi Range
          </Button>
        </div>

        {/* Add Entry Form */}
        {showForm && (
          <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
            <CardHeader>
              <CardTitle>Add New WiFi Range</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">IP Range (CIDR)</label>
                  <Input
                    placeholder="e.g., 192.168.1.0/24"
                    value={formData.ipRange}
                    onChange={(e) =>
                      setFormData({ ...formData, ipRange: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs opacity-70 text-inherit">
                    Enter the IP range in CIDR notation (e.g., 10.0.0.0/8)
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">School Name</label>
                  <Input
                    placeholder="e.g., XYZ University"
                    value={formData.schoolName}
                    onChange={(e) =>
                      setFormData({ ...formData, schoolName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Location (Optional)
                  </label>
                  <Input
                    placeholder="e.g., Main Campus, Lab A"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit">Add Entry</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* WiFi Entries Table */}
        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
          <CardHeader>
            <CardTitle>Whitelisted WiFi Ranges</CardTitle>
          </CardHeader>
          <CardContent>
            {pageLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center opacity-70 text-inherit py-8">
                <p>No WiFi ranges configured yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Range</TableHead>
                      <TableHead>School Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell className="font-mono text-sm">
                          {entry.ipRange}
                        </TableCell>
                        <TableCell>{entry.schoolName}</TableCell>
                        <TableCell className="text-sm opacity-80 text-inherit">
                          {entry.location || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.isActive ? "default" : "secondary"}
                          >
                            {entry.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm opacity-80 text-inherit">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent("showToast", { detail: "Edit functionality coming soon 🚧" }));
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry._id)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-blue-500/10 border border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-base">About WiFi Whitelisting</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 dark:text-blue-300 space-y-3">
            <p>
              WiFi whitelisting ensures that students can only mark attendance
              while connected to the school's network. This adds an extra layer
              of security to prevent unauthorized attendance marking from
              outside the campus.
            </p>
            <p>
              <strong>CIDR Notation:</strong> Enter IP ranges in CIDR format:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>192.168.1.0/24 (255 IP addresses)</li>
              <li>10.0.0.0/8 (16 million IP addresses)</li>
              <li>172.16.0.0/12 (1 million IP addresses)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
  );
}
