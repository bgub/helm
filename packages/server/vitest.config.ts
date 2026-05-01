import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["lcov"],
      include: ["src/**/*.ts"],
      thresholds: {
        branches: 30,
        functions: 40,
        lines: 40,
        statements: 40,
      },
    },
  },
});
