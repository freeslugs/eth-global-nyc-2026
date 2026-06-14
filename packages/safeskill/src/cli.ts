import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir, writeFile, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import pc from "picocolors";
import { Safeskill, probeLedger, CONFIRM_TOKEN } from "./client";
import { loadConfig, loadPolicyFile } from "./config";
import { PRESETS } from "./policy";
import type { Decision, SafeskillPolicy, SignerKind, SkillDecision } from "./types";

const program = new Command();

/**
 * Pick a hardware/local signer by probing for a Ledger. In an interactive
 * terminal, if none is found we ask the user to plug in + unlock the device and
 * retry, looping until a Ledger appears or they skip to the local dev key.
 * When stdin isn't a TTY (e.g. the agent runs onboarding for the user), we can't
 * block on input, so we fall back to local immediately and let the caller retry.
 */
async function detectSignerWithRetry(): Promise<SignerKind> {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  for (;;) {
    console.log(pc.dim("  · looking for a connected Ledger…"));
    const addr = await probeLedger();
    if (addr) {
      console.log(pc.green(`  · Ledger detected (${addr}) — using it`));
      return "ledger";
    }
    if (!interactive) {
      console.log(pc.yellow("  · no Ledger found — falling back to local dev key"));
      return "local";
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = (
      await rl.question(
        pc.yellow(
          "  · no Ledger found. Connect + unlock it (Ethereum app open), then press Enter to retry — or type 's' to use the local dev key: ",
        ),
      )
    )
      .trim()
      .toLowerCase();
    rl.close();
    if (ans === "s" || ans === "skip") {
      console.log(pc.yellow("  · skipping — using local dev key"));
      return "local";
    }
  }
}

program
  .name("safeskill")
  .description("safeskill — onboard a policy/Ledger, then gate every skill against the ENS registry before loading it.")
  .version("0.0.0");

// ── formatting helpers ────────────────────────────────────────────────────────

function badge(decision: Decision): string {
  switch (decision) {
    case "auto-approve":
      return pc.bold(pc.green("AUTO-APPROVE"));
    case "needs-override":
      return pc.bold(pc.yellow("NEEDS OVERRIDE"));
    case "blocked":
      return pc.bold(pc.red("BLOCKED"));
  }
}

function rating(d: SkillDecision): string {
  return d.securityRating === undefined ? pc.dim("—  ") : `${String(d.securityRating).padStart(3)}%`;
}

function printDecision(d: SkillDecision): void {
  console.log(pc.dim(`  name      ${d.record.name}`));
  console.log(pc.dim(`  pin       ${d.record.pin}`));
  console.log(pc.dim(`  fetched   ${d.fetchedHash}`));
  if (d.record.verdict) {
    console.log(pc.dim(`  verdict   ${d.record.verdict.status} · risk ${d.record.verdict.riskScore} · security ${d.securityRating}%`));
  } else {
    console.log(pc.dim("  verdict   (none on the ENS name)"));
  }
  console.log(`\n  ${badge(d.decision)}  ${pc.dim(d.explanation)}`);
}

function printPolicy(p: SafeskillPolicy): void {
  console.log(pc.bold(`  policy: ${p.name}`));
  p.rules.forEach((r, i) => {
    const cond: string[] = [];
    if (r.minSecurityRating !== undefined) cond.push(`security ≥ ${r.minSecurityRating}`);
    if (r.maxSecurityRating !== undefined) cond.push(`security ≤ ${r.maxSecurityRating}`);
    if (r.verdictStatus) cond.push(`verdict=${r.verdictStatus}`);
    if (r.hasVerdict !== undefined) cond.push(r.hasVerdict ? "has verdict" : "no verdict");
    if (r.revoked !== undefined) cond.push(`revoked=${r.revoked}`);
    if (r.publisherIn) cond.push(`publisher∈{${r.publisherIn.join(",")}}`);
    if (r.publisherNotIn) cond.push(`publisher∉{${r.publisherNotIn.join(",")}}`);
    console.log(`    ${String(i + 1).padStart(2)}. when ${pc.cyan(cond.length ? cond.join(" · ") : "always")} → ${badge(r.action)}` + (r.label ? pc.dim(`  (${r.label})`) : ""));
  });
  console.log(`    default → ${badge(p.default)}`);
  console.log(pc.dim("    (integrity floor: content-hash mismatch is always BLOCKED, before any rule)"));
}

// ── Part 1: onboarding ──────────────────────────────────────────────────────

program
  .command("onboard")
  .description("Hook up a signer (Ledger optional) and set a customizable policy.")
  .option("--ledger", "force a real Ledger device (fail if none captured)")
  .option("--local", "force a local dev key (demo, no device)")
  .option("--no-signer", "don't hook up any signer (overrides become impossible)")
  .option("--preset <name>", `use a named policy preset (${Object.keys(PRESETS).join(", ")})`)
  .option("--policy <file>", "load a custom policy from a JSON file")
  .option("-m, --min-security <n>", "convenience: auto-approve passing skills ≥ this security rating (0-100)")
  .option("--no-require-verdict", "with --min-security: allow skills with no verdict")
  .option("--ens", "read verdicts from real ENS (Sepolia) instead of the demo registry")
  .action(
    async (opts: {
      ledger?: boolean;
      local?: boolean;
      signer?: boolean;
      preset?: string;
      policy?: string;
      minSecurity?: string;
      requireVerdict: boolean;
      ens?: boolean;
    }) => {
      // Signer selection: explicit flags win; with neither, probe for a
      // connected Ledger and fall back to the local dev key only if none is found.
      let signer: SignerKind;
      if (opts.signer === false) {
        signer = "none";
      } else if (opts.ledger) {
        signer = "ledger";
      } else if (opts.local) {
        signer = "local";
      } else {
        signer = await detectSignerWithRetry();
      }

      // Build the policy override (precedence handled by Safeskill.onboard).
      let policy: SafeskillPolicy | undefined;
      let minSecurityRating: number | undefined;
      if (opts.policy) {
        try {
          policy = await loadPolicyFile(opts.policy);
        } catch (err) {
          console.error(pc.red(`  ✗ could not load policy: ${(err as Error).message}`));
          process.exit(1);
        }
      } else if (opts.minSecurity !== undefined) {
        minSecurityRating = Number(opts.minSecurity);
        if (!Number.isFinite(minSecurityRating) || minSecurityRating < 0 || minSecurityRating > 100) {
          console.error(pc.red(`  ✗ --min-security must be 0–100 (got ${opts.minSecurity})`));
          process.exit(1);
        }
      }

      if (signer === "ledger") {
        console.log(pc.cyan("  → check your Ledger: review the policy and press Approve to sign…"));
      }
      let ss: Safeskill;
      try {
        ss = await Safeskill.onboard({
          signer,
          resolver: opts.ens ? "ens" : "demo",
          policy,
          preset: opts.preset,
          minSecurityRating,
          requireVerdict: opts.requireVerdict,
        });
      } catch (err) {
        console.error(pc.red(`  ✗ ${(err as Error).message}`));
        process.exit(1);
      }

      const c = ss.config;
      console.log(pc.bold(pc.green("\n  ✓ onboarded")));
      console.log(pc.dim(`  signer     ${c.signer}${c.signerAddress ? ` (${c.signerAddress})` : ""}`));
      if (c.signer === "ledger" && !c.signerAddress) {
        console.log(pc.yellow("             (no address captured — connect the device before installing)"));
      }
      console.log(pc.dim(`  registry   ${c.resolver === "ens" ? "ENS (Sepolia)" : "demo (hardcoded)"}`));
      console.log("");
      printPolicy(c.policy);
    },
  );

program
  .command("status")
  .description("Show the current onboarding config (signer + policy).")
  .action(async () => {
    const c = await loadConfig();
    if (!c) {
      console.log(pc.yellow("  not onboarded — run `safeskill onboard`"));
      process.exit(0);
    }
    console.log(JSON.stringify(c, null, 2));
  });

program
  .command("policy")
  .description("Show the active policy, or list the available presets with --presets.")
  .option("--presets", "list the built-in presets instead of the active policy")
  .action(async (opts: { presets?: boolean }) => {
    if (opts.presets) {
      for (const [name, p] of Object.entries(PRESETS)) {
        console.log("");
        printPolicy({ ...p, name });
      }
      console.log("");
      return;
    }
    const c = await loadConfig();
    if (!c) {
      console.log(pc.yellow("  not onboarded — run `safeskill onboard`"));
      process.exit(0);
    }
    console.log("");
    printPolicy(c.policy);
    console.log("");
  });

// ── Part 2: skill fetching + gating ───────────────────────────────────────────

program
  .command("list")
  .description("List the skills in the on-chain registry and what the policy would decide for each.")
  .action(async () => {
    const ss = await loadOrExit();
    const skills = await ss.listSkills();
    const src = ss.config.resolver === "ens" ? "on-chain (ENS)" : "demo";
    console.log(pc.bold(`\n  ${skills.length} skills in the registry`) + pc.dim(`  (${src}, policy: ${ss.config.policy.name})\n`));
    if (skills.length === 0 && ss.config.resolver === "ens") {
      console.log(pc.dim("  (none discovered on-chain — check the RPC / registry deployment)\n"));
    }
    for (const s of skills) {
      let d: SkillDecision;
      try {
        d = await ss.check(s.name);
      } catch (err) {
        console.log(`  ${pc.red("ERROR".padEnd(14))}  ${pc.dim("—  ")}  ${s.name} ${pc.dim(`(${(err as Error).message})`)}`);
        continue;
      }
      const desc = d.record.metadata?.description || s.description;
      console.log(`  ${badge(d.decision).padEnd(24)}  ${rating(d)}  ${s.name}`);
      if (desc) console.log(pc.dim(`  ${" ".repeat(14)}        ${desc}`));
    }
    console.log("");
  });

program
  .command("check")
  .description("Resolve a skill against ENS, re-hash it, and report the decision (no install).")
  .argument("<name>", "skill name (e.g. weather.acme.safeskills.eth)")
  .option("-f, --file <path>", "re-hash this local SKILL.md against the ENS pin (required in --ens mode)")
  .action(async (name: string, opts: { file?: string }) => {
    const ss = await loadOrExit();
    try {
      const d = await ss.check(name, { file: opts.file });
      printDecision(d);
      process.exit(d.decision === "blocked" ? 1 : 0);
    } catch (err) {
      console.error(pc.red(`\n  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program
  .command("use")
  .description("Check a skill, then install it — auto-approving or requiring a Ledger override per policy.")
  .argument("<name>", "skill name")
  .option("-d, --dir <dir>", "install dir", ".skills")
  .option("-f, --file <path>", "re-hash this local SKILL.md against the ENS pin (required in --ens mode)")
  .option("--claude", "install into ~/.claude/skills/<name>/SKILL.md so Claude Code discovers it")
  .option("--no-override", "reject (don't even offer the override) for below-policy skills")
  .option("--confirm <word>", `type ${CONFIRM_TOKEN} to authorize a local-signer override (a Ledger prompts on-device instead)`)
  .action(async (name: string, opts: { dir: string; file?: string; claude?: boolean; override: boolean; confirm?: string }) => {
    const ss = await loadOrExit();
    try {
      const d = await ss.check(name, { file: opts.file });
      printDecision(d);

      if (d.decision === "needs-override" && opts.override && ss.config.signer !== "none") {
        const how = ss.config.signer === "ledger" ? "approve on the Ledger" : `confirm with --confirm ${CONFIRM_TOKEN}`;
        console.log(pc.yellow(`\n  ⚠ below policy — needs override (${how})…`));
      }

      // In --claude mode, default the install dir to the user's Claude Code skills folder.
      const dir = opts.claude && opts.dir === ".skills" ? join(homedir(), ".claude", "skills") : opts.dir;
      const result = await ss.use(name, { dir, file: opts.file, claude: opts.claude, allowOverride: opts.override, confirm: opts.confirm });
      if (result.installed) {
        const how = result.overridden ? pc.yellow(`(${ss.config.signer} override)`) : pc.green("(auto-approved)");
        console.log(pc.green(`\n  ✓ installed → ${result.path} `) + how);
        process.exit(0);
      } else {
        // FAIL-CLOSED: nothing was written to disk.
        console.log(pc.red(`\n  ✗ NOT installed — ${result.error ?? "rejected by policy"}`));
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red(`\n  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── bootstrap: install the gate into Claude Code ──────────────────────────────

/** The `safeskills` meta-skill SKILL.md — teaches the agent to onboard + gate. */
function metaSkill(gate: string): string {
  return `---
name: safeskills
description: Gate any agent skill against the Aegis ENS registry before installing it into Claude Code, and walk the user through their security policy on first run. Use whenever the user asks to install/add/load a skill, or to set up or change Safe Skills.
---

# Safe Skills — verify before you install

You are the install gate for agent skills. NEVER hand-write a SKILL.md into
\`~/.claude/skills/\` directly. The \`safeskill\` CLI resolves a skill's pinned hash
from the on-chain (ENS) registry, re-hashes the candidate file, and decides
**auto-approve / needs-override (a signature) / blocked**, per the user's policy.

Gate command: \`${gate}\`

## Step 1 — make sure the user is set up (run this before gating)

Run \`${gate} status\`. If it reports the user has NOT onboarded, set them up
**conversationally** — ask, don't guess — then run \`onboard\`:

1. "Authorize overrides with a hardware **Ledger**, or a **local** dev key?"
   → \`--ledger\` (the device clear-signs every override) or \`--local\` (a burner
   key signs in software; demo only, no device). Use the choice as \`<signer>\`
   below. If the user picked Ledger, tell them to connect + unlock the device and
   open the Ethereum app BEFORE onboarding (so it can read the address).
2. "What security score (0–100, higher = safer) should let a skill install with no
   questions asked?" → \`--min-security <N>\` (a sensible default is 70).
3. "For reviewed skills below that line — require your signature, or block them?"
   (sign ⇒ they stay \`needs-override\`; block ⇒ add a stricter rule).
4. "Any publishers to ALWAYS trust or ALWAYS block?" (e.g. \`acme.safeskills.eth\`).

Then onboard with the answer that fits (\`<signer>\` = \`--ledger\` or \`--local\`):
- Simple threshold → \`${gate} onboard --ens <signer> --min-security <N>\`
- A named preset → \`${gate} onboard --ens <signer> --preset strict|default|permissive\`
- Custom rules (trusted/blocked publishers, etc.) → write a policy JSON (schema
  below) to a file, then \`${gate} onboard --ens <signer> --policy <file>\`.

Confirm with \`${gate} policy\` and show the user their active rules. If they chose
Ledger, remind them the device must be connected with the Ethereum app open again
at install time, so it can clear-sign the override.

### Policy schema (for \`--policy <file>\`)
An ordered ruleset: rules are tried top-to-bottom, **first match wins**; if none
match, \`default\` applies. Each rule ANDs its predicates.
\`\`\`jsonc
{
  "name": "my-policy",
  "rules": [
    { "revoked": true, "action": "blocked" },
    { "publisherNotIn": ["acme.safeskills.eth"], "action": "needs-override" },
    { "minSecurityRating": 80, "verdictStatus": "pass", "action": "auto-approve" }
  ],
  "default": "needs-override"
}
\`\`\`
Predicates: \`minSecurityRating\`/\`maxSecurityRating\`, \`verdictStatus\` ("pass"|"fail"),
\`hasVerdict\`, \`revoked\`, \`publisherIn\`/\`publisherNotIn\`. Actions: \`auto-approve\`,
\`needs-override\`, \`blocked\`. **Integrity floor:** a content-hash mismatch (tampering)
is ALWAYS blocked, before any rule — no policy can approve tampered bytes.

## Step 2 — gate every install

When the user asks to install/add/load a skill, identify its **ENS name** and the
path to the **candidate SKILL.md**, then run:
\`\`\`
${gate} use <ens-name> --file <path-to-SKILL.md> --claude
\`\`\`
Report the result to the user verbatim:
- **installed** (auto-approved, or a signed override) → available after a new
  Claude Code session discovers it.
- **BLOCKED** → do NOT install. The hash didn't match the on-chain pin (possible
  tampering) — a signature cannot override this.
- **needs-override** → the skill is below policy and needs the user's approval:
  - With a **ledger** signer: re-run the same command; the device prompts — the user
    presses **Approve** on-device.
  - With a **local** signer: ask the user to approve, and only if they agree, re-run
    with \`--confirm ${CONFIRM_TOKEN}\` appended. Do NOT add \`--confirm\` on your own
    initiative — it represents the user's explicit go-ahead.

Never bypass the gate or hand-write a skill file. If the gate command is missing
or errors, tell the user instead of falling back.
`;
}

async function loadOrExit(): Promise<Safeskill> {
  try {
    return await Safeskill.load();
  } catch {
    console.error(pc.red("  ✗ not onboarded — run `safeskill onboard` first"));
    process.exit(1);
  }
}

program
  .command("init")
  .description("Install the 'safeskills' meta-skill into Claude Code so the agent gates skills before installing them.")
  .option("-d, --dir <dir>", "skills directory to install into", join(homedir(), ".claude", "skills"))
  .option("--print", "print the SKILL.md to stdout instead of writing it")
  .option(
    "--dev",
    "bake a gate that runs THIS cli + the current Node binary directly (needs the repo " +
      "node_modules). Required for --ledger: the portable engine has no native node-hid. " +
      "Run under the Node that can load node-hid (e.g. `nvm use 22`).",
  )
  .action(async (opts: { dir: string; print?: boolean; dev?: boolean }) => {
    const skillDir = join(opts.dir, "safeskills");
    const srcCli = fileURLToPath(import.meta.url);
    const engineSrc = dirname(srcCli);
    const engineDir = join(skillDir, "engine");

    // Two gate flavors:
    // - portable (default): copy the self-contained `dist/` as `engine/` beside the
    //   skill and invoke it with a plain `node`. Survives npx's temp dir; --local only,
    //   since the engine has no native node-hid for a Ledger.
    // - dev (--dev): point the gate at THIS running cli (the repo build, which has the
    //   @ledgerhq/* + node-hid transport in node_modules) and bake the ABSOLUTE current
    //   Node binary, so a Ledger signs regardless of the shell's default Node version.
    const cliPath = opts.dev ? srcCli : join(engineDir, "cli.js");
    const nodeBin = opts.dev ? process.execPath : "node";

    // Public, keyless Sepolia RPC baked in so the gate resolves ENS with zero env
    // setup in any session. Safe to hardcode — it's a public read endpoint, no API
    // key. (Don't ever bake a keyed RPC like Alchemy/Infura here.) Skill content is
    // pulled from each skill's on-chain `contentUri` (ENS → IPFS) — no local dir.
    const rpc = process.env.AEGIS_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
    // Co-locate onboarding state with the skill: config.json lands beside SKILL.md
    // (SAFESKILL_HOME = the skill dir), so `rm -rf <skillDir>` is a complete uninstall
    // and a fresh install starts un-onboarded. Standalone CLI use keeps ~/.safeskill.
    const gate = `AEGIS_RPC_URL='${rpc}' SAFESKILL_HOME='${skillDir}' '${nodeBin}' '${cliPath}'`;
    const content = metaSkill(gate);

    if (opts.print) {
      console.log(content);
      return;
    }

    await mkdir(skillDir, { recursive: true });
    // Portable mode: persist the engine beside the skill (skip the copy in --dev, where
    // the gate points back at the repo build, or if init was run from the copy itself).
    if (!opts.dev && srcCli !== cliPath) {
      await cp(engineSrc, engineDir, { recursive: true });
      // Mark the engine dir as ESM so `node engine/cli.js` doesn't reparse + warn.
      await writeFile(join(engineDir, "package.json"), '{\n  "type": "module"\n}\n');
    }
    const out = join(skillDir, "SKILL.md");
    await writeFile(out, content);

    console.log(pc.bold(pc.green("\n  ✓ installed the safeskills gate into Claude Code")));
    console.log(pc.dim(`  skill   ${out}`));
    console.log(pc.dim(`  engine  ${cliPath}${opts.dev ? "  (dev: repo build)" : ""}`));
    console.log(pc.dim(`  node    ${nodeBin}`));
    console.log(pc.dim(`  gate    ${gate} use <name> --file <path> --claude`));
    if (opts.dev) {
      console.log(pc.cyan(`  ledger  this gate can read/sign on a connected Ledger (native node-hid via repo node_modules)`));
    }
    console.log(pc.yellow(`\n  next: onboard once, then restart Claude Code:`));
    console.log(pc.dim(`    ${gate} onboard --ens --min-security 70\n`));
  });

program.parseAsync(process.argv);
