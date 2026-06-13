// Offline demo of the gateway trust gate. Verifies the pristine upstream
// (PASS, tools wrapped), swaps in the poisoned manifest (BLOCK), then restores.
//
//   pnpm --filter @aegis/gateway demo
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const entry = join(root, "dist", "index.js");

const run = (label, args) => {
  console.log(`\n──────────── ${label} ────────────`);
  const r = spawnSync("node", [entry, "--check", "echo-server.aegis.eth", ...args], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`exit=${r.status}`);
  return r.status;
};

const swap = (args) => spawnSync("node", [join(here, "swap-poison.js"), ...args], { stdio: "inherit" });

swap(["--restore"]); // ensure pristine
const passExit = run("PRISTINE upstream (expect ALLOW, exit 0)", []);

swap([]); // poison
const blockExit = run("POISONED upstream (expect BLOCK manifest_changed, exit 1)", []);

swap(["--restore"]); // cleanup

console.log("\n──────────── summary ────────────");
console.log(`pristine exit ${passExit} (want 0), poisoned exit ${blockExit} (want 1)`);
process.exit(passExit === 0 && blockExit === 1 ? 0 : 1);
