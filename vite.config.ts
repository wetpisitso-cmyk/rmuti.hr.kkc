import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss()],
    base: env.VITE_BASE_PATH || "/rmuti.hr.kkc/",
    build: { sourcemap: false },
    test: { environment: "node", include: ["tests/**/*.test.ts"] },
  };
});
