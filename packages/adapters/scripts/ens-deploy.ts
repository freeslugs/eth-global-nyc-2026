/**
 * Deploy the Aegis registry on ENS v2 (Sepolia), full depth, org-owned — in one
 * command, signed by your wallet (you pay gas).
 *
 *   safeskills.eth                    (you already own this 2LD; register in the explorer)
 *   └─ acme.safeskills.eth            org subregistry (deployed here)
 *      ├─ weather.acme.safeskills.eth skill + pin + provider delegations
 *      └─ exfil.acme.safeskills.eth   skill + pin + provider delegations
 *
 * Steps (each a tx): deploy a UserRegistry proxy for safeskills.eth + attach it →
 * deploy one for acme + register acme in it → register each skill → set pin/addr →
 * authorizeTextRoles per provider. Prints the org-registry address to put in the
 * web app's NEXT_PUBLIC_ORG_REGISTRY.
 *
 * ⚠️ This builds calldata against ENS's NOT-FINAL v2 contracts; it has not been
 * run end-to-end. Expect to shake out a step or two live. It's resumable — pass
 * AEGIS_SAFESKILLS_REGISTRY / AEGIS_ACME_REGISTRY to skip already-deployed
 * registries. (Reliable alternative: create the names in explorer.ens.dev, then
 * run ens-setup.ts for the pins + delegations.)
 *
 * RUN
 *   pnpm --filter @aegis/chain build
 *   AEGIS_PRIVATE_KEY=0x<owner of safeskills.eth>  AEGIS_RPC_URL=<real-sepolia-rpc> \
 *     node packages/adapters/scripts/ens-deploy.ts
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeEventLog,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { labelhash, namehash } from "viem/ens";
import {
  ALL_ROLES,
  dnsEncode,
  getEnsV2Addresses,
  makeAccount,
  makePublicClient,
  makeWalletClient,
  MAX_EXPIRY,
  permissionedRegistryAbi,
  permissionedResolverAbi,
  proxyInitializeAbi,
  verifiableFactoryAbi,
} from "@aegis/chain";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const pinOf = (file: string) =>
  `sha256:${createHash("sha256").update(readFileSync(join(fixtures, file))).digest("hex")}`;
const attestationKey = (provider: string) => `safeskills.attestation.${provider}`;

// --- config ------------------------------------------------------------------
const ROOT = process.env.AEGIS_ROOT_NAME ?? "safeskills.eth"; // the 2LD you own
const ORG = process.env.AEGIS_ORG_LABEL ?? "acme";
const PROVIDERS = (process.env.AEGIS_PROVIDERS ?? "chainlink.eth,my-local-verifier.eth")
  .split(",").map((p) => p.trim()).filter(Boolean);
const SKILLS = [
  { label: "weather", file: "clean.md" },
  { label: "exfil", file: "poisoned.md" },
];
// -----------------------------------------------------------------------------

const account = await makeAccount(process.env);
if (!account) throw new Error("set AEGIS_PRIVATE_KEY (the owner of " + ROOT + ")");
const owner = account.address as Address;
const providerAddr = (
  process.env.AEGIS_PROVIDER_ADDR ? getAddress(process.env.AEGIS_PROVIDER_ADDR) : owner
) as Address;
const pub = makePublicClient({ timeout: 30_000 });
const wallet = makeWalletClient({ account, timeout: 30_000 });
const chainId = pub.chain?.id ?? 11155111;
const v2 = getEnsV2Addresses(chainId);
// Resolver the skills are registered with + records written to. Default to the
async function send(to: Address, data: Hex, what: string) {
  process.stdout.write(`  ${what} … `);
  const hash = await wallet.sendTransaction({ account: account!, chain: wallet.chain, to, data });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(hash);
  return receipt;
}

/**
 * Deploy a VerifiableFactory proxy (admin = owner, ALL_ROLES) and return its
 * address — used for both UserRegistry and PermissionedResolver proxies. `salt`
 * must differ per proxy (the factory's CREATE2 address only depends on
 * sender+salt), so we key it on a distinct label.
 */
async function deployProxy(impl: Address, saltLabel: string, what: string): Promise<Address> {
  const initData = encodeFunctionData({
    abi: proxyInitializeAbi,
    functionName: "initialize",
    args: [owner, ALL_ROLES],
  });
  const data = encodeFunctionData({
    abi: verifiableFactoryAbi,
    functionName: "deployProxy",
    args: [impl, BigInt(labelhash(saltLabel)), initData],
  });
  const receipt = await send(v2.verifiableFactory, data, what);
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: verifiableFactoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "ProxyDeployed") return getAddress((ev.args as { proxyAddress: string }).proxyAddress);
    } catch {
      /* not our event */
    }
  }
  throw new Error("deployProxy: ProxyDeployed event not found in receipt");
}

