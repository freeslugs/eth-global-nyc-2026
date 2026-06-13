import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { namehash } from "viem/ens";
import { hashSkill, type Hex, type Policy, type SkillRecord, type Verdict } from "@aegis/core";
import seedJson from "../fixtures/registry.seed.json";

/** Absolute path to this package's fixtures dir, robust to the caller's cwd. */
export const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export type SkillStatus = "verified" | "poisoned" | "pending" | "revoked";

interface SeedSkill {
  name: string;
  file: string;
  isPrivate: boolean;
  verdict: "pass" | "fail" | null;
  status: SkillStatus;
}

interface SeedJson {
  policy: Policy;
  org: Hex;
  skills: SeedSkill[];
}

const seed = seedJson as unknown as SeedJson;

/** A seeded skill: a SkillRecord plus demo metadata (status, fetch uri). */
export interface SeededSkill extends SkillRecord {
  status: SkillStatus;
  isPrivate: boolean;
  /** The uri the MockFetcher understands (the fixture filename). */
  fetchUri: string;
}

function makeVerdict(kind: "pass" | "fail" | null, pin: string, name: string): Verdict | undefined {
  if (kind === null) return undefined;
  return {
    status: kind,
    riskScore: kind === "pass" ? 5 : 95,
    attestationId: `seed-${name}`,
    reviewedHash: pin,
  };
}

/** Read the fixtures, compute pins, and assemble the seeded skill records. */
export function loadSeededSkills(): SeededSkill[] {
  return seed.skills.map((s) => {
    const bytes = new Uint8Array(readFileSync(join(fixturesDir, s.file)));
    const pin = hashSkill(bytes);
    return {
      name: s.name,
      node: namehash(s.name) as Hex,
      pin,
      owner: seed.org,
      contentUri: s.file,
      fetchUri: s.file,
      isPrivate: s.isPrivate,
      status: s.status,
      verdict: makeVerdict(s.verdict, pin, s.name),
    };
  });
}

export const defaultPolicy: Policy = seed.policy;
