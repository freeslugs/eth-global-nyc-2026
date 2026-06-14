# @aegis/safeskill

The SDK + CLI an agent runs to **gate a skill against the ENS registry before loading it.**
Two parts:

1. **Onboard** — hook up a signer (Ledger optional) and set the auto-approve policy.
2. **Fetch & gate** — list registry skills, and for each one resolve its ENS verdict,
   re-hash the file locally, and decide: **auto-approve / needs-override / blocked**.

It wraps `@aegis/core`'s pure `gate()` and the `@aegis/adapters` ports — defaulting to a
self-contained **demo registry** so the whole thing runs with zero chain config.

## Policy model

The policy is **not hardcoded** — it's a serializable ruleset every user owns and customizes.
The engine derives policy-independent facts about a skill (a `SkillAssessment`: security rating,
verdict status, has-verdict, hash-matches, revoked, publisher) and the policy maps those facts to
one of three decisions. The user thinks in **security rating** (0–100, higher = safer) — the
inverse of the engine's `riskScore`, so `securityRating = 100 - riskScore`.

A `SafeskillPolicy` is an **ordered ruleset + default**:

```jsonc
{
  "name": "threshold-70",
  "rules": [
    { "revoked": true, "action": "blocked", "label": "revoked by owner" },
    { "hasVerdict": false, "action": "needs-override" },
    { "minSecurityRating": 70, "verdictStatus": "pass", "action": "auto-approve" }
  ],
  "default": "needs-override"
}
```

Each rule's predicates are ANDed; rules are tried top-to-bottom, **first match wins**; if none
match, the `default` applies. Predicates: `minSecurityRating` / `maxSecurityRating`,
`verdictStatus`, `hasVerdict`, `revoked`, `publisherIn` / `publisherNotIn`.

The three decisions:

| Decision | Meaning |
|---|---|
| **auto-approve** | install with no human in the loop |
| **needs-override** | installable **only** with a verified Ledger signature — the "bypass override" |
| **blocked** | never installable; a signature cannot save it |

**Integrity floor.** One thing is *not* a policy choice: if the locally re-hashed file doesn't match
the pinned/reviewed hash (tampering), the skill is **always blocked**, before any rule runs. A
reckless `{ "rules": [{ "action": "auto-approve" }] }` still cannot approve tampered bytes.
Everything else — including revocation and failing verdicts — is governed by your rules.

### Setting your own policy

```bash
safeskill onboard --preset strict          # built-in: default | strict | permissive
safeskill onboard --min-security 80        # convenience: builds a threshold policy
safeskill onboard --policy ./my-policy.json  # a hand-authored ruleset
safeskill policy                           # print the active policy
safeskill policy --presets                 # show all built-in presets
```

Via the SDK: `Safeskill.onboard({ policy })`, `{ preset: "strict" }`, or `{ minSecurityRating: 80 }`.

### Fail-closed guarantee

`use()` installs a skill **only** on an explicit `auto-approve`, or a `needs-override` whose
signature *verifies*. A blocked skill, a missing signer, a declined signature on the device, a
transport error, or a signature that fails verification all result in **no write to disk** — the
skill is never fetched-to-install. (Covered by the `FAIL-CLOSED` tests in `safeskill.test.ts`.)

## CLI

```bash
pnpm --filter @aegis/safeskill build

# 1) onboard: local dev signer, auto-approve at ≥ 70% security (use --ledger for a real device)
node packages/safeskill/dist/cli.js onboard --local --min-security 70

# 2) the on-chain registry + what the policy decides for each
node packages/safeskill/dist/cli.js list

# resolve one skill against ENS, re-hash, report (no install)
node packages/safeskill/dist/cli.js check weather.acme.safeskills.eth

# install per policy: auto-approve, or require a Ledger override
node packages/safeskill/dist/cli.js use weather.acme.safeskills.eth     # auto-approved
node packages/safeskill/dist/cli.js use pdf-tools.acme.safeskills.eth   # below policy → override
node packages/safeskill/dist/cli.js use tampered.acme.safeskills.eth    # BLOCKED
```

`--ens` (onboard) swaps the demo registry for the real ENS v2 resolver on Sepolia.

## SDK

```ts
import { Safeskill } from "@aegis/safeskill";

// part 1 — onboarding (writes ~/.safeskill/config.json)
await Safeskill.onboard({ signer: "ledger", minSecurityRating: 70 }); // or { preset } / { policy }

// part 2 — the agent gates a skill before loading it
const ss = await Safeskill.load();
const decision = await ss.check("weather.acme.safeskills.eth");
if (decision.decision === "blocked") throw new Error(decision.explanation);

const result = await ss.use("weather.acme.safeskills.eth"); // auto-installs or asks the Ledger
```
