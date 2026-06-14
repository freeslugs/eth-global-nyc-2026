/**
 * ENS v2 (Sepolia) addresses + ABIs for the browser write-flow. Kept here (not
 * imported from @aegis/chain) so the client bundle doesn't pull in @aegis/chain's
 * node-only Ledger deps. Mirror of the verified deployment.
 */
import { labelhash } from "viem/ens";

export type Address = `0x${string}`;

// Shared deployment contracts.
export const PUBLIC_RESOLVER: Address = "0x5239a812ec9a62f46dbb5de8f346c8efe7553a9f";
export const VERIFIABLE_FACTORY: Address = "0xd2a632d8a8b67c2c4398c255cbd7af8dd7236198";
export const USER_REGISTRY_IMPL: Address = "0x0f99e7ea74903afcb7224d0354fd7428a6f92917";
export const PERMISSIONED_RESOLVER_IMPL: Address = "0xdce5205a553573ffd47629327dddf36186022ffa";

/**
 * `safeskills.eth`'s subregistry — companies register their subname here. Each
 * company then gets its OWN subregistry + resolver (deployed at signup), and its
 * skills live under those. Looked up on-chain via getSubregistry/getResolver — no
 * per-company env vars.
 */
export const ORG_REGISTRY = (process.env.NEXT_PUBLIC_ORG_REGISTRY ?? "") as Address | "";

/** uint64 max — non-expiring entries (you own your subnames outright). */
export const MAX_EXPIRY = (1n << 64n) - 1n;

/** EACBaseRolesLib.ALL_ROLES — full control of the name/registry/resolver. */
export const ALL_ROLES =
  0x1111111111111111111111111111111111111111111111111111111111111111n;

/** PermissionedRegistry: register subnames + look up a subname's subregistry/resolver. */
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

/**
 * The canonical token id for a label in a PermissionedRegistry: the labelhash
 * with its low 32 bits (the token-version field) cleared. `ownerOf(tokenId)`
 * takes this; `getSubregistry(label)`/`getResolver(label)` take the raw label.
 */
export const companyTokenId = (label: string): bigint =>
  BigInt(labelhash(label)) & ~0xffffffffn;

/**
 * PermissionedResolver — write the skill's records. `setText` writes one record;
 * `multicall` batches several `setText` calls into a single transaction (so pin +
 * uri + metadata are one wallet confirmation, not three).
 */
export const permissionedResolverAbi = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

/** VerifiableFactory: deploy a company's per-name registry/resolver proxies. */
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
      { name: "proxyAddress", type: "address", indexed: true },
      { name: "salt", type: "uint256", indexed: false },
      { name: "implementation", type: "address", indexed: false },
    ],
  },
] as const;

/** UserRegistry / PermissionedResolver proxy initializer (admin gets roleBitmap). */
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
