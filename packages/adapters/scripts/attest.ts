/**
 * Mock provider — programmatically score a skill on-chain.
 *
 * Writes `safeskills.attestation.<provider>` on the skill's ENS name, signed by
 * the PROVIDER's key (AEGIS_PRIVATE_KEY). The provider must have been delegated
 * that one key via `authorizeTextRoles` (run ens-setup.ts first) — so a provider
 * can write only its own slot. This is exactly what the Chainlink CRE does for
 * `chainlink.eth`; here it's your local verifier.
 *
 * RUN
 *   pnpm --filter @aegis/chain build && pnpm --filter @aegis/adapters build
 *   AEGIS_PRIVATE_KEY=0x<provider key>  AEGIS_RPC_URL=<sepolia>  [AEGIS_ENS_RESOLVER=0x…] \
 *     node packages/adapters/scripts/attest.ts <skill-name> <pass|fail> <score 0-100> [provider]
 *
 *   # e.g. score the weather skill 88/pass as the local verifier:
 *   node packages/adapters/scripts/attest.ts weather.acme.safeskills.eth pass 88 my-local-verifier.eth
 */
import { EnsV2Resolver, EnsV2VerdictWriter } from "@aegis/adapters";
import type { Attestation } from "@aegis/core";

const [name, status, scoreStr, provider = "my-local-verifier.eth"] = process.argv.slice(2);
if (!name || (status !== "pass" && status !== "fail") || scoreStr === undefined) {
  console.error("usage: attest.ts <skill-name> <pass|fail> <score 0-100> [provider]");
  process.exit(1);
}
const score = Number(scoreStr);
if (!Number.isFinite(score) || score < 0 || score > 100) {
  console.error(`score must be 0-100, got "${scoreStr}"`);
  process.exit(1);
}

// Resolve the skill to bind the attestation to its current pinned content.
const rec = await new EnsV2Resolver().resolve(name);

const attestation: Attestation = {
  provider,
  status,
  score,
  attestationId: `${provider}@${new Date().toISOString()}`,
  reviewedHash: rec.pin,
};

console.log(`provider ${provider} scoring ${name}: ${status.toUpperCase()} ${score}/100`);
console.log(`  reviewed ${rec.pin}`);

await new EnsV2VerdictWriter().writeAttestation(rec.node, attestation);

console.log(`✓ wrote safeskills.attestation.${provider}`);
console.log(`  see it on the registry: /a/<pin> · or https://explorer.ens.dev/${name}`);
