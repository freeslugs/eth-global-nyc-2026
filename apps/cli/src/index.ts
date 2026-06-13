import { Command } from "commander";
import pc from "picocolors";
import { resolve as resolvePath } from "node:path";
import { digest, verify, type ResolvedRecord, type Attestation } from "@aegis/core";
import { buildAdapters, resolvePolicy } from "@aegis/adapters";

const program = new Command();

program
  .name("aegis")
  .description("Aegis — verify third-party code against its pinned, vetted release before you run it.")
  .version("0.0.0");

/** Encode a string subject for signing. */
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

program
  .command("verify")
  .description("Resolve a name, fetch the artifact, re-hash it, and ALLOW or BLOCK.")
  .argument("<name>", "human-readable skill name (e.g. web-scraper.skills.aegis.eth)")
  .argument("<path>", "path to the artifact dir (contains bundle.js + manifest.json)")
  .action(async (name: string, path: string) => {
    const a = buildAdapters();
    try {
      const resolved = await a.resolver.resolve(name);
      const artifact = await a.fetcher.fetch(resolvePath(path));
      const fetched = digest(artifact);
      const attestations = await a.store.getAttestations(resolved.bundleHash);
      const revoked = await a.store.isRevoked(resolved.bundleHash);
      const policy = resolvePolicy(a.seed, resolved.policyRef);

      const result = verify({
        resolved,
        fetched,
        policy,
        attestations,
        revoked,
        verifyProvenanceSig: a.verifyProvenanceSig,
      });

      console.log(pc.dim(`name      ${resolved.name}`));
      console.log(pc.dim(`publisher ${resolved.publisher}`));
      console.log(pc.dim(`pin       ${resolved.bundleHash}`));
      console.log(pc.dim(`          ${resolved.manifestHash}`));
      console.log(pc.dim(`fetched   ${fetched.bundleHash}`));
      console.log(pc.dim(`          ${fetched.manifestHash}`));

      if (result.ok) {
        console.log(pc.bold(pc.green("\n  ✓ ALLOW")) + pc.green("  artifact matches its pinned release"));
        process.exit(0);
      } else {
        console.log(
          pc.bold(pc.red(`\n  ✗ BLOCK  ${result.reason}`)) +
            (result.detail ? pc.red(`\n    ${result.detail}`) : ""),
        );
        process.exit(1);
      }
    } catch (err) {
      console.error(pc.red(`\n  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program
  .command("publish")
  .description("Hash an artifact, sign provenance, and pin it in the store.")
  .argument("<name>", "human-readable artifact name")
  .argument("<path>", "path to the artifact dir (contains bundle.js + manifest.json)")
  .option("-p, --policy <ref>", "policy ref to pin", "policy:default")
  .action(async (name: string, path: string, opts: { policy: string }) => {
    const a = buildAdapters();
    try {
      const artifact = await a.fetcher.fetch(resolvePath(path));
      const { bundleHash, manifestHash } = digest(artifact);
      const publisher = await a.signer.address();
      const signature = await a.signer.sign(enc(bundleHash));

      const record: ResolvedRecord = {
        name,
        bundleHash,
        manifestHash,
        publisher,
        policyRef: opts.policy,
      };
      await a.store.setPin(record);

      const provenance: Attestation = {
        subject: bundleHash,
        kind: "provenance",
        attestor: publisher,
        signature,
        createdAt: Date.now(),
      };
      await a.store.postAttestation(provenance);

      console.log(pc.bold(pc.green("  ✓ published")));
      console.log(pc.dim(`  name      ${name}`));
      console.log(pc.dim(`  publisher ${publisher}`));
      console.log(pc.dim(`  bundle    ${bundleHash}`));
      console.log(pc.dim(`  manifest  ${manifestHash}`));
      console.log(pc.dim(`  signature ${signature.slice(0, 22)}…`));
      console.log(
        pc.yellow(
          "\n  note: the mock store is in-process; the pin lives only for this run.",
        ),
      );
    } catch (err) {
      console.error(pc.red(`  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program
  .command("revoke")
  .description("Sign and post a revocation for a name's pinned subject.")
  .argument("<name>", "human-readable artifact name")
  .action(async (name: string) => {
    const a = buildAdapters();
    try {
      const resolved = await a.resolver.resolve(name);
      const by = await a.signer.address();
      const signature = await a.signer.sign(enc(`revoke:${resolved.bundleHash}`));
      await a.store.postRevocation(resolved.bundleHash, by, signature);

      console.log(pc.bold(pc.red("  ⊘ revoked")));
      console.log(pc.dim(`  name    ${resolved.name}`));
      console.log(pc.dim(`  subject ${resolved.bundleHash}`));
      console.log(pc.dim(`  by      ${by}`));
    } catch (err) {
      console.error(pc.red(`  ✗ ERROR  ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
