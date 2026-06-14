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
| `~/.claude/skills/safeskills/config.json` | `safeskill onboard` (via installed gate) | `rm -rf ~/.claude/skills/safeskills` |
| `~/.claude/skills/<name>/SKILL.md` | `safeskill use … --claude` | `rm -rf ~/.claude/skills/<name>` |

The installed gate bakes `SAFESKILL_HOME=<skillDir>`, so onboarding state (signer +
policy) lives **inside the skill folder** — removing the skill un-onboards too, in one
atomic cleanup, and a fresh `init` starts un-onboarded. (Run the CLI standalone without
that env and config defaults to `~/.safeskill`.)

Nothing is installed globally (the gate runs via `node …/engine/cli.js`). The demo only
*reads* from Sepolia — it never sends a transaction, so there's no on-chain cleanup.

---

## 0. Setup (once, before going on stage)

```bash
# install the gate INTO Claude Code from the packed CLI — no global install, no repo.
# `init` copies a self-contained engine to ~/.claude/skills/safeskills/engine/ and
# writes the meta-skill SKILL.md pointing at it, so it survives npx's temp dir.
npx --yes --package=./packages/safeskill/aegis-safeskill-0.0.0.tgz safeskill init

# onboard — OPTIONAL: Claude can do this for you conversationally (see "Onboarding"
# below). To set it yourself instead, run the gate command `init` printed:
#   --local  : a software dev key signs overrides (no device; demo-friendly)
#   --ledger : auto-detected if a Ledger is connected (see "Hardware Ledger" below)
AEGIS_RPC_URL='https://ethereum-sepolia-rpc.publicnode.com' \
  node ~/.claude/skills/safeskills/engine/cli.js onboard --ens --min-security 70

# clean slate — make sure no demo skill is lingering from a previous run
rm -rf ~/.claude/skills/weather
```

> **Building the tarball.** `aegis-safeskill-0.0.0.tgz` comes from `pnpm pack` (or
> `npm pack`) in `packages/safeskill` after `pnpm turbo build --filter @aegis/safeskill`.
> The private `@aegis/*` (+ `@noble/*`, `commander`, `picocolors`, `viem`) are bundled
> into `dist`, so the tarball runs standalone — only the optional native `@ledgerhq/*` +
> `node-hid` transport (for `--ledger`) is left to install on the target.

> **Onboarding can be conversational.** After `init` + a session restart, just tell
> Claude *"set up Safe Skills"* — it runs `safeskill status`, asks your policy
> (auto-approve threshold, sign-vs-block, trusted/blocked publishers), and runs
> `onboard` for you (even authoring a custom `--policy` JSON from your description).
> The manual `onboard` above is only if you'd rather set it yourself.

> **Why `npx` works now.** `init` no longer depends on where it runs from: it copies
> a self-contained `engine/` next to the installed skill and bakes *that* stable path
> into the gate command, so an ephemeral `npx` temp dir is fine. Use the `--package=`
> form (`npx --yes --package=<tgz> safeskill init`) — a bare `npx <tgz> init` mis-parses
> the tarball path. To publish for a true `npx <name> init`, the package would need a
> public npm name (the `@aegis/*` source stays private — only the built bundle ships).

> **Two demo modes.** *Manual:* you tell Claude the exact `safeskill use …` command.
> *Natural (better):* after setup, you just say "install the weather skill" and Claude
> reaches for the gate itself via the `safeskills` meta-skill.

> **Hardware Ledger (real signature on a Flex/Stax/Nano).**
>
> **Critical:** the portable npx engine **cannot** talk to a Ledger — it has no native
> `node-hid`, and `node-hid` only loads under **Node 22** (not the default Node 25).
> So for a Ledger demo you must install a **dev gate** that points at the repo build
> (which has the transport in `node_modules`) and bakes the absolute Node 22 binary:
> ```bash
> nvm use 22
> node packages/safeskill/dist/cli.js init --dev   # bakes Node22 + repo build into the gate
> ```
> This gate runs under Node 22 regardless of the shell's default Node, so the device is
> reachable for both reading the address and signing.
>
> The device must be **connected, unlocked, with the Ethereum app open** at two moments:
> at `onboard` (silent — it reads the address, **no button, no signature**) and at the
> legitimate-skill install in Beat B (the device **clear-signs** the EIP-712 `AuthRequest`
> — you press **Approve**). **Onboarding never asks for a signature** — if you expected a
> prompt after choosing your policy, that's why; the signature comes at install time.
> A confirmed setup shows `signer ledger (0x…)` with your device's address. If it shows
> `(no address captured)`, the gate couldn't reach the device — you used the portable
> (non-`--dev`) gate, or the wrong Node, or the device was locked.
>
> Gotchas: (1) **restart the Claude session** after `init` so it loads the new gate;
> (2) disconnect mid-flow → `0x6985` (declined) — reconnect and press Approve; (3) run
> `use …` as a **single line**. To let Claude pick the signer, it asks *"Ledger or local?"*
> during conversational onboarding.

> The `safeskill` CLI does **not** auto-load `.env`, so always invoke it with
> `node --env-file=.env …` (or `export AEGIS_RPC_URL=…` first). Without the RPC
> URL the `--ens` resolve will fail.

---

## 1. The demo (inside a Claude Code session)

The gate reads everything **live from ENS (Sepolia)**. You just tell Claude to install
a skill by its ENS name; the `safeskills` meta-skill runs the gate. Three outcomes —
decided by the on-chain review, not the agent's say-so.

