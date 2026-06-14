/**
 * Mock provider — programmatically score a skill on-chain.
 *
 * Writes `safeskills.attestation.<provider>` on the skill's ENS name, signed by
 * the PROVIDER's key (AEGIS_PRIVATE_KEY). The provider must have been delegated
 * that one key via `authorizeTextRoles` (ens-deploy/ens-setup does this) — so a
 * provider can write only its own slot. This is exactly what the Chainlink CRE
 * does for `chainlink.eth`; here it's your local verifier.
 *
 * Chain-only (no @aegis/adapters) so it runs under Node 25 without the @noble
 * resolution issue.
 *
 * RUN
 *   pnpm --filter @aegis/chain build   # or: exec tsup --no-dts
 *   node --env-file=.env packages/adapters/scripts/attest.ts \
 *     weather.acme.safeskills.eth pass 88 my-local-verifier.eth
 *   # .env needs AEGIS_PRIVATE_KEY (provider key), AEGIS_RPC_URL, AEGIS_ENS_RESOLVER
 */
import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import { namehash } from "viem/ens";
import {
  getEnsV2Addresses,
  makeAccount,
  makePublicClient,
  makeWalletClient,
  permissionedResolverAbi,
} from "@aegis/chain";

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

const account = await makeAccount(process.env);
if (!account) throw new Error("set AEGIS_PRIVATE_KEY (the provider's signing key)");
const pub = makePublicClient({ timeout: 30_000 });
const wallet = makeWalletClient({ account, timeout: 30_000 });
const chainId = pub.chain?.id ?? 11155111;
const v2 = getEnsV2Addresses(chainId);
const node = namehash(name) as Hex;

// Bind the attestation to the skill's current pinned content.
const pin = await pub.getEnsText({ name, key: "safeskills.pin", universalResolverAddress: v2.universalResolver });
if (!pin) throw new Error(`${name} has no safeskills.pin record (deploy/register it first)`);

// Resolver holding the skill's records (the one ens-deploy used).
const resolver = (
  process.env.AEGIS_ENS_RESOLVER
    ? getAddress(process.env.AEGIS_ENS_RESOLVER)
    : ((await pub.getEnsResolver({ name, universalResolverAddress: v2.universalResolver }).catch(() => null)) ??
      v2.publicResolver)
) as Address;

const attestation = {
  provider,
  status,
  score,
  attestationId: `${provider}@${new Date().toISOString()}`,
  reviewedHash: pin,
};

console.log(`provider ${provider} scoring ${name}: ${status.toUpperCase()} ${score}/100`);
console.log(`  reviewed ${pin}\n  resolver ${resolver}`);

const data = encodeFunctionData({
  abi: permissionedResolverAbi,
  functionName: "setText",
  args: [node, `safeskills.attestation.${provider}`, JSON.stringify(attestation)],
});
const hash = await wallet.sendTransaction({ account, chain: wallet.chain, to: resolver, data });
await pub.waitForTransactionReceipt({ hash });

console.log(`✓ wrote safeskills.attestation.${provider}  tx ${hash}`);
