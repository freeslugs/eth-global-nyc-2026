import { createPublicClient, decodeAbiParameters, http, isAddress, type Address } from "viem";
import { labelhash } from "viem/ens";
import { sepolia } from "viem/chains";

/**
 * On-chain discovery of the live catalog. The registry IS the source of truth:
 * every company is a subname under `safeskills.eth`, and every skill is a subname
 * under that company's own subregistry. We enumerate both straight from the chain
 * so anything created via the app shows up without touching the seed file.
 *
 * How: a PermissionedRegistry emits a register event (topic0 below) whose first
 * non-indexed param is the new label string. We scan that event on the org
 * registry to list companies, look up each company's subregistry, and scan THAT
 * for skill labels. labelhash isn't reversible, so the event (not TransferSingle)
 * is what gives us the human label.
 */

const ROOT = process.env.AEGIS_ROOT_NAME ?? "safeskills.eth";
const ORG_REGISTRY = process.env.NEXT_PUBLIC_ORG_REGISTRY as Address | undefined;

/** PermissionedRegistry register event; label is the leading non-indexed string. */
const REGISTER_EVENT =
  "0x2fe093918572373e9f1f0368f414dffd0043a74ae8c9fd7b0e390b26a0d20b6e" as const;

/** Public RPCs cap eth_getLogs at a 50k block span — scan in chunks. */
const CHUNK = 50_000n;
/** How far back to look. Override per-deploy with AEGIS_DISCOVERY_LOOKBACK. */
const LOOKBACK = BigInt(process.env.AEGIS_DISCOVERY_LOOKBACK ?? "400000");
/** Optional exact start block (the registry's deploy block) — beats LOOKBACK. */
const FROM_BLOCK = process.env.AEGIS_DISCOVERY_FROM_BLOCK
  ? BigInt(process.env.AEGIS_DISCOVERY_FROM_BLOCK)
  : undefined;

const getSubregistryAbi = [
  {
    name: "getSubregistry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000";

/** Token id for a label in a PermissionedRegistry: labelhash with the low 32 (version) bits cleared. */
function tokenId(label: string): bigint {
  return BigInt(labelhash(label)) & ~0xffffffffn;
}

export interface DiscoveredOrg {
  /** Company label, e.g. "gilad-co". */
  label: string;
  /** Company ENS name, e.g. "gilad-co.safeskills.eth". */
  name: string;
  /** The company's own subregistry address. */
  subregistry: Address;
  /** Fully-qualified skill names under this company. */
  skillNames: string[];
}

export interface Discovered {
  orgs: DiscoveredOrg[];
  /** Every skill name across all companies, flattened. */
  skillNames: string[];
  /** Skill name -> on-chain token owner (the wallet that registered it). */
  ownerByName: Record<string, Address>;
}

function client() {
  return createPublicClient({ chain: sepolia, transport: http(process.env.AEGIS_RPC_URL) });
}

/** The register labels minted on a registry, recovered from the register event. */
async function labelsOf(c: ReturnType<typeof client>, registry: Address): Promise<string[]> {
  const latest = await c.getBlockNumber();
  const from = FROM_BLOCK ?? (latest > LOOKBACK ? latest - LOOKBACK : 0n);
  const labels = new Set<string>();
  for (let to = latest; to >= from; to -= CHUNK) {
    const lo = to - CHUNK + 1n > from ? to - CHUNK + 1n : from;
    const logs = await c.getLogs({ address: registry, fromBlock: lo, toBlock: to });
    for (const log of logs) {
      if (log.topics[0] !== REGISTER_EVENT) continue;
      try {
        const [label] = decodeAbiParameters([{ type: "string" }], log.data);
        if (label) labels.add(label);
      } catch {
        // not the layout we expect — skip
      }
    }
    if (lo === from) break;
  }
  return [...labels];
}

/** 30s in-process cache — discovery is many getLogs calls; a page render shouldn't redo it. */
let cache: { at: number; value: Discovered } | undefined;
const TTL_MS = 30_000;

/**
 * Walk the registry tree and return every company + skill currently on-chain.
 * Returns an empty catalog (never throws) if the org registry isn't configured.
 */
export async function discover(): Promise<Discovered> {
  if (!ORG_REGISTRY || !isAddress(ORG_REGISTRY))
    return { orgs: [], skillNames: [], ownerByName: {} };
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const c = client();
  const companyLabels = await labelsOf(c, ORG_REGISTRY);

  const orgs: DiscoveredOrg[] = [];
  const ownerByName: Record<string, Address> = {};
  for (const label of companyLabels) {
    const subregistry = (await c.readContract({
      address: ORG_REGISTRY,
      abi: getSubregistryAbi,
      functionName: "getSubregistry",
      args: [label],
    })) as Address;
    if (!subregistry || subregistry === ZERO) continue;
    const name = `${label}.${ROOT}`;
    const skillLabels = await labelsOf(c, subregistry);
    orgs.push({ label, name, subregistry, skillNames: skillLabels.map((s) => `${s}.${name}`) });

    // The skill's real owner is its registry token owner (we never set an addr
    // record), so read ownerOf for each. Tolerant: a token that doesn't resolve
    // just has no owner entry.
    await Promise.all(
      skillLabels.map(async (s) => {
        try {
          const owner = (await c.readContract({
            address: subregistry,
            abi: getSubregistryAbi,
            functionName: "ownerOf",
            args: [tokenId(s)],
          })) as Address;
          if (owner && owner !== ZERO) ownerByName[`${s}.${name}`] = owner;
        } catch {
          // token not found / not enumerable — skip
        }
      }),
    );
  }

  const value: Discovered = { orgs, skillNames: orgs.flatMap((o) => o.skillNames), ownerByName };
  cache = { at: Date.now(), value };
  return value;
}

/** Flat list of every skill name on-chain (convenience for the registry page). */
export async function discoverSkillNames(): Promise<string[]> {
  return (await discover()).skillNames;
}
