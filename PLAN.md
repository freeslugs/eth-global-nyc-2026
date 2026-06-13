> ⚠️ **SUPERSEDED.** This earlier plan is kept for history only. The canonical
> design is [ADR-001-aegis.md](./ADR-001-aegis.md) ("Safe Skills"), and the repo
> now follows the ADR's ports/`gate()` decomposition. See [OWNERSHIP.md](./OWNERSHIP.md)
> for the current module map and parallel-work lanes.

# Aegis Pivot Plan — Skills, ENS, Ledger, Chainlink CRE + AI Attestor

**Goal:** Reframe Aegis from "verify npm packages / MCP servers" to **"verify agent skills before they run"**, with every chain/hardware integration wired *for real* (no mocks) on Sepolia.

The existing ports/adapters design already anticipated all four integrations — each is a stub that throws `NotImplementedError`. This plan fills the stubs, deploys the contracts, and renames the domain.

---

## 0. The conceptual reframe (the load-bearing decision)

An **agent skill** is a directory: a `SKILL.md` (frontmatter: `name`, `description`, `allowed-tools`, …) + body instructions + optional bundled scripts/resources. It maps onto Aegis's existing two-surface model with zero structural change:

| Today (`Artifact`) | After (`Skill`) | Why it's the right surface |
| --- | --- | --- |
| `manifest` (MCP tool descriptors) | `SKILL.md` frontmatter + capability/tool descriptors | The **poisoning surface** — capability escalation & injected instructions hide here. Hashed separately so a descriptor change moves the hash without a new body. |
| `bundle` (package code) | skill body + bundled scripts | The instruction/exec surface. |

So the two-hash engine (`bundleHash` + `manifestHash`), `verify()`, attestations, and revocation logic all survive untouched. The pivot is **naming + filling adapter stubs + new policy/bypass flow**.

### Naming decisions (need your sign-off)
- `Artifact` type → **`Skill`**. (Touches `core`, `adapters`, `web`, `cli`, `gateway`.)
- Field `bundle` → **`body`** (or keep `bundle`). Recommend rename for demo clarity.
- Field `manifest` → keep **`manifest`** (apt for SKILL.md descriptor).
- ENS naming scheme: **`<skill>.skills.aegis.eth`** (subnames under a name we control) vs. one name per skill. See §2.

---

## 1. Phase A — Domain rename (packages → skills)

Pure mechanical + copy, no new chain work. Lowest risk, unblocks everything.

