import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Inline the seed JSON so consumers (e.g. Vercel) work with zero fs access.
  loader: { ".json": "json" },
});
