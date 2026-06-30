import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/desktop/renderer",
    emptyOutDir: true,
    rollupOptions: {
      input: "desktop/index.html"
    }
  }
});