// The resolver the skills are registered with + records written to. Reuse one
// via AEGIS_ENS_RESOLVER, else deploy a fresh PermissionedResolver you fully own
// (so setText / authorizeTextRoles are guaranteed authorized).
let RESOLVER: Address;

/** register(label, owner, subregistry, resolver, ALL_ROLES, MAX_EXPIRY) on a registry. */
function registerData(label: string, subregistry: Address): Hex {
  return encodeFunctionData({
    abi: permissionedRegistryAbi,
    functionName: "register",
    args: [label, owner, subregistry, RESOLVER, ALL_ROLES, MAX_EXPIRY],
  });
}

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const reuse = (k: string) => {
  const v = process.env[k];
  return v ? getAddress(v) : undefined;
};

console.log(`Deploying Aegis registry on chain ${chainId} as ${owner}`);
console.log(`root ${ROOT}  org ${ORG}.${ROOT}  providers [${PROVIDERS.join(", ")}] -> ${providerAddr}\n`);

// 0. resolver you fully own (reuse via AEGIS_ENS_RESOLVER, else deploy fresh).
RESOLVER = reuse("AEGIS_ENS_RESOLVER") ?? (await deployProxy(v2.permissionedResolverImpl, "safeskills:resolver", "deploy resolver"));
console.log(`  resolver: ${RESOLVER}\n`);

// 1. safeskills.eth subregistry (where org subnames live) + attach to the 2LD.
let rootRegistry = reuse("AEGIS_SAFESKILLS_REGISTRY");
if (!rootRegistry) {
  rootRegistry = await deployProxy(v2.userRegistryImpl, ROOT.split(".")[0], `deploy registry for ${ROOT}`);
  await send(
    v2.ethRegistry,
    encodeFunctionData({
      abi: permissionedRegistryAbi,
      functionName: "setSubregistry",
      args: [BigInt(labelhash(ROOT.split(".")[0])), rootRegistry],
    }),
    `attach subregistry to ${ROOT}`,
  );
}
console.log(`  safeskills registry: ${rootRegistry}\n`);

// 2. org subregistry (where skills live) + register the org subname.
let orgRegistry = reuse("AEGIS_ACME_REGISTRY");
if (!orgRegistry) {
  orgRegistry = await deployProxy(v2.userRegistryImpl, ORG, `deploy registry for ${ORG}.${ROOT}`);
  await send(rootRegistry, registerData(ORG, orgRegistry), `register ${ORG}.${ROOT} -> ${owner}`);
}
console.log(`  ${ORG} registry: ${orgRegistry}\n`);

// 3. skills: register, pin, addr, delegate each provider's attestation key.
for (const skill of SKILLS) {
  const fqn = `${skill.label}.${ORG}.${ROOT}`;
  const node = namehash(fqn) as Hex;
  console.log(`skill ${fqn}`);
  await send(orgRegistry, registerData(skill.label, ZERO), `register ${fqn}`);
  await send(
    RESOLVER,
    encodeFunctionData({ abi: permissionedResolverAbi, functionName: "setText", args: [node, "safeskills.pin", pinOf(skill.file)] }),
    "setText safeskills.pin",
  );
  await send(
    RESOLVER,
    encodeFunctionData({ abi: permissionedResolverAbi, functionName: "setAddr", args: [node, owner] }),
    "setAddr owner",
  );
  for (const provider of PROVIDERS) {
    await send(
      RESOLVER,
      encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: "authorizeTextRoles",
        args: [dnsEncode(fqn), attestationKey(provider), providerAddr, true],
      }),
      `delegate ${attestationKey(provider)} -> ${providerAddr}`,
    );
  }
}

console.log(`\n✅ Done. Save these to your .env:`);
console.log(`  AEGIS_ENS_RESOLVER=${RESOLVER}          # also needed by attest.ts`);
console.log(`  AEGIS_SAFESKILLS_REGISTRY=${rootRegistry}   # resume + web NEXT_PUBLIC_ORG_REGISTRY`);
console.log(`  AEGIS_ACME_REGISTRY=${orgRegistry}`);
console.log(`\nScore a skill (as a provider):`);
console.log(`  node --env-file=.env packages/adapters/scripts/attest.ts weather.${ORG}.${ROOT} pass 88 my-local-verifier.eth`);
