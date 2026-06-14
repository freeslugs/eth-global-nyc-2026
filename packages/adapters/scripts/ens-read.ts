/**
 * Step 1 — the simplest possible ENS integration: read a real name live.
 *
 * No deployment, no wallet, no app wiring. Just proves the viem + ENS plumbing
 * works against a real network. This is the same `getEnsText` call that
 * EnsV2Resolver will use to read `safeskills.pin` / `safeskills.verdict`.
 *
 * Run (Node >= 23 strips the TS types natively):
 *   node packages/adapters/scripts/ens-read.ts
 *   node packages/adapters/scripts/ens-read.ts vitalik.eth url
 *   AEGIS_RPC_URL=https://mainnet.infura.io/v3/<key> node packages/adapters/scripts/ens-read.ts
 *
 * With no AEGIS_RPC_URL set, viem falls back to the chain's public RPC
 * (rate-limited, fine for this demo).
 */
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const name = process.argv[2] ?? "vitalik.eth";
const key = process.argv[3] ?? "url";

const client = createPublicClient({
  chain: mainnet,
  // ENS resolution goes through the UniversalResolver (CCIP batch gateway), a
  // heavier eth_call than a plain read — give it more than viem's 10s default.
  transport: http(process.env.AEGIS_RPC_URL, { timeout: 30_000 }),
});

console.log(`Resolving "${name}" on ${client.chain.name}…\n`);

const [address, text] = await Promise.all([
  client.getEnsAddress({ name }),
  client.getEnsText({ name, key }),
]);

console.log(`  address           ${address ?? "(none)"}`);
console.log(`  text["${key}"]${" ".repeat(Math.max(1, 12 - key.length))}${text ?? "(none)"}`);
console.log(
  `\nThat second call is exactly how EnsV2Resolver reads safeskills.pin:\n` +
    `  client.getEnsText({ name, key: "safeskills.pin" })`,
);
