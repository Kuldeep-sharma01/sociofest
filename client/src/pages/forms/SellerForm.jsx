import React from "react";
import { Store, Tag } from "lucide-react";

const SellerForm = ({ sellerData, setSellerData }) => {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300 bg-black/5 dark:bg-white/5 p-5 rounded-2xl border border-inherit/30 shadow-inner">
      <div className="flex items-center gap-2 mb-2 text-inherit opacity-80">
        <Store className="w-5 h-5" />
        <h3 className="font-bold">Merchant Details</h3>
      </div>
      <input
        type="text"
        placeholder="Company / Store Name *"
        value={sellerData.companyName || ""}
        onChange={(e) => setSellerData({ ...sellerData, companyName: e.target.value })}
        className="w-full px-3 py-2.5 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />
      <input
        type="text"
        placeholder="Business Type (e.g. Books, Electronics, Food) *"
        value={sellerData.businessType || ""}
        onChange={(e) => setSellerData({ ...sellerData, businessType: e.target.value })}
        className="w-full px-3 py-2.5 border border-inherit/30 rounded-lg bg-black/5 dark:bg-white/5 text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
      />
    </div>
  );
};
export default SellerForm;
