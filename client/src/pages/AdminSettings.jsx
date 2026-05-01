import React, { useState, useEffect } from 'react';
import adminService from '@/services/adminService';
import { pythonAPI } from '@/lib/api';
import { Cloud, Database, HardDrive, Server, ArrowUp, ArrowDown, LayoutList } from 'lucide-react';

const DEFAULT_NAV_CONFIG = [
  { path: "/", label: "Home Feed", visible: true, order: 1 },
  { path: "/chat", label: "Chat", visible: true, order: 2 },
  { path: "/dashboard", label: "Dashboard", visible: true, order: 3 },
  { path: "/ai-hub", label: "AI Hub", visible: true, order: 4 },
  { path: "/study-hub", label: "Study Hub", visible: true, order: 5 },
  { path: "/activities", label: "Activities", visible: true, order: 6 },
  { path: "/attendance", label: "Attendance", visible: true, order: 7 },
  { path: "/marketplace", label: "Marketplace", visible: true, order: 8 },
  { path: "/profile", label: "Public Profile", visible: true, order: 9 },
  { path: "/notice-board", label: "Notice Board", visible: true, order: 10 },
  { path: "/ai-gallery", label: "Gallery", visible: true, order: 11 },
  { path: "/compiler", label: "Compiler", visible: true, order: 12 },
  { path: "/dashboard/mark-attendance", label: "Mark Attendance", visible: true, order: 13 },
  { path: "/dashboard/register-face", label: "Face Setup", visible: true, order: 14 },
  { path: "/dashboard/curriculum", label: "Curriculum", visible: true, order: 15 },
  { path: "/teacher/quiz-editor", label: "Quiz Editor", visible: true, order: 16 },
  { path: "/user-approvals", label: "Approvals", visible: true, order: 17 },
  { path: "/admin/hod-management", label: "HOD Mgmt", visible: true, order: 18 },
  { path: "/dashboard/teachers", label: "Teachers", visible: true, order: 19 },
  { path: "/dashboard/admin/wifi-config", label: "WiFi Config", visible: true, order: 20 },
  { path: "/monetization", label: "Monetization", visible: true, order: 21 },
  { path: "/dashboard/analytics", label: "Analytics", visible: true, order: 22 },
  { path: "/dashboard/dropout-predict", label: "Dropout AI", visible: true, order: 23 },
  { path: "/admin/settings", label: "System Settings", visible: true, order: 24 },
];

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    emailSettings: {
      provider: 'smtp',
      active: true,
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
    },
    serviceControls: {
      emailVerificationRequired: true,
      aiEnabled: true,
      faceRecognitionEnabled: true,
      wifiEnforcementEnabled: true,
      mediaPlayerFallbackEnabled: true,
      documentViewerFallbackEnabled: true,
      mobileSafeModeEnabled: true,
      staffAttendanceEnabled: false,
      registrationRequiresWifi: false,
      allowStaffPublicSignup: false,
    },
    navigationConfig: DEFAULT_NAV_CONFIG,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [storageBackends, setStorageBackends] = useState([]);
  const [storageLoading, setStorageLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSettings = async () => {
      try {
        const data = await adminService.getSystemSettings({ signal: controller.signal });
        if (controller.signal.aborted) return;
        
        // Auto-merge any newly added routes into the saved config
        const savedNav = data.navigationConfig?.length ? data.navigationConfig : DEFAULT_NAV_CONFIG;
        const mergedNav = [...savedNav];
        DEFAULT_NAV_CONFIG.forEach(defaultItem => {
          if (!mergedNav.some(item => item.path === defaultItem.path)) {
             mergedNav.push({ ...defaultItem, order: mergedNav.length + 1 });
          }
        });

        setSettings({
          ...data,
          emailSettings: {
            ...data.emailSettings,
            pass: '', // never populate from server — server should return '' or omit it
          },
          navigationConfig: mergedNav,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setMessage({ text: 'Failed to load settings from server.', type: 'error' });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    const fetchStorageSettings = async () => {
      try {
        const res = await pythonAPI.getStorageBackends();
        if (controller.signal.aborted) return;
        if (res.success) {
          setStorageBackends(res.backends);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Python Storage API is offline.", error);
      } finally {
        if (!controller.signal.aborted) setStorageLoading(false);
      }
    };

    fetchSettings();
    fetchStorageSettings();
    return () => controller.abort();
  }, []);

const ALLOWED_TOP_LEVEL_KEYS = new Set(['maintenanceMode', 'registrationEnabled', 'navigationConfig']);
const ALLOWED_SERVICE_CONTROL_KEYS = new Set([
  "emailVerificationRequired",
  "aiEnabled",
  "faceRecognitionEnabled",
  "wifiEnforcementEnabled",
  "mediaPlayerFallbackEnabled",
  "documentViewerFallbackEnabled",
  "mobileSafeModeEnabled",
  "staffAttendanceEnabled",
  "registrationRequiresWifi",
  "allowStaffPublicSignup",
]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (!ALLOWED_TOP_LEVEL_KEYS.has(name)) return; // reject unexpected keys
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEmailChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      emailSettings: {
        ...prev.emailSettings,
        [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
      }
    }));
  };

  const handleServiceControlChange = (e) => {
    const { name, checked } = e.target;
    if (!ALLOWED_SERVICE_CONTROL_KEYS.has(name)) return;
    setSettings((prev) => ({
      ...prev,
      serviceControls: {
        ...prev.serviceControls,
        [name]: checked,
      },
    }));
  };

  const toggleNavVisibility = (index) => {
    setSettings(prev => {
      const newNav = [...(prev.navigationConfig || DEFAULT_NAV_CONFIG)];
      newNav[index].visible = !newNav[index].visible;
      return { ...prev, navigationConfig: newNav };
    });
  };

  const moveNav = (index, dir) => {
    setSettings(prev => {
      const newNav = [...(prev.navigationConfig || DEFAULT_NAV_CONFIG)];
      if (index + dir < 0 || index + dir >= newNav.length) return prev;
      const temp = newNav[index];
      newNav[index] = newNav[index + dir];
      newNav[index + dir] = temp;
      // Update order property
      newNav.forEach((item, i) => item.order = i + 1);
      return { ...prev, navigationConfig: newNav };
    });
  };

  const handleToggleStorage = async (type, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await pythonAPI.toggleStorageBackend(type, newStatus);
      setStorageBackends(prev =>
        prev.map(b => b.type === type ? { ...b, enabled: newStatus } : b)
      );
      window.dispatchEvent(new CustomEvent("showToast", { detail: `${type} backend ${newStatus ? 'enabled' : 'disabled'}! ☁️` }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: { message: `Failed to toggle backend. ❌`, variant: 'error' } }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Only include password if the admin actually typed a new one
      const payload = { 
        ...settings,
        emailSettings: { ...settings.emailSettings }
      };
      if (!payload.emailSettings.pass) {
        delete payload.emailSettings.pass;
      }
      const res = await adminService.updateSystemSettings(payload);
      setSettings({
        ...res.settings,
        emailSettings: {
          ...res.settings.emailSettings,
          pass: '',
        }
      });
      setMessage({ text: 'Settings updated successfully!', type: 'success' });
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.message || 'Failed to update settings. Please check your inputs.', 
        type: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading configurations...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow mt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Platform Settings</h1>
      
      {message.text && (
        <div className={`p-4 mb-6 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* System Settings Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">Global Constraints</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                name="maintenanceMode"
                checked={settings.maintenanceMode}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Enable Maintenance Mode</span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">Restricts access to the platform for all non-admin users.</p>

            <label className="flex items-center space-x-3 cursor-pointer mt-4">
              <input
                type="checkbox"
                name="registrationEnabled"
                checked={settings.registrationEnabled}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Enable Open Registration</span>
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">Allow external visitors to sign up for new accounts.</p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
            Runtime Feature Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ["emailVerificationRequired", "Require Email OTP Verification"],
              ["aiEnabled", "Enable AI Features Globally"],
              ["faceRecognitionEnabled", "Enable Face Recognition Attendance"],
              ["wifiEnforcementEnabled", "Enforce Campus WiFi Attendance Rule"],
              ["mediaPlayerFallbackEnabled", "Enable Media Player Fallbacks"],
              ["documentViewerFallbackEnabled", "Enable Document Viewer Fallbacks"],
              ["mobileSafeModeEnabled", "Enable Mobile Safe Mode"],
              ["staffAttendanceEnabled", "Enable Staff (Teacher/HOD) Attendance"],
              ["registrationRequiresWifi", "Enforce Campus WiFi Rule for Registration"],
              ["allowStaffPublicSignup", "Allow Public Staff Signups (Teachers/HODs)"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <input
                  type="checkbox"
                  name={key}
                  checked={Boolean(settings.serviceControls?.[key])}
                  onChange={handleServiceControlChange}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            These controls are consumed by frontend and backend fallbacks in real time.
          </p>
        </section>

        {/* Navigation Settings Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
            <LayoutList className="w-5 h-5 text-blue-500" /> Navigation Controls
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Customize the visibility and ordering of the main sidebar menu for all users globally.
          </p>
          <div className="space-y-2">
            {(settings.navigationConfig || DEFAULT_NAV_CONFIG).map((item, index) => (
              <div key={item.path} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-500 dark:text-gray-400 w-6">{index + 1}.</span>
                  <span className="font-medium dark:text-gray-200">{item.label}</span>
                  <span className="text-xs text-gray-400 font-mono">({item.path})</span>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={item.visible !== false} onChange={() => toggleNavVisibility(index)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer" />
                    <span className="text-sm dark:text-gray-300 font-medium">Visible</span>
                  </label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveNav(index, -1)} disabled={index === 0} className="p-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ArrowUp className="w-4 h-4 text-gray-700 dark:text-gray-300" /></button>
                    <button type="button" onClick={() => moveNav(index, 1)} disabled={index === (settings.navigationConfig || DEFAULT_NAV_CONFIG).length - 1} className="p-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ArrowDown className="w-4 h-4 text-gray-700 dark:text-gray-300" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Email Settings Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">Email Routing (SMTP)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <label className="flex items-center space-x-3 md:col-span-2 cursor-pointer">
              <input type="checkbox" name="active" checked={settings.emailSettings.active} onChange={handleEmailChange} className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Enable Outbound Email Notifications</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host</label>
              <input type="text" name="host" value={settings.emailSettings.host} onChange={handleEmailChange} placeholder="smtp.example.com" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Port</label>
              <input type="number" name="port" value={settings.emailSettings.port} onChange={handleEmailChange} min={1} max={65535} placeholder="587" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authentication User</label>
              <input type="text" name="user" value={settings.emailSettings.user} onChange={handleEmailChange} placeholder="admin@domain.com" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input type="password" name="pass" value={settings.emailSettings.pass} onChange={handleEmailChange} placeholder="Leave blank to keep existing password" autoComplete="new-password" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <label className="flex items-center space-x-3 md:col-span-2 cursor-pointer">
              <input type="checkbox" name="secure" checked={settings.emailSettings.secure} onChange={handleEmailChange} className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500" />
              <span className="text-gray-700 dark:text-gray-300 font-medium">Use Secure Connection (TLS/SSL Defaults to Port 465)</span>
            </label>
          </div>
        </section>

        {/* Python AI & Storage Backends Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" /> Multi-Cloud Media & Model Storage
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure the fallback hierarchy for the Python AI microservices. When a backend fails, the system automatically falls back to the next available tier.
          </p>

          {storageLoading ? (
            <div className="p-4 text-center text-gray-500 animate-pulse">Loading cloud connections...</div>
          ) : storageBackends.length === 0 ? (
            <div className="p-4 text-center text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/50 font-medium">
              Storage Microservice Offline. Ensure the Python AI server (Port 5001) is running to manage cloud infrastructure.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storageBackends.map((backend) => (
                <div key={backend.type} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {backend.type === 'local' ? <HardDrive className="w-6 h-6 text-gray-600 dark:text-gray-400" /> :
                       backend.type === 'aws_s3' ? <Database className="w-6 h-6 text-orange-500" /> :
                       backend.type === 'google_drive' ? <Cloud className="w-6 h-6 text-blue-500" /> :
                       <Server className="w-6 h-6 text-purple-500" />}
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-gray-100">{backend.name}</h3>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                          Priority: {backend.priority}
                        </span>
                      </div>
                    </div>
                    <label
                      className="flex items-center cursor-pointer"
                      title={backend.type === 'local' ? 'Local storage cannot be disabled — it is the last-resort fallback' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={backend.enabled}
                        onChange={() => handleToggleStorage(backend.type, backend.enabled)}
                        disabled={backend.type === 'local'}
                        className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                      />
                      {backend.type === 'local' && (
                        <span className="ml-2 text-xs text-gray-400 italic">Always-on fallback</span>
                      )}
                    </label>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Connection Status:</span>
                    <span className={`font-bold flex items-center gap-1.5 ${backend.healthy ? 'text-green-500' : 'text-red-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${backend.healthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                      {backend.healthy ? 'Online & Ready' : 'Offline / Unconfigured'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="pt-4 flex justify-end">
          <button type="submit" disabled={saving} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded shadow transition-colors disabled:opacity-50">
            {saving ? 'Processing...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;