import { namehash } from "viem/ens";
import { hashSkill, type Hex, type Policy, type SkillRecord, type Verdict } from "@aegis/core";
import seedJson from "../fixtures/registry.seed.json";
import { fixtureContent } from "./fixtures";

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
    const content = fixtureContent[s.file];
    if (!content) throw new Error(`Unknown fixture: ${s.file}`);
    const bytes = new Uint8Array(content);
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
