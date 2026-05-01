// client\vite.config.js

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const parseOrigin = (rawUrl, fallback) => {
  if (!rawUrl) return fallback;
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
};

const apiOrigin = parseOrigin(
  process.env.VITE_CLIENT_URL || process.env.VITE_CLIENT_URL,
  "http://127.0.0.1:5000",
);

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    host: "0.0.0.0",
    port: 5173,
    // For LAN testing, set VITE_ALLOW_ALL_HOSTS=true in local .env.local only
    // never in committed config
    allowedHosts: process.env.VITE_ALLOW_ALL_HOSTS === 'true' ? true : ["localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: apiOrigin,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: apiOrigin,
        changeOrigin: true,
        secure: false,
      },
      "/python-api": {
        target: process.env.VITE_PYTHON_API_URL || "http://127.0.0.1:5001",
        changeOrigin: true,
        secure: false,
      },
      "/sd-api": {
        target: process.env.VITE_SD_API_URL || "http://127.0.0.1:7860",
        changeOrigin: true,
        secure: false,
      },
      "/voice-api": {
        target: process.env.VITE_VOICE_API_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/voice-api/, "")
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // 1. Core React Dependencies
            if (id.includes("react/") || id.includes("react-dom/") || id.includes("react-router")) {
              return "react-core";
            }
            // 2. UI Components & Icons
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("framer-motion") || id.includes("tailwind")) {
              return "ui-vendor";
            }
            // 3. State Management & Data Fetching
            if (id.includes("@tanstack/react-query") || id.includes("redux") || id.includes("axios")) {
              return "data-vendor";
            }
            // 4. Heavy Charting Libraries
            if (id.includes("chart.js") || id.includes("react-chartjs-2") || id.includes("recharts")) {
              return "charts-vendor";
            }
            // 5. Heavy Editor/Firebase Libraries
            if (id.includes("firebase")) {
              return "firebase-vendor";
            }
            if (id.includes("@monaco-editor")) {
              return "editor-vendor";
            }
            // 6. Media/PDF/crypto heavy deps
            if (id.includes("pdf-lib") || id.includes("react-markdown")) {
              return "document-vendor";
            }
            if (id.includes("ethers") || id.includes("socket.io-client")) {
              return "realtime-web3-vendor";
            }
            
            // Fallback for remaining small dependencies
            return "vendor";
          }
        }
      }
    },
    cssMinify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1200
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ['react', 'react-dom'] 
  },
});
