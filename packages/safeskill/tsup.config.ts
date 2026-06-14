import { defineConfig } from "tsup";

export default defineConfig([
  // The SDK library — imported by an agent / app code.
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
  },
  // The CLI — `safeskill ...`. Same code, just gets a shebang.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "es2022",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
