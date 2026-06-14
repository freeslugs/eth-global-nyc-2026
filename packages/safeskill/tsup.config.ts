import { defineConfig } from "tsup";

// Bundle the workspace deps (and their @noble crypto) INTO the output so the
// packed tarball is self-contained — `npx ./safeskill-*.tgz` then works with
// only the real npm deps (commander, picocolors, viem) installed.
const noExternal = [/^@aegis\//, /^@noble\//];

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
    banner: { js: "#!/usr/bin/env node" },
    noExternal,
    esbuildOptions: externalizeLedger,
  },
]);
