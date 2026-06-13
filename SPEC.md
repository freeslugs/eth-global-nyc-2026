# Aegis — Scaffold Spec

> Feed this whole file to your coding agent. It describes a Turborepo monorepo to **scaffold now**, with the ENS / Ledger / Chainlink integrations left as **stubbed ports** to fill in later. Build to the Acceptance Criteria at the end; do not implement anything in the "Do NOT build yet" list.

## 1. What Aegis is (context for good decisions)

Aegis is a trust check that runs *before* an AI agent or developer executes third‑party code (npm packages, MCP servers). Every artifact has a human‑readable name (ENS) whose records pin the exact content hash of its vetted release. Before running anything, a verifier resolves the name, fetches the real artifact, recomputes the hash locally, and blocks on any mismatch, bad provenance, missing attestation, or revocation. The trust key (controls the pin) is deliberately separate from the publish credential, so a stolen npm token can poison a package but cannot move the pin.

The **core verification logic is pure and chain‑agnostic**. Everything that touches a chain, a wallet, or a TEE is behind an interface ("port") with a mock adapter today and a real adapter later.

## 2. Architecture: ports & adapters

```
            apps (web / gateway / cli)
                       │  depend on
                       ▼
        @aegis/core  ──►  PORTS (interfaces) + verify() engine   ← pure, unit-tested, no I/O
                       ▲  implemented by
                       │
        @aegis/adapters ──► mock impls (active)  +  real impls (stubbed, NotImplemented)
                       │
        @aegis/chain (viem clients, ABIs)   packages/contracts (Foundry)
```

Rule: `apps/*` and `@aegis/adapters` may import `@aegis/core`. `@aegis/core` imports **nothing** with I/O (only a hashing lib). Swapping mock→real is an env flag, never a code change in `core` or `apps`.

## 3. Stack (pinned)

- **Monorepo:** Turborepo + pnpm workspaces. Node ≥ 20 (`.nvmrc`).
- **Language:** TypeScript, `strict: true`, ESM everywhere.
- **Web app:** Next.js (App Router, latest), React 19, Tailwind, shadcn/ui. Deploys to **Vercel**.
- **Libraries/CLI build:** `tsup`. **Tests:** `vitest` (TS), `forge` (Solidity).
- **Chain:** `viem` in packages, `wagmi` in the web app.
- **Contracts:** **Foundry** (`forge`). TS bindings via `@wagmi/cli` (foundry plugin) into `@aegis/chain`.
- **MCP:** `@modelcontextprotocol/sdk` for the gateway.
- **Lint/format:** ESLint flat config + Prettier (shared via `tooling/`).

> Note: the **gateway is a long‑running MCP proxy and does NOT deploy to Vercel.** Only `apps/web` goes to Vercel. Gateway + CLI run locally / containerized.

## 4. Directory layout (scaffold exactly this)

```
aegis/
├─ apps/
│  ├─ web/                # Next.js explorer + read API routes (Vercel)
│  ├─ gateway/            # MCP verifying proxy (Node, local)
│  └─ cli/                # `aegis` CLI: publish / verify
├─ packages/
│  ├─ core/               # @aegis/core — domain types, ports, verify() engine (pure)
│  ├─ adapters/           # @aegis/adapters — mock (active) + real (stub) port impls
│  ├─ chain/              # @aegis/chain — viem clients, generated ABIs, addresses
│  └─ contracts/          # Foundry project (Solidity) — standalone
├─ tooling/
│  ├─ eslint/             # shared eslint config
│  └─ typescript/         # shared tsconfig bases
├─ .env.example
├─ .nvmrc
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## 5. `@aegis/core` — the crown jewel (build first, test hard)

Pure TypeScript. No network, no chain, no fs. One dependency allowed: a hashing lib (`@noble/hashes`).

### 5.1 Domain types (`src/types.ts`)

```ts
export type Hex = `0x${string}`;
export type ArtifactHash = string;            // canonical form "sha256:<hex>"

export interface Artifact {
  bundle: Uint8Array;                          // package / server code
  manifest: Uint8Array;                        // MCP tool descriptors — hashed SEPARATELY (poisoning surface)
}
export interface ArtifactDigest {
  bundleHash: ArtifactHash;
  manifestHash: ArtifactHash;
}
export interface ResolvedRecord {
  name: string;
  bundleHash: ArtifactHash;                    // the PIN
  manifestHash: ArtifactHash;                  // the PIN (descriptors)
  publisher: Hex;                              // address that must have signed provenance
  policyRef: string;                           // policy id or URI
  logRef?: string;                             // pointer to attestation log
}
export type AttestationKind = "provenance" | "review" | "confidential" | "revocation";
export interface Attestation {
  subject: ArtifactHash;                       // = bundleHash
  kind: AttestationKind;
  attestor: Hex;
  signature?: Hex;
  analyzer?: ArtifactHash;                     // confidential lane: which program produced the verdict
  payload?: unknown;                           // verdict / score / flags
  bond?: bigint;
  createdAt: number;
}
export interface Policy {
  requireProvenance: boolean;
  minReviews: number;
  trustedAttestors?: Hex[];
  trustedAnalyzers?: ArtifactHash[];           // confidential lane
}
export type VerifyResult =
  | { ok: true }
  | { ok: false;
      reason: "hash_mismatch" | "manifest_changed" | "bad_provenance" | "revoked" | "under_policy";
      detail?: string };
