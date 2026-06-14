# Ownership lanes — building Safe Skills in parallel

This repo is structured (per [ADR-001](./ADR-001-aegis.md)) so that **each feature
is an independent lane a different person can own**. The mechanism is ports &
adapters:

- Every external dependency (ENS read, ENS verdict write, the Chainlink review,
  the on-chain trigger, content fetch, Ledger signing) is a **port** — a typed
  interface in `@aegis/core`.
- Every port has a **mock** (the default) and a **real** adapter, and ONE shared
  **contract test** in `@aegis/core/testing` that both must pass.
- **Adapters import only `@aegis/core` — never each other.** That is what makes
  the lanes independent: you can build, mock, and test your module in total
  isolation with `pnpm --filter @aegis/adapters test`.

With no env vars set, the whole system runs on mocks — both flows demo and every
test passes before a single real integration exists (the fallback demo).

## The lanes

| Lane | Port | Module / app | Real-adapter job | Contract test |
|---|---|---|---|---|
| **ENS** | `SkillResolver` + `VerdictWriter` | `adapters/src/resolver/`, `adapters/src/verdict/` | read `safeskills.pin`/`safeskills.verdict`; write verdict via CRE grant | `resolver.contract`, `verdict.contract` |
| **Fetch** | `SkillFetcher` | `adapters/src/fetch/` | GET SKILL.md from IPFS/URL | `fetcher.contract` |
| **Ledger** | `InstallSigner` | `adapters/src/signer/` | clear-sign the AuthRequest on device | `signer.contract` |
| **Chainlink review** | `ReviewClient` | `adapters/src/review/` | call Confidential AI (LLM in TEE) | `review.contract` |
| **Chainlink trigger** | `SubmissionWatcher` | `adapters/src/watcher/` | viem `watchEvent` on `SubmissionPaid` | `watcher.contract` |
| **CRE orchestration** | — | `apps/cre-workflow/` | wrap `reviewSubmission()` in the CRE SDK | `workflow.test` |
| **Contracts** | — | `packages/contracts/` | deploy `SubmissionRegistry` to Sepolia | `forge test` |
| **Engine** | all ports + `gate()` | `packages/core/` | (pure; no I/O) | `gate.test`, `hash.test` |
| **Web** | consumes adapters | `apps/web/` | explorer + `/verify` + `/submit` | — |
| **CLI** | standalone gate | `packages/safeskill/` | `check` / `use` / Ledger override | `safeskill.test` |

> The CRE workflow and the CLI/web are **orchestrators, not integrations** — they
> only compose ports. All I/O lives in adapters, so "get a score" (`ReviewClient`)
> is built and tested completely separately from "put it on chain"
> (`VerdictWriter`).

## How to work on your lane

1. Pick your module folder above. Everything else stays mocked.
2. Run only your module's tests: `pnpm --filter @aegis/adapters test`
   (the contract suite for your port already specifies exactly what to build).
3. Implement the real adapter so it passes the **same** `*.contract` suite the
   mock passes — add a `Real*.test.ts` next to the mock's test that runs that
   suite against your adapter.
4. Flip your one env flag (see `.env.example`) to bring your real adapter up in
   isolation, leaving every other lane on its mock.

## Hosting (single Vercel app)

There is exactly **one hosted web app**: `apps/web` (Next.js → Vercel). Its API
lives entirely in route handlers (`apps/web/app/api/*`) — there is no separate
standalone API service. `apps/cre-workflow` is a Chainlink CRE workflow
(deployed to the DON) / a local runner, and `packages/safeskill` runs on the user's
machine (the Ledger needs a device) — neither is hosted alongside the web app.

## Source of truth

[ADR-001-aegis.md](./ADR-001-aegis.md) is canonical. `PLAN.md` (the earlier
"Aegis pivot") is **superseded** and kept only for history.
