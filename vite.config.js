import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from "path";

export default defineConfig({
  root: "./client",
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      // ── Node.js Backend ─────────────────────────────────────────────────────
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
      },
      // ── Python AI Service ────────────────────────────────────────────────────
      // Strips /python-api prefix before forwarding to Flask at http://localhost:5001
      // Flask routes are at root: /register-face, /verify-face, /admin/storage/*, /images/*, /media/*
      '/python-api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/python-api/, ''),
      },
      // ── Optional Services (only active when running locally) ─────────────────
      '/sd-api': {
        target: 'http://localhost:7860',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/sd-api/, ''),
      },
      '/voice-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/voice-api/, ''),
      },
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
});