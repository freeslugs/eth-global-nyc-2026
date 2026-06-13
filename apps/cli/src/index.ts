import { Command } from "commander";
import pc from "picocolors";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gate, hashSkill, type AuthRequest, type GateResult, type SkillRecord } from "@aegis/core";
import { buildAdapters } from "@aegis/adapters";

const program = new Command();

program
  .name("safeskills")
  .description("Safe Skills — verify an agent skill before you (or your agent) load it.")
  .version("0.0.0");

interface Loaded {
  name: string;
  pin: string;
  fetchedHash: string;
  authRequest: AuthRequest | undefined;
  record: SkillRecord;
  bytes: Uint8Array;
}

/** Resolve a name, fetch its SKILL.md, and re-hash — the shared first half. */
async function load(a: ReturnType<typeof buildAdapters>, name: string): Promise<Loaded> {
  const record = await a.resolver.resolve(name);
  const uri = record.contentUri;
  if (!uri) throw new Error(`no contentUri for ${name}`);
  const bytes = await a.fetcher.fetch(uri);
  const fetchedHash = hashSkill(bytes);
  const authRequest = record.verdict
    ? { node: record.node, name: record.name, pin: record.pin, verdict: record.verdict }
    : undefined;
  return { name, pin: record.pin, fetchedHash, authRequest, record, bytes };
}

function printRecord(l: Loaded): void {
  console.log(pc.dim(`name      ${l.record.name}`));
  console.log(pc.dim(`owner     ${l.record.owner}`));
  console.log(pc.dim(`pin       ${l.pin}`));
  console.log(pc.dim(`fetched   ${l.fetchedHash}`));
  if (l.record.verdict) {
    console.log(
      pc.dim(`verdict   ${l.record.verdict.status} · risk ${l.record.verdict.riskScore}`),
    );
  } else {
    console.log(pc.dim("verdict   (none yet)"));
  }
}

function printGate(result: GateResult): void {
  if (result.ok) {
    console.log(pc.bold(pc.green("\n  ✓ ALLOW")));
  } else {
    console.log(
      pc.bold(pc.red(`\n  ✗ BLOCK  ${result.reason}`)) +
        (result.detail ? pc.red(`\n    ${result.detail}`) : ""),
    );
  }
}

program
  .command("check")
  .description("Resolve, fetch, re-hash, and report what the gate says (no install).")
  .argument("<name>", "skill name (e.g. weather.acme.safeskills.eth)")
  .action(async (name: string) => {
    const a = buildAdapters();
    try {
      const l = await load(a, name);
      printRecord(l);
      // authorized:false → shows the verdict/content checks; the Ledger step is
      // an install concern, so "unauthorized" here means "content is fine".
      const result = gate({
        record: l.record,
        fetchedHash: l.fetchedHash,
        policy: a.policy,
        revoked: false,
        authorized: false,
      });
      if (!result.ok && result.reason === "unauthorized") {
        console.log(pc.bold(pc.green("\n  ✓ content verified")) + pc.dim("  (install needs Ledger)"));
      } else {
        printGate(result);
      }
      process.exit(result.ok || (!result.ok && result.reason === "unauthorized") ? 0 : 1);
    } catch (err) {
      console.error(pc.red(`\n  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program
  .command("install")
  .description("Verify, authorize on the Ledger, and install the skill if it passes.")
  .argument("<name>", "skill name")
  .option("-d, --dir <dir>", "install dir", ".skills")
  .option("--no-ledger", "skip authorization (demo bypass → blocked as unauthorized)")
  .action(async (name: string, opts: { dir: string; ledger: boolean }) => {
    const a = buildAdapters();
    try {
      const l = await load(a, name);
      printRecord(l);

      // First pass with authorized:false. Any failure other than `unauthorized`
      // blocks before we ever touch the device.
      const pre = gate({
        record: l.record,
        fetchedHash: l.fetchedHash,
        policy: a.policy,
        revoked: false,
        authorized: false,
      });
      if (!pre.ok && pre.reason !== "unauthorized") {
        printGate(pre);
        process.exit(1);
      }

      // Demo bypass: --no-ledger leaves authorized:false → unauthorized → blocked.
      let authorized = false;
      if (opts.ledger) {
        if (!l.authRequest) throw new Error("cannot authorize: no verdict to sign");
        const addr = await a.signer.address();
        const sig = await a.signer.authorize(l.authRequest);
        authorized = a.signer.verify(l.authRequest, sig, addr);
      }

      const result = gate({
        record: l.record,
        fetchedHash: l.fetchedHash,
        policy: a.policy,
        revoked: false,
        authorized,
      });
      printGate(result);
      if (!result.ok) process.exit(1);

      await mkdir(opts.dir, { recursive: true });
      const out = join(opts.dir, `${l.record.name}.md`);
      await writeFile(out, l.bytes);
      console.log(pc.green(`  installed → ${out}`));
      process.exit(0);
    } catch (err) {
      console.error(pc.red(`\n  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
