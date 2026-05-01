import React, { useState } from "react";
import { CreditCard, Link as LinkIcon, ShieldCheck, Save, EyeOff, Eye } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";

const MonetizationManager = () => {
  const { appTheme } = useTheme();
  
  const [config, setConfig] = useState({
    paymentsEnabled: false,
    razorpayKeyId: "",
    razorpaySecret: "",
    web3Enabled: false,
    polygonContractAddress: "",
    ipfsGateway: "https://ipfs.io/ipfs/"
  });
  
  const [showSecrets, setShowSecrets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call to save settings securely to the backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Platform configurations updated securely! 🔐" }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to save configuration. ❌" }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-inherit mb-2">Monetization & Credentials</h1>
        <p className="text-inherit opacity-70">
          Configure Razorpay for platform transactions and Web3 smart contracts for issuing tamper-proof certificates. These features remain completely hidden from students and teachers until enabled here.
        </p>
      </div>

      {/* Razorpay Payments Section */}
      <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-inherit">Razorpay Gateway</h2>
              <p className="text-sm opacity-70 text-inherit">Accept payments for premium courses or verified certificates.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={config.paymentsEnabled} onChange={e => setConfig({...config, paymentsEnabled: e.target.checked})} />
            <div className="w-11 h-6 bg-black/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className={`grid gap-4 transition-all duration-300 ${config.paymentsEnabled ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none grayscale'}`}>
          <div>
            <label className="block text-sm font-semibold opacity-90 mb-1 text-inherit">Razorpay Key ID</label>
            <input 
              type="text" 
              value={config.razorpayKeyId}
              onChange={e => setConfig({...config, razorpayKeyId: e.target.value})}
              placeholder="rzp_live_xxxxxxxxxxxxxx"
              className="w-full p-3 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-semibold opacity-90 mb-1 text-inherit">Razorpay Secret Key</label>
            <input 
              type={showSecrets ? "text" : "password"} 
              value={config.razorpaySecret}
              onChange={e => setConfig({...config, razorpaySecret: e.target.value})}
              placeholder="••••••••••••••••••••••••"
              className="w-full p-3 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm pr-10"
            />
            <button onClick={() => setShowSecrets(!showSecrets)} className="absolute right-3 top-9 opacity-50 hover:opacity-100 text-inherit">
              {showSecrets ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
            </button>
          </div>
        </div>
      </div>

      {/* Web3 Blockchain Credentials Section */}
      <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-inherit">Web3 Blockchain Certificates</h2>
              <p className="text-sm opacity-70 text-inherit">Mint student certificates as NFTs on the Polygon network.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={config.web3Enabled} onChange={e => setConfig({...config, web3Enabled: e.target.checked})} />
            <div className="w-11 h-6 bg-black/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div className={`grid gap-4 transition-all duration-300 ${config.web3Enabled ? 'opacity-100 pointer-events-auto' : 'opacity-40 pointer-events-none grayscale'}`}>
          <div>
            <label className="block text-sm font-semibold opacity-90 mb-1 text-inherit flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Polygon Smart Contract Address
            </label>
            <input 
              type="text" 
              value={config.polygonContractAddress}
              onChange={e => setConfig({...config, polygonContractAddress: e.target.value})}
              placeholder="0x..."
              className="w-full p-3 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold opacity-90 mb-1 text-inherit">IPFS Gateway URL (Metadata Storage)</label>
            <input 
              type="text" 
              value={config.ipfsGateway}
              onChange={e => setConfig({...config, ipfsGateway: e.target.value})}
              className="w-full p-3 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Save Action */}
      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md transition-transform active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
        >
          {isSaving ? (
            <div className="loader" style={{ '--s': '15px', '--g': '3px' }}></div>
          ) : (
            <><Save className="w-5 h-5" /> Save Configurations</>
          )}
        </button>
      </div>

    </div>
  );
};

export default MonetizationManager;
