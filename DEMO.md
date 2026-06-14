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

# install the gate INTO Claude Code (writes ~/.claude/skills/safeskills/SKILL.md).
# This is the meta-skill that makes Claude gate skills AND walk you through your
# security policy on first use.
node packages/safeskill/dist/cli.js init

# onboard — OPTIONAL: Claude can do this for you conversationally (see "Onboarding"
# below). To set it yourself instead:
#   --local  : a software dev key signs overrides (no device; demo-friendly)
#   --ledger : a hardware Ledger clear-signs every override (see "Hardware Ledger" below)
node packages/safeskill/dist/cli.js onboard --ens --local --min-security 70

# clean slate — make sure no demo skill is lingering from a previous run
rm -rf ~/.claude/skills/weather
```

> **Onboarding can be conversational.** After `init` + a session restart, just tell
> Claude *"set up Safe Skills"* — it runs `safeskill status`, asks your policy
> (auto-approve threshold, sign-vs-block, trusted/blocked publishers), and runs
> `onboard` for you (even authoring a custom `--policy` JSON from your description).
> The manual `onboard` above is only if you'd rather set it yourself.

> **`npx` flavor (optional).** `npm pack` in `packages/safeskill` produces a
> self-contained `aegis-safeskill-0.0.0.tgz`; then `npx ./aegis-safeskill-0.0.0.tgz init`
> works with no global install. The `@aegis/*` + `@noble/*` code is bundled in; npm
> pulls the real deps (`commander`/`picocolors`/`viem`, plus the `@ledgerhq/*` +
> `node-hid`/`usb` transport for `--ledger`, which need native build tools). Run `init`
> from a **persistent** install (the repo build), not an ephemeral npx temp dir, so the
> gate path the meta-skill writes stays valid.

> **Two demo modes.** *Manual:* you tell Claude the exact `safeskill use …` command.
> *Natural (better):* after setup, you just say "install the weather skill" and Claude
> reaches for the gate itself via the `safeskills` meta-skill.

> **Hardware Ledger (real signature on a Flex/Stax/Nano).** Onboard with `--ledger`
> instead of `--local`. The device must be **connected, unlocked, with the Ethereum
> app open** at two moments: at `onboard` (silent — it reads the address, no button)
> and at the legitimate-skill install in Beat B (the device **clear-signs** the
> EIP-712 `AuthRequest` — you press **Approve** on the device). A confirmed setup shows
> `signer ledger (0x…)` with your device's address, not the `0xf39f…2266` local key.
> Gotchas we hit: (1) **restart the Claude session** after `init` so it loads the new
> meta-skill — otherwise the agent re-onboards with the old `--local` default; (2) if
> the device is disconnected mid-flow you get `0x6985` (declined) — reconnect and press
> Approve; (3) run `use …` as a **single line** (a trailing `\` or `sudo` breaks the
> argument / file read). To let Claude pick the signer for you, it now asks
> *"Ledger or local?"* during conversational onboarding.

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
rm -rf ~/.claude/skills/weather     # remove the installed demo skill
rm -rf ~/.claude/skills/safeskills  # remove the gate meta-skill (from `init`)
rm -rf ~/.safeskill                 # un-onboard (signer + policy config)
rm -rf /tmp/demo-claude             # only if you used a temp --dir
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

### TODO(contenturi): temporary content fallback

The ENS records pin a **hash** but not yet a **content location** (no IPFS /
contenthash), so the gate has no bytes to re-hash unless you pass `--file`. As a
**temporary** unblock, the gate reads `$AEGIS_CONTENT_DIR/<label>.md` when a record
has no `contentUri` and no `--file` is given. `init` bakes
`AEGIS_CONTENT_DIR=packages/safeskill/demo-content` into the gate command, so
`check`/`use` work without `--file` (e.g. `check weather…` → `demo-content/weather.md`).
The integrity check is still real — those files are byte-identical to the pinned
fixtures. **Remove this fallback once publishers pin a real `contentUri`/IPFS hash**
(search `TODO(contenturi)` in `packages/safeskill/src`).
