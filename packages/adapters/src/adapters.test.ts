import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digest, verify } from "@aegis/core";
import { buildAdapters } from "./factory";
import { resolvePolicy } from "./seed";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");

/** Run the full mock pipeline for a seeded name against on-disk bytes. */
async function runVerify(name: string) {
  const a = buildAdapters({}); // all-mock defaults
  const resolved = await a.resolver.resolve(name);
  const record = a.seed.records.find((r) => r.name === name)!;
  const artifact = await a.fetcher.fetch(resolve(repoRoot, record.artifactPath));
  const fetched = digest(artifact);
  const attestations = await a.store.getAttestations(resolved.bundleHash);
  const revoked = await a.store.isRevoked(resolved.bundleHash);
  return verify({
    resolved,
    fetched,
    policy: resolvePolicy(a.seed, resolved.policyRef),
    attestations,
    revoked,
    verifyProvenanceSig: a.verifyProvenanceSig,
  });
}

describe("buildAdapters (mock defaults)", () => {
  it("ALLOWs the verified seeded skill", async () => {
    const result = await runVerify("web-scraper.skills.aegis.eth");
    expect(result).toEqual({ ok: true });
  });

  it("BLOCKs the poisoned skill with manifest_changed", async () => {
    const result = await runVerify("slack-notifier.skills.aegis.eth");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("manifest_changed");
  });

  it("BLOCKs the revoked skill with revoked", async () => {
    const result = await runVerify("repo-indexer.skills.aegis.eth");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("revoked");
  });

  it("defaults to mock impls and exposes the seed", () => {
    const a = buildAdapters({});
    expect(a.seed.records.length).toBeGreaterThanOrEqual(3);
  });
});
