import React, { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getPrimaryButtonClasses } from "@/utils/themeUtils";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const RazorpayCheckout = ({ 
  courseId, 
  courseName, 
  amountINR, 
  user, 
  orderId,
  razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID,
  onSuccess 
}) => {
  const { appTheme } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      const res = await loadRazorpayScript();
      if (!res) {
        window.dispatchEvent(new CustomEvent("showToast", { detail: "Failed to load Razorpay SDK. Check connection. ❌" }));
        setIsProcessing(false);
        return;
      }

      const options = {
        key: razorpayKey,
        amount: amountINR * 100, // Amount is in currency subunits (paise)
        currency: "INR",
        name: "SocioFest Education",
        description: `Premium Course: ${courseName}`,
        image: "/logo.png",
        order_id: orderId,
        handler: function (response) {
          // Payment successful! Pass verification details to your backend
          window.dispatchEvent(new CustomEvent("showToast", { detail: "Payment Successful! 🎉" }));
          if (onSuccess) {
            onSuccess({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature
            });
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#6366f1", // Match your app theme
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response) {
        window.dispatchEvent(new CustomEvent("showToast", { detail: `Payment Failed: ${response.error.description} ❌` }));
      });
      
      paymentObject.open();
    } catch (error) {
      console.error(error);
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Payment initialization failed. ❌" }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isProcessing}
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${getPrimaryButtonClasses(appTheme)}`}
    >
      {isProcessing ? <div className="loader" style={{'--s': '15px', '--g': '3px'}} /> : <><CreditCard className="w-5 h-5" /> Pay ₹{amountINR} Securely</>}
    </button>
  );
};

export default RazorpayCheckout;