```

### 5.2 Ports (`src/ports.ts`) — the seams

```ts
import type { Artifact, ArtifactHash, ResolvedRecord, Attestation, Hex } from "./types";

export interface Fetcher   { fetch(source: string): Promise<Artifact>; }            // npm / url / file
export interface Resolver  { resolve(name: string): Promise<ResolvedRecord>; }      // ENS lives here
export interface Signer    { address(): Promise<Hex>; sign(msg: Uint8Array): Promise<Hex>; } // Ledger lives here
export interface AttestationStore {
  getAttestations(subject: ArtifactHash): Promise<Attestation[]>;
  isRevoked(subject: ArtifactHash): Promise<boolean>;
  postAttestation(a: Attestation): Promise<void>;
  postRevocation(subject: ArtifactHash, by: Hex, signature: Hex): Promise<void>;
  setPin(rec: ResolvedRecord): Promise<void>;                                        // used by publish flow
}
export interface ConfidentialAttester {                                              // Chainlink lives here
  requestAnalysis(subject: ArtifactHash, analyzer: ArtifactHash, uri: string): Promise<void>;
}
```

### 5.3 Engine (`src/verify.ts`, `src/hash.ts`, `src/policy.ts`)

```ts
export function digest(a: Artifact): ArtifactDigest;          // sha256 of bundle + manifest, canonical form

