import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Attestation, Hex, Policy, ResolvedRecord } from "@aegis/core";
import seedJson from "../fixtures/registry.seed.json";

/** Absolute path to this package's fixtures dir, robust to the caller's cwd. */
export const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/** Absolute path to a seeded artifact's on-disk dir (bundle.js + manifest.json). */
export function artifactDir(record: { artifactPath: string }): string {
  const slug = record.artifactPath.split("/").pop() ?? "";
  return join(fixturesDir, "artifacts", slug);
}

export type ArtifactStatus = "verified" | "poisoned" | "revoked";

export interface SeedRecord extends ResolvedRecord {
  /** Declared status for explorer badges. Real verdicts come from verify(). */
  status: ArtifactStatus;
  /** Repo-relative path to the artifact dir (bundle.js + manifest.json). */
  artifactPath: string;
}

export interface SeedRevocation {
  subject: string;
  by: Hex;
  signature: Hex;
  reason?: string;
}

export interface RegistrySeed {
  policies: Record<string, Policy>;
  records: SeedRecord[];
  attestations: Attestation[];
  revocations: SeedRevocation[];
}

/** The seed JSON inlined at build time (no fs access required at runtime). */
export const defaultSeed = seedJson as unknown as RegistrySeed;

/** Resolve a policyRef to a Policy, falling back to a strict default. */
export function resolvePolicy(seed: RegistrySeed, ref: string): Policy {
  return (
    seed.policies[ref] ?? {
      requireProvenance: true,
      minReviews: 1,
    }
  );
}
