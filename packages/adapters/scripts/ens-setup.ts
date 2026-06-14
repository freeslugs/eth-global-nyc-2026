/**
 * ENS v2 (Sepolia) setup — commit pins + delegate each provider's attestation key.
 *
 * For each skill name this:
 *   - resolver.setText(node, "safeskills.pin", "sha256:…")        org commits the hash
 *   - resolver.setAddr(node, owner)                               -> SkillRecord.owner
 *   - resolver.authorizeTextRoles(dnsName, "safeskills.attestation.<p>", addr, true)
 *                                       per provider: delegate ONLY that provider's slot
 * Each provider then writes its own attestation via `attest.ts` / the CRE — and
 * after these grants that one slot is all each provider can touch.
 *
 * Providers default to chainlink.eth + my-local-verifier.eth, both delegated to
 * AEGIS_PROVIDER_ADDR (default: the owner key) so one wallet can play every
 * provider in the demo. Override with AEGIS_PROVIDERS="a.eth,b.eth".
 *
 * PREREQS — create the name hierarchy first (full depth, org-owned) in the
 * explorer.ens.dev UI, which drives the VerifiableFactory + permissioned
 * registries for you:
 *   1. Register `safeskills.eth` (the trust root).
 *   2. On safeskills.eth: create a subregistry, then the org subname `acme`
 *      (owner = the org) — it gets its own subregistry.
 *   3. Under acme: create skill subnames `weather`, `exfil` (owner = the org).
 * Then run this script as the org owner to set records + delegate.
 *
 * RUN
 *   pnpm --filter @aegis/chain build
 *   AEGIS_PRIVATE_KEY=0x…  AEGIS_RPC_URL=<real-sepolia-rpc>  AEGIS_CRE_ADDRESS=0x… \
 *     node packages/adapters/scripts/ens-setup.ts
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFunctionData, getAddress, namehash, type Address, type Hex } from "viem";
import {
  dnsEncode,
  getEnsV2Addresses,
  makeAccount,
  makePublicClient,
  makeWalletClient,
  permissionedResolverAbi,
} from "@aegis/chain";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const pinOf = (file: string) =>
  `sha256:${createHash("sha256").update(readFileSync(join(fixtures, file))).digest("hex")}`;

// --- config: the skills to set up (full names + their SKILL.md fixture) -------
const ROOT = process.env.AEGIS_ROOT_NAME ?? "safeskills.eth";
const PROVIDERS = (process.env.AEGIS_PROVIDERS ?? "chainlink.eth,my-local-verifier.eth")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const SKILLS = [
  { name: `weather.acme.${ROOT}`, file: "clean.md" },
  { name: `exfil.acme.${ROOT}`, file: "poisoned.md" },
];
const attestationKey = (provider: string) => `safeskills.attestation.${provider}`;
// -----------------------------------------------------------------------------

const account = await makeAccount(process.env);
if (!account) throw new Error("set AEGIS_PRIVATE_KEY (or AEGIS_SIGNER=ledger)");
const owner = account.address as Address;
const providerAddr = (
  process.env.AEGIS_PROVIDER_ADDR ? getAddress(process.env.AEGIS_PROVIDER_ADDR) : owner
) as Address;
const pub = makePublicClient({ timeout: 30_000 });
const wallet = makeWalletClient({ account, timeout: 30_000 });
const chainId = pub.chain?.id ?? 11155111;
const v2 = getEnsV2Addresses(chainId);

async function send(to: Address, data: Hex, what: string) {
  process.stdout.write(`  ${what} … `);
  const hash = await wallet.sendTransaction({ account: account!, chain: wallet.chain, to, data });
  await pub.waitForTransactionReceipt({ hash });
  console.log(hash);
}

/** The resolver actually set on a name (per-account in v2), via the Universal Resolver. */
async function resolverFor(name: string): Promise<Address> {
  const found = await pub
    .getEnsResolver({ name, universalResolverAddress: v2.universalResolver })
    .catch(() => null);
  if (!found) {
    console.log(`  (no resolver on ${name}; defaulting to PublicResolverV2 — set one in the UI if writes fail)`);
    return v2.publicResolver;
  }
  return found;
}

console.log(
  `ENS v2 setup on chain ${chainId} as ${owner}\nroot ${ROOT}  providers [${PROVIDERS.join(", ")}] -> ${providerAddr}\n`,
);

for (const skill of SKILLS) {
  console.log(`skill ${skill.name}`);
  const node = namehash(skill.name) as Hex;
  const resolver = await resolverFor(skill.name);

  await send(
    resolver,
    encodeFunctionData({ abi: permissionedResolverAbi, functionName: "setText", args: [node, "safeskills.pin", pinOf(skill.file)] }),
    "setText safeskills.pin",
  );
  await send(
    resolver,
    encodeFunctionData({ abi: permissionedResolverAbi, functionName: "setAddr", args: [node, owner] }),
    "setAddr owner",
  );
  for (const provider of PROVIDERS) {
    await send(
      resolver,
      encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: "authorizeTextRoles",
        args: [dnsEncode(skill.name), attestationKey(provider), providerAddr, true],
      }),
      `delegate ${attestationKey(provider)} -> ${providerAddr}`,
    );
  }
}

console.log(`\nDone. Verify a skill resolves:\n  AEGIS_ENS_LIVE=1 AEGIS_ENS_LIVE_CHAIN=sepolia AEGIS_RPC_URL=$AEGIS_RPC_URL \\\n    AEGIS_ENS_LIVE_NAME=weather.acme.${ROOT} \\\n    pnpm --filter @aegis/adapters exec vitest run EnsV2Resolver.live`);
