// Records the trusted pin for the sample upstream server by hashing its
// PRISTINE bundle.js + manifest.json into fixtures/pin.json. Run once (and
// again only after an intentional, vetted release). Re-run with `pnpm pin`.
//
// IMPORTANT: run this against the pristine manifest (restore it first if you
// have poisoned it), or you will pin the malicious descriptors.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "fixtures", "echo-server");
const sha256 = (buf) => `sha256:${createHash("sha256").update(buf).digest("hex")}`;

const pin = {
  name: "echo-server.aegis.eth",
  bundleHash: sha256(readFileSync(join(dir, "bundle.js"))),
  manifestHash: sha256(readFileSync(join(dir, "manifest.json"))),
  publisher: "0x1111111111111111111111111111111111111111",
  policyRef: "policy:permissive",
  command: "node",
  args: ["fixtures/echo-server/bundle.js"],
  artifactPath: "fixtures/echo-server",
};

writeFileSync(join(here, "..", "fixtures", "pin.json"), JSON.stringify(pin, null, 2) + "\n");
console.log("Pinned echo-server.aegis.eth");
console.log("  bundle  ", pin.bundleHash);
console.log("  manifest", pin.manifestHash);
