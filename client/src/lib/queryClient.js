import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { generateContent } from "@/services/aiClient";

const globalErrorHandler = async (error) => {
  const errData = error.response?.data?.message || error.message || "Unknown Technical Error";
  const errStatus = error.response?.status;

  // ✅ Classify errors before showing toasts; only show user-facing messages for actionable errors
  const SILENT_STATUSES = new Set([401, 403, 404]);

  if (errStatus === 401) {
    // 401 → silently redirect to login via router (handled by auth listener/interceptor)
    window.dispatchEvent(new CustomEvent("authUnauthorized"));
    return;
  } else if (errStatus === 403) {
    // 403 → show "You don't have permission" without AI roundtrip
    window.dispatchEvent(new CustomEvent("showToast", { detail: "You don't have permission to perform this action. 🚫" }));
    return;
  } else if (errStatus === 404) {
    // 404 → show "Not found" inline in the component, not a global toast
    return;
  }

  if (!SILENT_STATUSES.has(errStatus)) {
    window.dispatchEvent(
      new CustomEvent("showToast", {
        detail: `Error ${errStatus || "Detected"}: Analyzing... 🤖`,
      })
    );

    try {
      // Sanitize before sending; strip anything that looks like a stack trace or path
      const safeError = typeof errData === 'string'
        ? errData.replace(/\/.+?:\d+/g, '[path]')       // strip file paths
                 .replace(/at\s+\w+.*$/gm, '')           // strip stack frames
                 .slice(0, 200)                           // hard cap length
        : 'Unknown error';
      const prompt = `You are a helpful assistant for a college platform. Translate this technical error into a friendly, short, 1-sentence user-facing message (with an emoji). Keep it encouraging. Error: ${safeError}`;
      const response = await generateContent(prompt);
      
      // ✅ Strip HTML tags from AI response before dispatching to UI
      const sanitize = (str) => String(str).replace(/<[^>]*>/g, '').slice(0, 300);
      const toastDetail = sanitize(typeof response === 'string' ? response : response?.generated_content || response?.data?.generated_content || "An error occurred.");
      window.dispatchEvent(new CustomEvent("showToast", { detail: toastDetail }));
    } catch (aiErr) {
      window.dispatchEvent(new CustomEvent("showToast", { detail: `Error: ${errData} ❌` }));
    }
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: globalErrorHandler,
  }),
  mutationCache: new MutationCache({
    onError: globalErrorHandler,
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export default queryClient;
