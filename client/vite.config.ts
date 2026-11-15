import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const previewHosts = (process.env.VITE_PREVIEW_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // Preview hostnames are supplied per process so none are baked into the repo.
    allowedHosts: previewHosts,
    proxy: {
      "/api": { target: "http://127.0.0.1:4000", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:4000", changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
