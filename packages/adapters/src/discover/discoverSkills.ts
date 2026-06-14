import { createPublicClient, decodeAbiParameters, http, isAddress, type Address, type PublicClient } from "viem";
import { labelhash } from "viem/ens";
import { sepolia } from "viem/chains";
import { getEnsV2Addresses } from "@aegis/chain";

/**
 * On-chain discovery of the live skill catalog — the SAME code the web app and the
 * CLI use, so both see exactly what's on ENS. The registry IS the source of truth:
 * every company is a subname under `safeskills.eth`, and every skill is a subname
 * under that company's own subregistry. We enumerate both straight from the chain.
 *
 * How: a PermissionedRegistry emits a register event (topic0 below) whose first
 * non-indexed param is the new label string. We scan that event on the org registry
 * to list companies, look up each company's subregistry, and scan THAT for skill
 * labels. labelhash isn't reversible, so the event is what recovers the human label.
 */

/** PermissionedRegistry register event; label is the leading non-indexed string. */
const REGISTER_EVENT =
  "0x2fe093918572373e9f1f0368f414dffd0043a74ae8c9fd7b0e390b26a0d20b6e" as const;

/** Public RPCs cap eth_getLogs at a 50k block span — scan in chunks. */
const CHUNK = 50_000n;

const ZERO = "0x0000000000000000000000000000000000000000";

const registryAbi = [
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

/** Token id for a label in a PermissionedRegistry: labelhash with the low 32 (version) bits cleared. */
function tokenId(label: string): bigint {
  return BigInt(labelhash(label)) & ~0xffffffffn;
}

export interface DiscoveredOrg {
  /** Company label, e.g. "acme". */
  label: string;
  /** Company ENS name, e.g. "acme.safeskills.eth". */
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

export interface DiscoverOptions {
  /** Inject a viem client (tests). Defaults to a Sepolia client over `rpcUrl`. */
  client?: PublicClient;
  rpcUrl?: string;
  chainId?: number;
  /**
   * The org registry (the `safeskills.eth` subregistry). If omitted, it's derived
   * on-chain via `ethRegistry.getSubregistry(<root label>)` — so callers need no env.
   */
  orgRegistry?: Address;
  /** Root name whose subregistry holds the companies. Default `safeskills.eth`. */
  rootName?: string;
  /** First block to scan. Default 11_000_000 (Safe Skills deploy floor on Sepolia). */
  fromBlock?: bigint;
}

function clientFor(opts: DiscoverOptions): { client: PublicClient; chainId: number } {
  const chainId = opts.chainId ?? sepolia.id;
  const client =
    opts.client ??
    (createPublicClient({ chain: sepolia, transport: http(opts.rpcUrl ?? process.env.AEGIS_RPC_URL) }) as PublicClient);
  return { client, chainId };
}

/** Resolve the org registry (env override → explicit option → derive from the .eth registry). */
async function resolveOrgRegistry(
  client: PublicClient,
  chainId: number,
  opts: DiscoverOptions,
): Promise<Address | undefined> {
  const envOverride = process.env.NEXT_PUBLIC_ORG_REGISTRY as Address | undefined;
  const explicit = opts.orgRegistry ?? envOverride;
  if (explicit && isAddress(explicit)) return explicit;

  const rootName = opts.rootName ?? process.env.AEGIS_ROOT_NAME ?? "safeskills.eth";
  const rootLabel = rootName.split(".")[0];
  if (!rootLabel) return undefined;
  try {
    const ethRegistry = getEnsV2Addresses(chainId).ethRegistry;
    const sub = (await client.readContract({
      address: ethRegistry,
      abi: registryAbi,
      functionName: "getSubregistry",
      args: [rootLabel],
    })) as Address;
    return sub && sub !== ZERO ? sub : undefined;
  } catch {
    return undefined;
  }
}

/** Register labels minted on a registry, recovered from the register event (scanned in concurrent 50k chunks). */
async function labelsOf(client: PublicClient, registry: Address, fromBlock: bigint, latest: bigint): Promise<string[]> {
  const from = fromBlock > latest ? latest : fromBlock;
  const ranges: Array<[bigint, bigint]> = [];
  for (let lo = from; lo <= latest; lo += CHUNK) {
    const hi = lo + CHUNK - 1n > latest ? latest : lo + CHUNK - 1n;
    ranges.push([lo, hi]);
  }
  const chunks = await Promise.all(
    ranges.map(([lo, hi]) => client.getLogs({ address: registry, fromBlock: lo, toBlock: hi })),
  );
  const labels = new Set<string>();
  for (const logs of chunks) {
    for (const log of logs) {
      if (log.topics[0] !== REGISTER_EVENT) continue;
      try {
        const [label] = decodeAbiParameters([{ type: "string" }], log.data);
        if (label) labels.add(label);
      } catch {
        /* not the layout we expect — skip */
      }
    }
  }
  return [...labels];
}

/**
 * Walk the registry tree and return every company + skill currently on-chain.
 * Returns an empty catalog (never throws) if the org registry can't be resolved.
 */
export async function discoverSkills(opts: DiscoverOptions = {}): Promise<Discovered> {
  const { client, chainId } = clientFor(opts);
  const orgRegistry = await resolveOrgRegistry(client, chainId, opts);
  if (!orgRegistry) return { orgs: [], skillNames: [], ownerByName: {} };

  const rootName = opts.rootName ?? process.env.AEGIS_ROOT_NAME ?? "safeskills.eth";
  const fromBlock = opts.fromBlock ?? BigInt(process.env.AEGIS_DISCOVERY_FROM_BLOCK ?? "11000000");
  const latest = await client.getBlockNumber();
  const companyLabels = await labelsOf(client, orgRegistry, fromBlock, latest);

  const ownerByName: Record<string, Address> = {};
  const settled = await Promise.all(
    companyLabels.map(async (label): Promise<DiscoveredOrg | null> => {
      const subregistry = (await client.readContract({
        address: orgRegistry,
        abi: registryAbi,
        functionName: "getSubregistry",
        args: [label],
      })) as Address;
      if (!subregistry || subregistry === ZERO) return null;
      const name = `${label}.${rootName}`;
      const skillLabels = await labelsOf(client, subregistry, fromBlock, latest);

      // The skill's real owner is its registry token owner (no addr record is set).
      await Promise.all(
        skillLabels.map(async (s) => {
          try {
            const owner = (await client.readContract({
              address: subregistry,
              abi: registryAbi,
              functionName: "ownerOf",
              args: [tokenId(s)],
            })) as Address;
            if (owner && owner !== ZERO) ownerByName[`${s}.${name}`] = owner;
          } catch {
            /* token not found / not enumerable — skip */
          }
        }),
      );
      return { label, name, subregistry, skillNames: skillLabels.map((s) => `${s}.${name}`) };
    }),
  );
  const orgs = settled.filter((o): o is DiscoveredOrg => o !== null);
  return { orgs, skillNames: orgs.flatMap((o) => o.skillNames), ownerByName };
}

/** Flat list of every skill name on-chain. */
export async function discoverSkillNames(opts: DiscoverOptions = {}): Promise<string[]> {
  return (await discoverSkills(opts)).skillNames;
}
