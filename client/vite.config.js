// client/vite.config.js

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load ALL env vars (not just VITE_ prefixed) so we can read BACKEND_URL etc.
  const env = loadEnv(mode, process.cwd(), "");

  const backendOrigin = env.VITE_BACKEND_URL || "http://127.0.0.1:5000";
  const pythonOrigin = env.VITE_PYTHON_URL || "http://127.0.0.1:5001";

  return {
    // All browser-facing env vars must use VITE_ prefix (Vite standard)
    envPrefix: ["VITE_"],
    plugins: [react()],
    server: {
      open: true,
      host: "0.0.0.0",
      port: 5173,
      allowedHosts: env.VITE_ALLOW_ALL_HOSTS === "true" ? true : ["localhost", "127.0.0.1"],
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/uploads": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/python-api": {
          target: pythonOrigin,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/python-api/, ""),
        },
        "/media": {
          target: pythonOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/socket.io": {
          target: backendOrigin,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react/") || id.includes("react-dom/") || id.includes("react-router")) return "react-core";
              if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("framer-motion") || id.includes("tailwind")) return "ui-vendor";
              if (id.includes("@tanstack/react-query") || id.includes("redux") || id.includes("axios")) return "data-vendor";
              if (id.includes("chart.js") || id.includes("react-chartjs-2") || id.includes("recharts")) return "charts-vendor";
              if (id.includes("firebase")) return "firebase-vendor";
              if (id.includes("@monaco-editor")) return "editor-vendor";
              if (id.includes("pdf-lib") || id.includes("react-markdown")) return "document-vendor";
              if (id.includes("ethers") || id.includes("socket.io-client")) return "realtime-web3-vendor";
              return "vendor";
            }
          },
        },
      },
      cssMinify: "esbuild",
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
  };
});
