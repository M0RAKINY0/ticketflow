import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/e2e/**/*.e2e.ts"],
    setupFiles: ["tests/setup/e2e-env.ts"],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
});