> **The policy (threshold-70):** a skill **auto-passes** if it has a **passing review
> from any provider with security ≥ 70** (an official `safeskills.verdict` OR a
> third-party `safeskills.attestation.*`). No passing review → **needs your approval**.
> A content-hash mismatch → **blocked**, always (a signature can't override it).

### Beat A — AUTO-PASS (no signature) ✅
Tell Claude:
> "Install `stitch-skill.acme.safeskills.eth`."

→ It has a passing attestation (`my-local-verifier.eth`, 80/100) → **AUTO-APPROVE** →
installed to `~/.claude/skills/stitch-skill/SKILL.md`. **No Ledger, no CONFIRM.** The
gate fetched the SKILL.md from the on-chain `contentUri` and the hash matched the pin.

### Beat B — NEEDS APPROVAL (sign) ✍️
Tell Claude:
> "Install `algorithmic-art.acme.safeskills.eth`."

→ Content + matching hash, but **no passing review** → **NEEDS OVERRIDE**. Claude asks
you to approve. With the **local** signer it re-runs with `--confirm CONFIRM` once you
say go; with a **Ledger** it prompts you to press **Approve** on-device. Then it installs.

### Beat C — BLOCKED (tampered) 🚫
Tell Claude:
> "Install `stitch-skill.acme.safeskills.eth` from this local file `<an-edited-SKILL.md>`."

Claude runs `use stitch-skill.acme.safeskills.eth --file <edited.md> --claude` → the
edited file's hash **doesn't match the on-chain pin** → **BLOCKED** by the integrity
floor. Nothing is written; a signature can't save it.

### Beat D — Claude actually uses it
Skills load at session start, so **start a new Claude Code session**, then:
> "Use the stitch skill on this design."

Claude discovers and runs the installed skill. The blocked/tampered one was never
written, so it doesn't exist to the agent.

---

## 2. Cleanup (after the demo)

```bash
rm -rf ~/.claude/skills/stitch-skill ~/.claude/skills/algorithmic-art  # installed demo skills
rm -rf ~/.claude/skills/safeskills  # remove the gate + onboarding (config.json lives here now)
rm -rf ~/.safeskill                 # only if you ran the CLI standalone (legacy config location)
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

### Content fetch + the no-contentUri skills

The gate is **ENS-only**: it reads each skill's on-chain **`contentUri`** (a plain
`https://…` URL — e.g. a raw GitHub link, no IPFS) via `HttpFetcher`, then re-hashes the
bytes against the pinned hash. Skills WITH a `contentUri` (stitch-skill, algorithmic-art,
geo-audit) gate end-to-end. Skills that pinned a **hash but no `contentUri`** (weather,
exfil, …) correctly report *"no contentUri"* — honest ENS state, not a bug. To gate one
of those before it's pinned, pass `--file <path>` explicitly. **The real fix is pinning a
`contentUri` on-chain.**


#### secret thoughts... (working runbook)

0. clean slate (removing the skill dir also removes onboarding — config.json lives there)
```
rm -rf ~/.claude/skills/safeskills ~/.claude/skills/stitch-skill ~/.claude/skills/algorithmic-art
```

1. build + install the gate. TWO flavors — pick by whether you want the Ledger:

   a. **Ledger demo (what we're doing)** — needs Node 22 + the repo (native node-hid).
      Do NOT use the portable npx form here; it installs a no-device gate.
   ```
   nvm use 22
   pnpm turbo build --filter @aegis/safeskill
   node packages/safeskill/dist/cli.js init --dev
   ```

   b. **Portable / "anyone can run" (software key only, no Ledger)**
   ```
   pnpm turbo build --filter @aegis/safeskill
   (cd packages/safeskill && pnpm pack)
   npx --yes --package=./packages/safeskill/aegis-safeskill-0.0.0.tgz safeskill init
   ```
   ⚠️ Running (b) after (a) OVERWRITES the Ledger gate with the portable one. For the
   Ledger demo, finish with (a).

2. install using Claude Code
```
claude
set up Safe Skills
```

3. set up policy + signer. Answer the policy questions; pick your signer:
   - **Local** (current default — no device): onboarding signs the policy silently;
     installs that need approval ask you to **type CONFIRM**.
   - **Ledger** (needs step 1a's `--dev` gate): the **device prompts — press Approve**
     to sign the policy; a verified `signer ledger (0x25e8…154bc)`, not a silent read.
     (If it says "no address captured", you're on the portable gate — redo step 1a.)

4. ✅ AUTO-PASS → "install `stitch-skill.acme.safeskills.eth`" → auto-approves (passing
   review 80 ≥ 70). **No signature.** Installs to `~/.claude/skills/stitch-skill/`.

5. ✍️ NEEDS APPROVAL → "install `algorithmic-art.acme.safeskills.eth`" → **needs-override**
   (no passing review). Approve: **type CONFIRM** (local signer) — Claude re-runs with
   `--confirm CONFIRM` — or **press Approve on the Ledger**. Then it installs.

6. 🚫 BLOCKED → "install `stitch-skill.acme.safeskills.eth` from `<an-edited-SKILL.md>`"
   → gate runs `use … --file <edited.md>` → hash ≠ on-chain pin → **BLOCKED** (integrity
   floor). A signature can't override it.

7. start a NEW Claude session → "use the stitch skill" → Claude runs the installed skill.

