# Safe Skills (Aegis)

A trust check that runs **before** an AI agent or developer loads an agent **skill** (a `SKILL.md`).
Every skill has a human‑readable name (ENS) whose records pin the exact content hash of its
reviewed file. A skill is reviewed by an LLM inside a Chainlink TEE; the verdict is written back to
the ENS name. Before installing, the consumer resolves the name, **re‑hashes the file locally**, and
the `gate()` blocks on any mismatch, failing/ missing verdict, or revocation — and a **Ledger**
signature authorizes the install.

> Canonical design: [ADR-001-aegis.md](./ADR-001-aegis.md). Parallel-work lanes:
> [OWNERSHIP.md](./OWNERSHIP.md). `PLAN.md` is superseded.

The **core logic is pure and chain‑agnostic.** Everything that touches a chain, a wallet, or a TEE
sits behind an interface ("port") with a mock adapter today and a real adapter later. Swapping
mock → real is an env flag, never a code change in `core` or the apps.

## Layout

```
apps/
  web/           Next.js explorer + /verify + read API route handlers (the ONE Vercel app)
  cli/           `safeskills` CLI: check / install / --no-ledger
  cre-workflow/  Chainlink CRE review job (DON-deployed / local runner — not hosted)
packages/
  core/          @aegis/core     — types, ports, gate() + hashSkill (pure) + testing/ contract suites
  adapters/      @aegis/adapters — one module per port: mock (default) + real (stubbed) + contract test
  chain/         @aegis/chain    — viem clients, generated ABIs, addresses
  contracts/     Foundry project — SubmissionRegistry.sol (+ legacy AttestationRegistry/Bonding)
tooling/         shared eslint + tsconfig
```

Dependency rule: `apps/*` and `@aegis/adapters` may import `@aegis/core`; **adapters never import
each other**. `@aegis/core` imports nothing with I/O (only `@noble/hashes`).

## Where does each piece of code live? (read this first)

Every integration has exactly one home. The **port** (the typed interface) is in `@aegis/core`; the
**mock** and the **real** implementation sit side-by-side in one adapter module; the **contract
test** that both must pass is in `@aegis/core/testing`. Find your thing in the table, edit only
those files.

### 🔗 Chainlink (CRE review in a TEE)

Two ports + the workflow that drives them. Nothing else touches Chainlink.

| What | File |
|---|---|
| Port: "get an AI verdict" | `packages/core/src/ports.ts` → `ReviewClient` |
| Mock review (scans bytes, flags exfil) | `packages/adapters/src/review/MockReview.ts` |
| **Real Confidential-AI client** (LLM in TEE) | `packages/adapters/src/review/ConfidentialAiClient.ts` |
| Port: "watch the on-chain trigger" | `packages/core/src/ports.ts` → `SubmissionWatcher` |
| Mock trigger (`emit()`) | `packages/adapters/src/watcher/MockWatcher.ts` |
| **Real event watcher** (viem `watchEvent`) | `packages/adapters/src/watcher/ChainWatcher.ts` |
| **The CRE workflow itself** (fetch→hash→review→write) | `apps/cre-workflow/src/workflow.ts` |
| CRE entrypoint / local runner | `apps/cre-workflow/src/index.ts` |
| Review prompt (what the LLM is told to flag) | `apps/cre-workflow/src/workflow.ts` → `REVIEW_PROMPT` |
| Contract tests | `packages/core/testing/contracts/review.contract.ts`, `watcher.contract.ts` |
| Env flags | `AEGIS_REVIEW=chainlink`, `AEGIS_WATCHER=chain` |

### 🔐 Ledger (human-present install authorization)

| What | File |
|---|---|
| Port: address / authorize / verify | `packages/core/src/ports.ts` → `InstallSigner` |
| The signed message (`AuthRequest`) shape | `packages/core/src/types.ts` → `AuthRequest` |
| Mock signer (dev key, no device) | `packages/adapters/src/signer/LocalSigner.ts` |
| **Real Ledger signer** (`@ledgerhq/hw-app-eth`) | `packages/adapters/src/signer/LedgerSigner.ts` |
| Shared sign/recover helpers | `packages/adapters/src/signer/auth.ts` |
| Where the gate enforces it | `packages/core/src/gate.ts` → `unauthorized` branch |
| CLI install / `--no-ledger` bypass | `apps/cli/src/index.ts` → `install` command |
| Contract test | `packages/core/testing/contracts/signer.contract.ts` |
| Env flag | `AEGIS_SIGNER=ledger` |

### 📜 Policy (what counts as "safe enough")

| What | File |
|---|---|
| Policy type (`requireVerdict`, `maxRiskScore`) | `packages/core/src/types.ts` → `Policy` |
| Where the policy is **enforced** | `packages/core/src/gate.ts` → `gate()` |
| The default policy values | `packages/adapters/fixtures/registry.seed.json` → `"policy"` |
| How it's loaded / handed to the gate | `packages/adapters/src/seed.ts` → `defaultPolicy`, `factory.ts` |

