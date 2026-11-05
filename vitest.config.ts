import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./packages/client/src/test/rootSetup.ts"],
    pool: "forks",
    poolOptions: { forks: { maxForks: 3, minForks: 1 } },
    include: ["packages/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/shared/src/**/*.ts", "packages/server/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/dist/**",
        "packages/shared/src/types/game.ts",
      ],
    },
  },
});
