import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    errors: "src/errors.ts",
    "testing/index": "testing/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // vitest is only used by the contract suites under ./testing; never bundle it.
  external: ["vitest"],
});
