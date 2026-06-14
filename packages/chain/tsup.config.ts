import { defineConfig } from "tsup";

// The Ledger stack is node-only, lazily imported (makeLedgerAccount), and an
// OPTIONAL dependency that pulls in native node-hid/usb bindings. Bundling it is
// both unnecessary and fragile (native builds fail across machines/Node versions,
// and a bundled native addon can't find its .node binary at runtime). Keep it
// external: chain's dist references it by name, so it resolves from node_modules
// at runtime ONLY when a device is used. `--local` never loads it, and the build
// no longer breaks when the optional native deps aren't installed.
const ledgerExternal = [
  "@ledgerhq/hw-transport-node-hid",
  "@ledgerhq/hw-app-eth",
  "node-hid",
  "usb",
];

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  esbuildOptions(options) {
    options.external = [...(options.external ?? []), ...ledgerExternal];
  },
});
