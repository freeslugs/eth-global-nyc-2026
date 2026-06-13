import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/verify.ts", "src/hash.ts", "src/policy.ts"],
    },
  },
});
