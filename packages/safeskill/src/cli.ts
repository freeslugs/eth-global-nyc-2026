import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import { Safeskill } from "./client";
import { loadConfig, loadPolicyFile } from "./config";
import { PRESETS } from "./policy";
import type { Decision, SafeskillPolicy, SignerKind, SkillDecision } from "./types";

const program = new Command();

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
  console.log(pc.dim(`  owner     ${d.record.owner}`));
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
  .option("--ledger", "authorize overrides with a real Ledger device")
  .option("--local", "authorize overrides with a local dev key (demo, no device)")
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
      const signer: SignerKind = opts.signer === false ? "none" : opts.ledger ? "ledger" : "local";

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
    const skills = ss.listSkills();
    console.log(pc.bold(`\n  ${skills.length} skills in the registry`) + pc.dim(`  (policy: ${ss.config.policy.name})\n`));
    for (const s of skills) {
      let d: SkillDecision;
      try {
        d = await ss.check(s.name);
      } catch (err) {
        console.log(`  ${pc.red("ERROR".padEnd(14))}  ${pc.dim("—  ")}  ${s.name} ${pc.dim(`(${(err as Error).message})`)}`);
        continue;
      }
      console.log(`  ${badge(d.decision).padEnd(24)}  ${rating(d)}  ${s.name}`);
      console.log(pc.dim(`  ${" ".repeat(14)}        ${s.description}`));
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
  .option("--no-override", "reject (don't even offer the Ledger override) for below-policy skills")
  .action(async (name: string, opts: { dir: string; file?: string; claude?: boolean; override: boolean }) => {
    const ss = await loadOrExit();
    try {
      const d = await ss.check(name, { file: opts.file });
      printDecision(d);

      if (d.decision === "needs-override" && opts.override && ss.config.signer !== "none") {
        console.log(pc.yellow(`\n  ⚠ below policy — authorizing override with ${ss.config.signer} signer…`));
      }

      // In --claude mode, default the install dir to the user's Claude Code skills folder.
      const dir = opts.claude && opts.dir === ".skills" ? join(homedir(), ".claude", "skills") : opts.dir;
      const result = await ss.use(name, { dir, file: opts.file, claude: opts.claude, allowOverride: opts.override });
      if (result.installed) {
        const how = result.overridden ? pc.yellow("(Ledger override)") : pc.green("(auto-approved)");
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

1. "What security score (0–100, higher = safer) should let a skill install with no
   questions asked?" → \`--min-security <N>\` (a sensible default is 70).
2. "For reviewed skills below that line — require your signature, or block them?"
   (sign ⇒ they stay \`needs-override\`; block ⇒ add a stricter rule).
3. "Any publishers to ALWAYS trust or ALWAYS block?" (e.g. \`acme.safeskills.eth\`).

Then onboard with the answer that fits:
- Simple threshold → \`${gate} onboard --ens --local --min-security <N>\`
- A named preset → \`${gate} onboard --ens --local --preset strict|default|permissive\`
- Custom rules (trusted/blocked publishers, etc.) → write a policy JSON (schema
  below) to a file, then \`${gate} onboard --ens --local --policy <file>\`.

Confirm with \`${gate} policy\` and show the user their active rules.

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
- **needs-override with no/declined signature** → not installed; explain why.

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
  .action(async (opts: { dir: string; print?: boolean }) => {
    // The gate command the meta-skill tells the agent to run = however THIS CLI
    // was invoked. Run `init` from a persistent install (repo build or a global
    // bin), not an ephemeral `npx` temp dir, so the path stays valid.
    const cliPath = fileURLToPath(import.meta.url);
    // TODO(contenturi): bake the temporary demo content dir into the gate command so
    // check/use resolve a candidate without --file until contentUri is pinned on-chain.
    const demoContent = join(dirname(cliPath), "..", "demo-content");
    const gate = `AEGIS_CONTENT_DIR='${demoContent}' node '${cliPath}'`;
    const content = metaSkill(gate);

    if (opts.print) {
      console.log(content);
      return;
    }

    const skillDir = join(opts.dir, "safeskills");
    await mkdir(skillDir, { recursive: true });
    const out = join(skillDir, "SKILL.md");
    await writeFile(out, content);

    console.log(pc.bold(pc.green("\n  ✓ installed the safeskills gate into Claude Code")));
    console.log(pc.dim(`  skill   ${out}`));
    console.log(pc.dim(`  gate    ${gate} use <name> --file <path> --claude`));
    console.log(pc.yellow(`\n  next: onboard once, then restart Claude Code:`));
    console.log(pc.dim(`    ${gate} onboard --ens --local --min-security 70\n`));
  });

program.parseAsync(process.argv);
