import { defineConfig } from "tsup";

// Bundle the workspace deps (and their @noble crypto) INTO the output so the
// packed tarball is self-contained — `npx ./safeskill-*.tgz` then works with
// only the real npm deps (commander, picocolors, viem) installed.
const noExternal = [/^@aegis\//, /^@noble\//];

export default defineConfig([
  // The SDK library — imported by an agent / app code.
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    noExternal,
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
    noExternal,
  },
]);
