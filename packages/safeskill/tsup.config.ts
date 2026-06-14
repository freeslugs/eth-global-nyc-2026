import { defineConfig } from "tsup";

// Bundle EVERYTHING (workspace deps, their @noble crypto, and the public npm
// runtime deps) INTO the output so `dist/cli.js` is a single self-contained file
// that runs with a bare `node cli.js` — no node_modules. This is what lets
// `init` copy the CLI next to the installed skill and `npx ./safeskill-*.tgz`
// work from an ephemeral temp dir. Only the native Ledger stack stays external.
const noExternal = [/^@aegis\//, /^@noble\//, "commander", "picocolors", "viem"];

// Keep the Ledger stack OUT of the bundle: @aegis/chain dynamically imports it
// only in `--ledger` mode, and it drags in native node-hid/usb bindings that
// can't (and shouldn't) be bundled. Set directly on esbuild so it applies even
// to the dynamic import inside a noExternal-bundled dep. Resolved from
// node_modules at runtime when a device is used; `--local` never loads them.
const ledgerExternal = [
  "@ledgerhq/hw-transport-node-hid",
  "@ledgerhq/hw-app-eth",
  "node-hid",
  "usb",
];

function externalizeLedger(options: { external?: string[] }): void {
  options.external = [...(options.external ?? []), ...ledgerExternal];
}

// Bundling CJS deps (commander, picocolors) into ESM leaves esbuild's __require
// shim, which throws "Dynamic require of X" for their `require("events")` etc.
// Defining a real `require` via createRequire makes the shim delegate to it.
const cjsInteropBanner =
  "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);";

export default defineConfig([
  // The SDK library — imported by an agent / app code.
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    banner: { js: cjsInteropBanner },
    noExternal,
    esbuildOptions: externalizeLedger,
  },
  // The CLI — `safeskill ...`. Same code, just gets a shebang.
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    target: "es2022",
    banner: { js: `#!/usr/bin/env node\n${cjsInteropBanner}` },
    noExternal,
    esbuildOptions: externalizeLedger,
  },
]);