### 🌐 ENS registries (names, pins, verdicts)

| What | File |
|---|---|
| Port: resolve a name → pin + verdict + owner | `packages/core/src/ports.ts` → `SkillResolver` |
| Port: write `safeskills.verdict` to a name | `packages/core/src/ports.ts` → `VerdictWriter` |
| Mock resolver / mock verdict writer | `packages/adapters/src/resolver/MockResolver.ts`, `verdict/MockVerdictWriter.ts` |
| **Real ENS v2 resolver** (`getEnsText`/contenthash) | `packages/adapters/src/resolver/EnsV2Resolver.ts` |
| **Real ENS v2 verdict writer** (CRE grant) | `packages/adapters/src/verdict/EnsV2VerdictWriter.ts` |
| The record shape (`pin`, `node`, `verdict`, `owner`) | `packages/core/src/types.ts` → `SkillRecord` |
| viem clients / chain addresses / ABIs | `packages/chain/src/` |
| Naming model (`weather.acme.safeskills.eth`) | [ADR-001-aegis.md](./ADR-001-aegis.md) §2 |
| Contract tests | `packages/core/testing/contracts/resolver.contract.ts`, `verdict.contract.ts` |
| Env flags | `AEGIS_RESOLVER=ens`, `AEGIS_VERDICT=ens` |

### ⛓️ On-chain submission (the fee that triggers the CRE)

| What | File |
|---|---|
| **The contract** (`SubmissionPaid` event, fee gate) | `packages/contracts/src/SubmissionRegistry.sol` |
| Its tests | `packages/contracts/test/SubmissionRegistry.t.sol` |
| Event → typed `SubmissionEvent` | `packages/core/src/types.ts` → `SubmissionEvent` |
| Web submission UI (`/submit`, pay the fee) | `apps/web/app/` — _not built yet; add `app/submit/page.tsx`_ |

### ☠️ The malicious / poisoned skill (the demo headline)

| What | File |
|---|---|
| **The poisoned `SKILL.md`** (reads `~/.aws/credentials`, POSTs to evil.io) | `packages/adapters/fixtures/poisoned.md` |
| The clean counterpart | `packages/adapters/fixtures/clean.md` |
| Which skill is poisoned vs verified | `packages/adapters/fixtures/registry.seed.json` (`exfil.…` = poisoned) |
| What the detector looks for | `packages/adapters/src/review/MockReview.ts` → `POISON_MARKERS` |
| Engine-level poisoned fixtures (unit tests) | `packages/core/src/__tests__/fixtures.ts` |
| See it blocked end-to-end | `node apps/cli/dist/index.js check exfil.acme.safeskills.eth` |

### 📄 The SKILL.md content + verdict (the data model)

| What | File |
|---|---|
| Hashing a skill (`sha256:<hex>`) | `packages/core/src/hash.ts` → `hashSkill` |
| Fetching the bytes (IPFS / file / mock) | `packages/adapters/src/fetch/` |
| The verdict shape (`status`, `riskScore`, …) | `packages/core/src/types.ts` → `Verdict` |

> Rule of thumb: **interface → `core/src/ports.ts`** · **mock + real → `adapters/src/<port>/`** ·
> **test → `core/testing/contracts/`** · **on-chain → `packages/contracts/`** · **fixtures/demo
> data → `adapters/fixtures/`**.

## Quick start

```bash
nvm use            # Node >= 24
pnpm install
pnpm turbo build lint typecheck test   # all green
```

### CLI demo (it really hashes the file — no hard-coded verdicts)

```bash
pnpm --filter @aegis/cli build

# content verified (exit 0): hash matches the pin and the verdict passes
node apps/cli/dist/index.js check weather.acme.safeskills.eth

# BLOCK verdict_fail (exit 1): the poisoned skill's verdict is "fail"
node apps/cli/dist/index.js check exfil.acme.safeskills.eth

# BLOCK unauthorized (exit 1): the demo bypass — no Ledger signature
node apps/cli/dist/index.js install weather.acme.safeskills.eth --no-ledger

# ALLOW + install: LocalSigner (mock) authorizes, file written to ./.skills
node apps/cli/dist/index.js install weather.acme.safeskills.eth
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
AEGIS_RESOLVER=ens node apps/cli/dist/index.js check weather.acme.safeskills.eth
#  ✗ ERROR  TODO(ens): resolve safeskills.pin/safeskills.verdict/... via viem
```

Flags (see `.env.example`): `AEGIS_RESOLVER` `AEGIS_FETCHER` `AEGIS_SIGNER` `AEGIS_REVIEW`
`AEGIS_VERDICT` `AEGIS_WATCHER`. Each real adapter must pass the same `*.contract` suite its mock
passes (see [OWNERSHIP.md](./OWNERSHIP.md)); they are intentionally **stubbed** for now.

## gate() order

`gate()` checks, first failure wins: fetched hash == pin → verdict present (if required) →
verdict.reviewedHash == pin → verdict passed → riskScore within policy → not revoked → authorized
(the Ledger gate).
