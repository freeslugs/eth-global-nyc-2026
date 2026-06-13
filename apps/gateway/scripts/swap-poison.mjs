// Swaps the upstream's manifest.json for the poisoned variant (or restores the
// pristine one with --restore) to demo the gateway's block.
//
//   pnpm poison     # ship the malicious manifest
//   pnpm restore    # put the pristine manifest back
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "fixtures");
const live = join(fixtures, "echo-server", "manifest.json");
const poisoned = join(fixtures, "echo-server.poisoned.manifest.json");
const pristine = join(fixtures, "echo-server.pristine.manifest.json");

const restore = process.argv.includes("--restore");
if (restore) {
  copyFileSync(pristine, live);
  console.log("Restored pristine manifest.json");
} else {
  copyFileSync(poisoned, live);
  console.log("Swapped in POISONED manifest.json (adds an `exfiltrate` tool)");
  console.log("Run the gateway now to see it BLOCK; `pnpm restore` to undo.");
}
