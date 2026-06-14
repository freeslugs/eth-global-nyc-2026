import { defineConfig } from "tsup";

// Bundle the workspace deps (and their @noble crypto) INTO the output so the
// packed tarball is self-contained — `npx ./safeskill-*.tgz` then works with
// only the real npm deps (commander, picocolors, viem) installed.
const noExternal = [/^@aegis\//, /^@noble\//];

// Keep the Ledger transport (and its native node-hid/usb addons) OUT of the
// bundle. node-hid is CommonJS and does require("os")/native binding loads that
// esbuild's ESM shim turns into "Dynamic require of X is not supported" at
// runtime. Marked external, the LedgerSigner's dynamic import() resolves them
// from node_modules as real modules. They're listed in this package's deps so
// the bundled CLI can resolve them at runtime.
const external = [
  "@ledgerhq/hw-app-eth",
  "@ledgerhq/hw-transport-node-hid",
  "node-hid",
  "usb",
];

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
    external,
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
