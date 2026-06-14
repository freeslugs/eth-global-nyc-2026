import type { Address, Hex } from "viem";

/**
 * DNS wire-format encoding of an ENS name (each label length-prefixed, then a
 * zero byte). ENS v2's `authorizeTextRoles(bytes toName, …)` takes the name in
 * THIS form — not a bytes32 node, not a plain string.
 *
 *   dnsEncode("weather.acme.safeskills.eth")
 *     -> 0x07 weather 04 acme 0a safeskills 03 eth 00
 */
export function dnsEncode(name: string): Hex {
  const out: number[] = [];
  for (const label of name.split(".")) {
    if (label.length === 0) continue;
    const bytes = new TextEncoder().encode(label);
    if (bytes.length > 255) throw new Error(`dnsEncode: label too long: ${label}`);
    out.push(bytes.length, ...bytes);
  }
  out.push(0);
  return `0x${out.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * ENS v2 (Namechain) deployment on Sepolia + minimal ABIs for the Aegis name
 * model. Addresses are the `sepolia-official-…20260525-r2` set from
 * ensdomains/namechain (branch chore/sepolia-deployments), verified on-chain.
 *
 * ⚠️ ENS v2 Sepolia is reset periodically (active development). If reads/writes
 * start failing, re-pull the latest dated deployment folder and update these.
 *
 * The READ Universal Resolver vanity address equals viem's built-in Sepolia
 * `ensUniversalResolver`, so `getEnsText`/`getEnsAddress` work with no override.
 */
export interface EnsV2Addresses {
  /** Vanity Universal Resolver proxy — read entry point. */
  universalResolver: Address;
  /** L1 root permissioned registry. */
  rootRegistry: Address;
  /** The `.eth` permissioned registry (holds 2LDs like safeskills.eth). */
  ethRegistry: Address;
  /** Commit-reveal registrar for `.eth` names (pays in USDC). */
  ethRegistrar: Address;
  /** Shared PublicResolverV2 instance (text records + role grants). */
  publicResolver: Address;
  /** Logic impl for per-account resolver proxies. */
  permissionedResolverImpl: Address;
  /** Deploys per-name registry/resolver proxies. */
  verifiableFactory: Address;
  /** Org subregistry implementation (deployed via the factory). */
  userRegistryImpl: Address;
}

export const ensV2Addresses: Record<number, EnsV2Addresses> = {
  // Sepolia — ensdomains/namechain sepolia-official-v1-20260525-r2 (verified on-chain).
  11155111: {
    universalResolver: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
    rootRegistry: "0xc960f7217d3643b525ef36bec8adf86953cd9ab8",
    ethRegistry: "0xdedb92913a25abe1f7bcdd85d8a344a43b398b67",
    ethRegistrar: "0x8c2e866b439358c41ae05de9cbe8a00bfefaffca",
    publicResolver: "0x5239a812ec9a62f46dbb5de8f346c8efe7553a9f",
    permissionedResolverImpl: "0xdce5205a553573ffd47629327dddf36186022ffa",
    verifiableFactory: "0xd2a632d8a8b67c2c4398c255cbd7af8dd7236198",
    userRegistryImpl: "0x0f99e7ea74903afcb7224d0354fd7428a6f92917",
  },
};

export function getEnsV2Addresses(chainId: number): EnsV2Addresses {
  const a = ensV2Addresses[chainId];
  if (!a) throw new Error(`@aegis/chain: no ENS v2 addresses for chain ${chainId}`);
  return a;
}

/** Permissioned-resolver role bits (FLAGS.RESOLVER). Admin of a role = role << 128n. */
export const ENS_ROLES = {
  SET_ADDR: 1n << 0n,
  SET_TEXT: 1n << 4n,
  SET_CONTENTHASH: 1n << 8n,
} as const;

/** Registry role bits (FLAGS.REGISTRY). */
export const REGISTRY_ROLES = {
  REGISTRAR: 1n << 0n,
  SET_SUBREGISTRY: 1n << 20n,
  SET_RESOLVER: 1n << 24n,
} as const;

/** EACBaseRolesLib.ALL_ROLES — every role nybble set; the registry/resolver admin. */
export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;

/** uint64 max — a non-expiring entry (used for org/skill subnames you own). */
export const MAX_EXPIRY = (1n << 64n) - 1n;

/** UserRegistry / PermissionedResolver proxy initializer (deployed via the factory). */
export const proxyInitializeAbi = [
  {
    name: "initialize",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "admin", type: "address" },
      { name: "roleBitmap", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/** PublicResolverV2 / PermissionedResolver: text records + per-key delegation. */
export const permissionedResolverAbi = [
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "node", type: "bytes32" }, { name: "key", type: "string" }, { name: "value", type: "string" }],
    outputs: [],
  },
  {
    name: "setAddr",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "node", type: "bytes32" }, { name: "a", type: "address" }],
    outputs: [],
  },
  // Record-level delegation: grant `account` the right to set ONLY `key`.
  // `toName` is the DNS-encoded name (NOT a bytes32 node).
  {
    name: "authorizeTextRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toName", type: "bytes" },
      { name: "key", type: "string" },
      { name: "account", type: "address" },
      { name: "grant", type: "bool" },
    ],
    outputs: [],
  },
  // Name-level delegation: grant a role bitmap over the whole name.
  {
    name: "authorizeNameRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "toName", type: "bytes" },
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
      { name: "grant", type: "bool" },
    ],
    outputs: [],
  },
] as const;

/** PermissionedRegistry: register subnames + attach subregistries/resolvers. */
export const permissionedRegistryAbi = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "subregistry", type: "address" },
      { name: "resolver", type: "address" },
      { name: "roleBitmap", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "setSubregistry",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }, { name: "registry", type: "address" }],
    outputs: [],
  },
  {
    name: "setResolver",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }, { name: "resolver", type: "address" }],
    outputs: [],
  },
  {
    name: "getSubregistry",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "getResolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

/** VerifiableFactory: deploy per-name registry/resolver proxies. */
export const verifiableFactoryAbi = [
  {
    name: "deployProxy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "proxy", type: "address" }],
  },
  {
    name: "ProxyDeployed",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "proxyAddress", type: "address", indexed: false },
      { name: "salt", type: "uint256", indexed: false },
      { name: "implementation", type: "address", indexed: false },
    ],
  },
] as const;