- `packages/core/src/types.ts`: `Artifact` → `Skill`, `ArtifactDigest` → `SkillDigest`, `ArtifactHash` stays (it's just `sha256:…`). Update comments ("MCP tool descriptors" → "SKILL.md descriptors").
- `packages/core/src/hash.ts`, `verify.ts`, `policy.ts`: rename references.
- `packages/adapters/fixtures/`: replace the 3 demo fixtures (`echo-tool`, `weather-tool`, `mailer-tool`) with 3 **skills** that tell the story:
  - `pdf-export.skills.aegis.eth` → **verified** (clean skill).
  - `repo-indexer.skills.aegis.eth` → **revoked** (CVE: reads `.env` and posts it).
  - `web-summarizer.skills.aegis.eth` → **poisoned** (manifest tampered: `allowed-tools` silently adds `Bash(curl …)` exfil). This is the headline demo.
  - Each fixture = `SKILL.md` + `scripts/` instead of `bundle.js` + `manifest.json`. Update `FileFetcher` to read those, or keep `bundle.js`/`manifest.json` filenames and just change content.
- `apps/web` copy sweep (see §6) + CLI/gateway strings.
- Tests + `registry.seed.json` hashes regenerated (`pnpm --filter @aegis/cli build` then re-hash fixtures).

**Deliverable:** green `turbo build lint typecheck test`, demo CLI verifies a *skill*.

---

## 2. Phase B — ENS resolver (real, Sepolia)

Fill `packages/adapters/src/resolver/EnsResolver.ts` (currently throws). Each skill gets a human-readable ENS name whose text records pin its hashes.

**Text records on the name:**
- `aegis.bundle` = `sha256:…` of body
- `aegis.manifest` = `sha256:…` of SKILL.md descriptor
- `aegis.publisher` = publisher address
- `aegis.policy` = policy ref/URI
- `aegis.log` = attestation log pointer (optional)

**Impl:** viem `getEnsText({ name, key })` against Sepolia via `packages/chain` clients. Resolve all five records, assemble `ResolvedRecord`.

**Infra decision (the real-ENS cost):** to give *each skill its own name* we need subname issuance. Options, cheapest-first for a hackathon:
1. **Own one Sepolia name** (`aegis.eth` on Sepolia) + **NameWrapper subnames** (`pdf-export.skills.aegis.eth`) with a custom resolver. Most "real", more setup.
2. **Offchain resolver (CCIP-Read, ENSIP-10):** one onchain name, subnames resolved from our gateway signing records. Scales to unlimited skills, less gas, still real ENS resolution. **Recommended** for a registry of many skills.
3. **Flat:** one text-record-bearing name per skill, registered manually. Fine for 3 demo skills, doesn't scale.

> Recommendation: option 2 (offchain/CCIP-Read) if we want the "registry of skills" story; option 1 if judges want pure on-chain. Decide before building.

**Web:** `apps/web/app/providers.tsx` / `lib/wagmi.ts` already wired to Sepolia — add ENS reads in the explorer + a real "resolve" call on the artifact-detail page (`a/[hash]`).

---

## 3. Phase C — On-chain attestation store + contract deploy

Fill `packages/adapters/src/store/OnchainStore.ts` and deploy.

- **Deploy** `AttestationRegistry.sol` + `Bonding.sol` to Sepolia (Foundry script — none exists yet; add `packages/contracts/script/Deploy.s.sol`).
- Write addresses into `packages/chain/src/addresses.ts` (currently zero-address placeholders for `11155111`).
- `OnchainStore`:
  - `getAttestations` → viem `getLogs` on `Attested` events + `getAttestations(subject)` view.
  - `isRevoked` → `revoked(subject)` view.
  - `postAttestation` / `postRevocation` → `writeContract` (via forwarder; for hackathon, forwarder=0x0 = open).
  - `setPin` → no-op (pins live in ENS, per the existing stub comment).
- Subject key: contract uses `bytes32`; today's hashes are `sha256:<hex>` strings. Add an encode helper (`bytes32(hex)` of the bundle hash) shared core-side.

**Deliverable:** explorer + CLI read attestations from Sepolia, not memory. `AEGIS_STORE=onchain` works end-to-end.

---

## 4. Phase D — Chainlink CRE + AI attestor (the trustless verdict)

Fill `packages/adapters/src/confidential/ChainlinkConfidential.ts`. This produces the **"AI says this skill is safe" attestation that nobody has to trust blindly.**

**Flow:**
1. `requestAnalysis(subject, analyzer, uri)` triggers a **Chainlink Functions / CRE** request on Sepolia.
2. CRE runs the **AI attestor** program (pinned by `analyzer` hash): fetches the skill by hash, prompts an LLM (Claude) to score it for injection / exfiltration / capability over-reach, returns `{ verdict, score, flags }`.
3. A consumer contract receives the DON-attested result and calls `AttestationRegistry.postAttestation(subject, kind=Confidential, attestor=DON, analyzer, payload)`.
4. `verify()` already enforces this: `Policy.trustedAnalyzers` must include the AI attestor's program hash, or it blocks `under_policy`. **No engine change needed.**

**Why trustless:** the analyzer program is content-addressed (`analyzer` hash), execution runs in Chainlink's DON/TEE, and the verdict is posted on-chain by consensus — so a malicious publisher can't forge a "safe" verdict, and users verify *which* program judged the skill.

**Build pieces:**
- `AegisFunctionsConsumer.sol` (new contract) — sends the request, receives `fulfillRequest`, posts attestation. Needs a Functions subscription on Sepolia.
- The attestor JS (runs inside Functions): fetch skill bytes, call LLM, return packed verdict. LLM key handled via Functions **secrets** (DON-hosted).
- `analyzer` hash = sha256 of the attestor program; seed it into the demo skill's policy as a trusted analyzer.

> Heaviest "real" piece. Realistic hackathon path = **Chainlink Functions on Sepolia** (CRE's accessible form). Flag if judges specifically want CRE workflows vs. Functions — wiring differs but the contract seam is the same.

---

## 5. Phase E — Ledger: user security policies + on-device bypass

Fill `packages/adapters/src/signer/LedgerSigner.ts` and add a **policy/bypass** concept on top of the existing trust `Policy`.

Two distinct policy layers — keep them separate:
- **Trust policy** (exists): `requireProvenance`, `minReviews`, `trustedAnalyzers`. Global, about *who vouched*.
- **User security policy** (new): per-user capability rules — which skill capabilities (network / filesystem / exec) the user permits. The policy doc is **signed by the user's Ledger**, so it's tamper-evident and portable.

**On-device bypass (the human-in-the-loop hardware moment):** when `verify()` BLOCKs (e.g. poisoned manifest, or a capability the policy forbids), the user can override *physically*:
1. Aegis builds a bypass grant: `{ skillHash, capability, reason, expiry }`.
2. Ledger displays skill name + hash + requested capability on its screen.
3. User physically approves → device returns a signature.
4. The signed grant is a short-lived **override attestation** the verifier accepts (and we log on-chain for audit). No silent bypass — every override is a hardware-signed, time-boxed, auditable event.

**Build pieces:**
- `LedgerSigner` via `@ledgerhq/hw-app-eth` + transport: `@ledgerhq/hw-transport-node-hid` (CLI) / `@ledgerhq/hw-transport-webhid` (web). Implement `address()` + `sign()`.
- `core`: add `SecurityPolicy` type + `BypassGrant` type + a `checkBypass()` that lets a valid, unexpired, correctly-signed grant override a specific BLOCK reason. Extend `verify()` (or wrap it) to consult grants — small, additive change.
- `web`: WebHID "Connect Ledger" button on `/verify`; show the on-device approve flow; render active grants.

> Needs a physical Ledger for the live demo. WebHID works in Chrome.

---

## 6. Phase F — Web reframe (copy + flows)

Sweep "package / npm / MCP / artifact" → "skill" across:
- `apps/web/app/page.tsx` (hero "Verify every package before it runs" → "Verify every skill…"; integrations strip npm/MCP → **Claude Skills / agent skills**).
- `threats/page.tsx` (already has "Anatomy of a skill hijack" — lean in).
- `how-it-works/page.tsx` (pipeline already shows **Artifact → Hash → Ledger sign → Chainlink CRE → ENS verified** — relabel Artifact→Skill; this page is already on-message).
- `verify/page.tsx` ("Upload an artifact" → "Verify a skill"; accept a `SKILL.md` + scripts).
- `a/[hash]/page.tsx` (artifact detail → skill detail; add ENS name, AI-attestor verdict card, Ledger bypass history).
- `api/verify` + `api/registry` response shapes: `artifacts` → `skills`.

---

## Recommended build order (de-risked)

1. **Phase A** (rename + new fixtures) — unblocks demo narrative, zero chain risk.
2. **Phase C** (deploy contracts + OnchainStore) — gets us a real chain footprint early.
3. **Phase B** (ENS) — depends on naming-scheme decision (§2).
4. **Phase D** (Chainlink + AI attestor) — heaviest; start its subscription/secrets setup in parallel.
5. **Phase E** (Ledger) — needs device; can demo last.
6. **Phase F** (web copy) — continuous, finish last.

## Open decisions I need from you
1. **ENS subname infra:** offchain/CCIP-Read (scales, recommended) vs. NameWrapper subnames (pure on-chain) vs. flat names (3-skill demo only)? (§2)
2. **Field rename `bundle` → `body`?** Cleaner demo vs. less churn. (§0)
3. **Chainlink: Functions vs. CRE workflows?** Same contract seam, different request wiring. (§4)
4. **LLM for the AI attestor:** Claude via Functions DON-hosted secret — confirm we run the model call inside Functions (vs. a hosted attestor service the DON calls). (§4)
5. **Demo skills:** the 3 I proposed (verified / revoked / poisoned-exfil) OK, or do you have specific skills to feature? (§1)
