import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 5173);
const basePath = process.env.BASE_PATH || "/";
const apiBase = process.env.VITE_API_BASE || process.env.VITE_API_URL || "";

/* Plugin: tulis public/api-config.json agar browser baru bisa auto-discover URL API */
function writeApiConfig(): Plugin {
  const write = () => {
    const configPath = path.resolve(__dirname, "public", "api-config.json");
    const content = JSON.stringify({ apiBase }, null, 2);
    try {
      fs.writeFileSync(configPath, content, "utf-8");
    } catch (e) {
      console.warn("[BOP] Gagal tulis api-config.json:", e);
    }
  };
  return {
    name: "bop-write-api-config",
    buildStart: write,
    configureServer: write,
  };
}

export default defineConfig({
  base: basePath,
  define: {
    __BOP_API_BASE__: JSON.stringify(apiBase),
  },
  plugins: [writeApiConfig(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:8099",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
