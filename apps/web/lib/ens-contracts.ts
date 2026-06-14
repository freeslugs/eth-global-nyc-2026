/**
 * ENS v2 (Sepolia) addresses + ABIs needed by the browser write-flow. Kept
 * here (not imported from @aegis/chain) so the client bundle doesn't pull in
 * @aegis/chain's node-only Ledger deps. Mirror of the verified deployment.
 */
export type Address = `0x${string}`;

export const PUBLIC_RESOLVER: Address = "0x5239a812ec9a62f46dbb5de8f346c8efe7553a9f";

/**
 * `safeskills.eth`'s subregistry — the registry orgs register their subname in.
 * Deploy it once (attach a subregistry to safeskills.eth in the explorer), then
 * set NEXT_PUBLIC_ORG_REGISTRY to its address. Until then, on-chain create is
 * disabled in the UI.
 */
export const ORG_REGISTRY = (process.env.NEXT_PUBLIC_ORG_REGISTRY ?? "") as Address | "";

/** uint64 max — a non-expiring name (orgs own their subname outright). */
export const MAX_EXPIRY = (1n << 64n) - 1n;

/** EACBaseRolesLib.ALL_ROLES — give the org full control of its name. */
export const ALL_ROLES =
  0x1111111111111111111111111111111111111111111111111111111111111111n;

/** PermissionedRegistry.register — mints a subname owned by `owner`. */
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
] as const;
