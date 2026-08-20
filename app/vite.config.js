import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4001",
    },
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
