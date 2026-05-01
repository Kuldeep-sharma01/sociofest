// /sociofest/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path"; 
export default defineConfig({
  root: "./client",
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    open: true,
    // For LAN testing, set VITE_ALLOW_ALL_HOSTS=true in local .env.local only
    // never in committed config
    allowedHosts: process.env.VITE_ALLOW_ALL_HOSTS === 'true' ? true : ["localhost", "127.0.0.1"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});
