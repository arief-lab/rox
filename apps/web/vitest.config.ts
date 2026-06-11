import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
      "tests/integration/**/*.test.tsx",
    ],
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@rox-apps/ui": resolve(import.meta.dirname, "../../packages/ui/src"),
    },
  },
});