// Pure: caller gathers attestations/revoked via the store and passes them in.
export function verify(input: {
  resolved: ResolvedRecord;
  fetched: ArtifactDigest;
  policy: Policy;
  attestations: Attestation[];
  revoked: boolean;
  verifyProvenanceSig: (rec: ResolvedRecord, provenance: Attestation) => boolean;
}): VerifyResult;
```

`verify()` order: hash match → manifest match → provenance sig valid → not revoked → policy satisfied. First failure returns its reason.

### 5.4 Tests (`src/__tests__/`)

Fixtures: a `good` artifact and a `tampered` artifact (different manifest bytes). Cover: ALLOW on good; `hash_mismatch`/`manifest_changed` on tampered; `revoked`; `under_policy` (zero reviews when `minReviews=1`). 100% of `verify()` branches.

## 6. `@aegis/adapters` — mock now, real later

Depends on `@aegis/core` (+ `@aegis/chain`, `viem` for the real stubs). Structure:

```
adapters/src/
├─ fetch/      { FileFetcher (active), NpmFetcher (stub) }
├─ resolver/   { MockResolver (active, JSON-seeded), EnsResolver (stub) }
├─ signer/     { LocalSigner (active, viem private key), LedgerSigner (stub) }
├─ store/      { MemoryStore (active), OnchainStore (stub, viem) }
├─ confidential/ { OffConfidential (active no-op), ChainlinkConfidential (stub) }
└─ factory.ts  // reads env, returns the right impl per port
```

Every **stub** real impl:
```ts
export class EnsResolver implements Resolver {
  async resolve(): Promise<ResolvedRecord> {
    throw new NotImplementedError("TODO(ens): resolve via viem getEnsText");
  }
}
```
`factory.ts` defaults to all mocks so the repo runs with zero chain config:
```ts
// AEGIS_RESOLVER=mock|ens   AEGIS_SIGNER=local|ledger
// AEGIS_STORE=memory|onchain   AEGIS_CONFIDENTIAL=off|chainlink   AEGIS_FETCHER=file|npm
export function buildAdapters(env = process.env): Adapters { /* switch on flags, default mock */ }
```
Seed the `MockResolver`/`MemoryStore` from `adapters/fixtures/registry.seed.json` containing ~3 artifacts, one of which is **poisoned** (manifest hash won't match its tampered fixture) so every app can demo a block.

## 7. `apps/cli` — `aegis`

Commander-based, built with tsup. Wires to `buildAdapters()`.
- `aegis publish <name> <path>` → `digest()`, `signer.sign()`, `store.setPin()` + post a `provenance` attestation. (mock signer/store today)
- `aegis verify <name> <path>` → `resolver.resolve()` + `fetcher.fetch()` + `digest()` + gather attestations + `verify()`; print ALLOW (green) or BLOCK + reason (red), exit code 0/1.
- `aegis revoke <name>` → `store.postRevocation()`.

## 8. `apps/gateway` — MCP verifying proxy

Node service using `@modelcontextprotocol/sdk`. Sits between an MCP client (the agent) and an upstream MCP server.
- On a new upstream connection: resolve its name → fetch/identify its build + tool manifest → `verify()`.
- Pass → expose the upstream tools to the client. Fail → refuse to expose tools, return a structured block + reason, emit an escalation event (stub: console; later: Ledger sign + on‑chain revocation).
- Ship a trivial **sample upstream MCP server** fixture (`apps/gateway/fixtures/echo-server`) so the demo runs offline. Include a script to swap in the poisoned manifest to demo the block.

## 9. `apps/web` — explorer (Vercel)

Next.js App Router. Reads through `@aegis/adapters` (mock store by default) via a route handler `app/api/registry/route.ts` so the swap to on‑chain is automatic later.
- `/` — list artifacts with status badges (verified / poisoned / revoked), each linking to detail.
- `/a/[hash]` — artifact detail: pinned hashes, publisher, attestations, revocation state.
- `/verify` — paste a name + upload a file → calls a route that runs `verify()` → ALLOW/BLOCK.
- shadcn/ui components; keep it clean. One screen must clearly show the poisoned artifact getting flagged.

Vercel config: project root `apps/web`, build `turbo build --filter=web`, use `turbo-ignore`.

## 10. `packages/contracts` — Foundry (skeleton, not wired to apps)

```
contracts/src/
├─ AttestationRegistry.sol   // mapping subject => Attestation[]; events Attested, Revoked
│                            // postAttestation(...), revoke(...); onlyForwarder modifier (placeholder)
└─ Bonding.sol               // stake(), withdraw(), slash() — skeletons + events
contracts/test/
└─ AttestationRegistry.t.sol // post + read; revoke + read. Must pass `forge test`.
```
Keep storage/events realistic but logic minimal. Export ABIs to `@aegis/chain` via `@wagmi/cli`. The app stays on the memory store by default; on‑chain wiring is later.

## 11. `@aegis/chain`

viem `publicClient`/`walletClient` factory (RPC from env, optional), generated contract ABIs + a `addresses.ts` (testnet placeholders, `0x0` defaults). No app depends on this being live in mock mode.

## 12. Conventions

- TS `strict`, `noUncheckedIndexedAccess`, ESM, `verbatimModuleSyntax`.
- Shared `tsconfig` + eslint from `tooling/`. Prettier. `engines.node >= 20`.
- `NotImplementedError` exported from `@aegis/core/errors`; every unfinished real adapter throws it with a `TODO(ens|ledger|chainlink|npm)` message.
- Root scripts: `pnpm build|lint|typecheck|test|dev` → turbo pipelines.
- `.env.example` lists every `AEGIS_*` flag defaulting to mock, plus commented RPC/keys.

## 13. Build order (for the agent)

1. Repo skeleton: pnpm workspace, `turbo.json`, `tooling/*`, root scripts, `.nvmrc`, `.env.example`.
2. `@aegis/core`: types → ports → hash/policy/verify → vitest fixtures + tests. (Fully green before moving on.)
3. `@aegis/adapters`: mocks active, real stubs throwing, `factory.ts`, seed JSON.
4. `apps/cli`: publish/verify/revoke against mocks.
5. `packages/contracts`: Foundry skeleton + passing tests; generate ABIs into `@aegis/chain`.
6. `apps/web`: explorer + verify page reading the mock store.
7. `apps/gateway`: proxy + sample upstream server + block demo.
8. `@aegis/chain` wiring left behind the `onchain`/`ens`/`ledger`/`chainlink` stubs (inactive).

## 14. Acceptance criteria ("scaffolded" = all true)

1. `pnpm install` clean; `pnpm turbo build|lint|typecheck` all pass.
2. `pnpm --filter @aegis/core test` green, covering every `verify()` branch.
3. CLI: `aegis verify <good>` → ALLOW (exit 0); `aegis verify <poisoned>` → BLOCK `manifest_changed` (exit 1). No hard‑coded verdicts — it really hashes the file.
4. `apps/web` renders the seeded registry incl. the poisoned artifact flagged; `/verify` returns a real result.
5. `apps/gateway` boots, wraps the sample upstream server, and blocks when the poisoned manifest is swapped in.
6. `forge build && forge test` pass in `packages/contracts`.
7. With **no** chain env vars set, everything runs on mocks. Setting `AEGIS_*=…real` reaches a stub that throws `NotImplementedError` — proving the seam exists without being implemented.

## 15. Do NOT build yet (just leave the seams)

- Real ENS resolution (`EnsResolver`) — stub only.
- Ledger signing (`LedgerSigner`) — stub only.
- Chainlink confidential attester (`ChainlinkConfidential`) — stub only.
- On‑chain store writes (`OnchainStore`) — stub only.
- Bonding economics, slashing disputes, npm registry fetch — skeletons/stubs only.
```
