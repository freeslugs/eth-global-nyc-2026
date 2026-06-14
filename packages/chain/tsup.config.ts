import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Never bundle the Ledger transport / native HID addons. node-hid is CJS and
  // its require("os")/native binding loads become "Dynamic require of X is not
  // supported" once esbuild inlines them into ESM. External => loaded from
  // node_modules at runtime by the dynamic import().
  external: [
    "@ledgerhq/hw-app-eth",
    "@ledgerhq/hw-transport-node-hid",
    "node-hid",
    "usb",
  ],
});
