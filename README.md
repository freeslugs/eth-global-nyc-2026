# Aegis

A trust check that runs **before** an AI agent or developer executes third‑party code (npm
packages, MCP servers). Every artifact has a human‑readable name (ENS) whose records pin the exact
content hash of its vetted release. Before running anything, a verifier resolves the name, fetches
the real artifact, **re‑hashes it locally**, and blocks on any mismatch, bad provenance, missing
attestation, or revocation.

The **core verification logic is pure and chain‑agnostic.** Everything that touches a chain, a
wallet, or a TEE sits behind an interface ("port") with a mock adapter today and a real adapter
later. Swapping mock → real is an env flag, never a code change in `core` or the apps.

## Layout

```
apps/
  web/        Next.js explorer + read API routes (Vercel)
  gateway/    MCP verifying proxy (Node, local)
  cli/        `aegis` CLI: publish / verify / revoke
packages/
  core/       @aegis/core   — domain types, ports, verify() engine (pure, 100% unit-tested)
  adapters/   @aegis/adapters — mock impls (active) + real impls (stubbed, throw NotImplementedError)
  chain/      @aegis/chain  — viem clients, generated ABIs, addresses
  contracts/  Foundry project (Solidity) — standalone
tooling/      shared eslint + tsconfig
```

Dependency rule: `apps/*` and `@aegis/adapters` may import `@aegis/core`. `@aegis/core` imports
nothing with I/O (only `@noble/hashes`).

## Quick start

```bash
nvm use            # Node >= 24
pnpm install
pnpm turbo build lint typecheck test   # all green
```

### CLI demo (it really hashes the file — no hard-coded verdicts)

```bash
pnpm --filter @aegis/cli build

# ALLOW (exit 0): bytes match the pin
node apps/cli/dist/index.js verify echo-tool.aegis.eth packages/adapters/fixtures/artifacts/echo-tool

# BLOCK manifest_changed (exit 1): the manifest was tampered after pinning
node apps/cli/dist/index.js verify mailer-tool.aegis.eth packages/adapters/fixtures/artifacts/mailer-tool

# BLOCK revoked (exit 1)
node apps/cli/dist/index.js verify weather-tool.aegis.eth packages/adapters/fixtures/artifacts/weather-tool
```

### Gateway demo (verifying MCP proxy)

```bash
pnpm --filter @aegis/gateway build
pnpm --filter @aegis/gateway demo   # PASS (wraps the echo upstream), then BLOCK on a poisoned manifest
```

### Web explorer (deployed at [eth-global-nyc-2026.vercel.app](https://eth-global-nyc-2026.vercel.app))

```bash
pnpm --filter web dev   # http://localhost:3000  — registry, artifact detail, /verify
```

To deploy the web app to Vercel:

1. Push to `main` (auto-deploys via git integration)
2. Or run locally: `vercel build && vercel deploy --prebuilt`

Requires the Vercel project's **Root Directory** set to `apps/web` in the dashboard for optimal Turborepo support.

### Contracts

```bash
cd packages/contracts && forge build && forge test
# regenerate TS ABIs into @aegis/chain:
pnpm --filter @aegis/chain generate
```

## The seam (mocks → real)

Every adapter defaults to a mock so the repo runs with **zero chain config**. Flip a flag to reach a
stub that throws `NotImplementedError` with a `TODO(...)` marker — proving the seam exists:

```bash
AEGIS_RESOLVER=ens node apps/cli/dist/index.js verify echo-tool.aegis.eth ./x
#  ✗ ERROR  TODO(ens): resolve via viem getEnsText (...)
```

Flags (see `.env.example`): `AEGIS_RESOLVER` `AEGIS_SIGNER` `AEGIS_STORE` `AEGIS_CONFIDENTIAL`
`AEGIS_FETCHER`. The real ENS / Ledger / Chainlink / on‑chain‑store / npm‑fetch adapters are
intentionally **stubbed** for now.

## Verify order

`verify()` checks, first failure wins: bundle hash → manifest hash → provenance signature →
revocation → policy (reviews, trusted analyzers).
