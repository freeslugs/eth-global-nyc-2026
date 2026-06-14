# Safe Skills — live Claude Code demo runbook

**What the audience sees:** inside a Claude Code session, Claude tries to install
agent skills. A *tampered* skill is **blocked** by an on-chain (Sepolia ENS)
integrity check; a *legitimate* one requires a **signature**, then becomes a real
skill Claude can use. No skill is trusted on the agent's say-so.

The gate is `safeskill` (local CLI). It reads the skill's pinned hash from ENS,
re-hashes the candidate `SKILL.md`, and decides **auto-approve / needs-override /
blocked** — fail-closed (nothing is written unless it passes).

---

## What gets written where (so cleanup is exact)

| Path | Written by | Cleanup |
|---|---|---|
| `~/.safeskill/config.json` | `safeskill onboard` | `rm -rf ~/.safeskill` |
| `~/.claude/skills/<name>/SKILL.md` | `safeskill use … --claude` | `rm -rf ~/.claude/skills/<name>` |

Nothing is installed globally (we run via `node …/dist/cli.js`). The demo only
*reads* from Sepolia — it never sends a transaction, so there's no on-chain
cleanup.

---

## 0. Setup (once, before going on stage)

```bash
# build the CLI
pnpm turbo build --filter @aegis/safeskill

# onboard: read verdicts from real ENS (Sepolia), sign overrides with a local dev key,
# auto-approve passing skills at >= 70% security. (--env-file loads AEGIS_RPC_URL from .env)
node --env-file=.env packages/safeskill/dist/cli.js onboard --ens --local --min-security 70

# clean slate — make sure no demo skill is lingering from a previous run
rm -rf ~/.claude/skills/weather
```

> The `safeskill` CLI does **not** auto-load `.env`, so always invoke it with
> `node --env-file=.env …` (or `export AEGIS_RPC_URL=…` first). Without the RPC
> URL the `--ens` resolve will fail.

---

## 1. The demo (inside a Claude Code session, in this repo)

### Beat A — BLOCK (a tampered skill)
Tell Claude:
> "Install the weather skill from `packages/adapters/fixtures/poisoned.md`,
>  gating it against `weather.acme.safeskills.eth`."

Claude runs:
```bash
node --env-file=.env packages/safeskill/dist/cli.js use \
  weather.acme.safeskills.eth --file packages/adapters/fixtures/poisoned.md --claude
```
→ **BLOCKED** — the file's hash doesn't match the on-chain pin (integrity floor).
Nothing is written. A signature can't override it.

### Beat B — SIGN + install (the legitimate skill)
Tell Claude:
> "Now install the legitimate version from `packages/adapters/fixtures/clean.md`."

Claude runs:
```bash
node --env-file=.env packages/safeskill/dist/cli.js use \
  weather.acme.safeskills.eth --file packages/adapters/fixtures/clean.md --claude
```
→ hash matches the pin → **needs-override** → **local signature** authorizes it →
installed to `~/.claude/skills/weather/SKILL.md` (frontmatter intact).

### Beat C — Claude actually uses it
Skills load at session start, so **start a new Claude Code session**, then:
> "Use the weather skill for Tokyo."

Claude now discovers and runs `weather`. The poisoned version was never installed,
so it simply doesn't exist to the agent.

---

## Auto-approve (optional 3rd policy beat)

`weather` has an on-chain **attestation** (pass, 88) but no `safeskills.verdict`
record, so it currently lands on **needs-override**. To show a clean
**AUTO-APPROVE** (no signature needed):

- **Option 1 — no transaction:** derive the verdict from the existing attestation
  (ask Claude to wire it in `safeskill`/the resolver). Recommended.
- **Option 2 — one transaction:** set `safeskills.verdict` on `weather`.
  TODO: add a `scripts/set-verdict.ts` (mirrors `attest.ts`) and run it as the org owner.

---

## 2. Cleanup (after the demo)

```bash
rm -rf ~/.claude/skills/weather   # remove the installed demo skill
rm -rf ~/.safeskill               # un-onboard (signer + policy config)
rm -rf /tmp/demo-claude           # only if you used a temp --dir
```
Then restart Claude Code so it no longer lists the skill. Done — no global state,
no chain state changed.

---

## TODO (you, soon): pins/hashes for the demo skills

The gate compares `hashSkill(candidate SKILL.md)` against the `safeskills.pin`
text record on the skill's ENS name. So for each demo skill:

1. Compute the hash of the exact `SKILL.md` bytes:
   ```bash
   shasum -a 256 packages/adapters/fixtures/clean.md   # -> sha256:<hex>
   ```
2. Set it as `safeskills.pin` on the ENS name (via `scripts/ens-setup.ts`).
3. Keep the candidate file (the one passed with `--file`) **byte-identical** to
   what's pinned — any change moves the hash and the gate will (correctly) block it.

Current demo pins (Sepolia):
- `weather.acme.safeskills.eth` → `sha256:bab8fb6e…` = `clean.md`  ✅
- `exfil.acme.safeskills.eth`   → `sha256:d186df88…` = `poisoned.md`  ✅
- TODO: add the rest as you pin them.
