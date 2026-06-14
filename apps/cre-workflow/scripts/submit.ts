/**
 * The mock Chainlink CRE, end-to-end: review a skill and write the security
 * verdict ON-CHAIN to its ENS v2 name. This is the real `reviewSubmission`
 * workflow (fetch -> re-hash -> MockReview -> writeVerdict) wired to live
 * adapters via env flags — exactly what the DON-deployed job will do, minus the
 * trigger.
 *
 * Mock (in-memory, zero setup):
 *   node apps/cre-workflow/scripts/submit.ts weather.acme.safeskills.eth packages/adapters/fixtures/clean.md
 *
 * On-chain (writes the verdict to ENS v2 on Sepolia) — needs the CRE to already
 * be delegated for that name (run ens-setup.ts first):
 *   AEGIS_VERDICT=ens AEGIS_FETCHER=file \
 *   AEGIS_PRIVATE_KEY=0x… AEGIS_RPC_URL=<sepolia-rpc> AEGIS_ENS_RESOLVER=0x… \
 *     node apps/cre-workflow/scripts/submit.ts \
 *       weather.acme.safeskills.eth packages/adapters/fixtures/clean.md
 *
 * Then read it back: AEGIS_ENS_LIVE=1 … vitest run EnsV2Resolver.live
 */
import { readFileSync } from "node:fs";
import { namehash } from "viem/ens";
import { zeroAddress, type Hex } from "viem";
import { buildAdapters } from "@aegis/adapters";
import { hashSkill, type SubmissionEvent } from "@aegis/core";
import { reviewSubmission } from "../src/workflow";

const name = process.argv[2];
const file = process.argv[3];
if (!name || !file) {
  console.error("usage: submit.ts <skill-name> <path/to/SKILL.md>");
  process.exit(1);
}

const a = buildAdapters();
const bytes = new Uint8Array(readFileSync(file));

// The submission the on-chain SubmissionRegistry would emit. pin = the org's
// committed hash (== hashSkill of the bytes the CRE fetches); fetchUri is the
// file path the FileFetcher reads (AEGIS_FETCHER=file).
const event: SubmissionEvent = {
  node: namehash(name) as Hex,
  pin: hashSkill(bytes),
  fetchUri: file,
  isPrivate: false,
  submitter: (process.env.AEGIS_CRE_ADDRESS ?? zeroAddress) as Hex,
};

const mode = process.env.AEGIS_VERDICT === "ens" ? "ENS v2 (on-chain)" : "mock (in-memory)";
console.log(`Mock CRE reviewing ${name}\n  verdict writer: ${mode}\n`);

const verdict = await reviewSubmission(
  { fetcher: a.fetcher, review: a.review, verdict: a.verdict },
  event,
);

console.log(`verdict: ${verdict.status.toUpperCase()}  risk ${verdict.riskScore}`);
console.log(`reviewedHash: ${verdict.reviewedHash}`);
console.log(verdict.status === "pass" ? "→ skill is safe" : "→ skill BLOCKED (poison detected)");
