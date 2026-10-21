import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served from GitHub Pages at https://<user>.github.io/<repo>/ — BASE_PATH overrides for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/ITestApp/",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", sourcemap: false },
});
