import { namehash } from "viem/ens";
import {
  hashSkill,
  type Attestation,
  type Hex,
  type Policy,
  type SkillRecord,
  type Verdict,
} from "@aegis/core";
import seedJson from "../fixtures/registry.seed.json";
import { fixtureContent } from "./fixtures";

export type SkillStatus = "verified" | "poisoned" | "pending" | "revoked";

interface SeedAttestation {
  provider: string;
  status: "pass" | "fail";
  score: number;
}

interface SeedSkill {
  name: string;
  title: string;
  description: string;
  file: string;
  isPrivate: boolean;
  verdict: "pass" | "fail" | null;
  status: SkillStatus;
  attestations?: SeedAttestation[];
}

interface SeedJson {
  policy: Policy;
  org: Hex;
  skills: SeedSkill[];
}

const seed = seedJson as unknown as SeedJson;

/** A seeded skill: a SkillRecord plus demo metadata (title, status, fetch uri). */
export interface SeededSkill extends SkillRecord {
  /** Human-readable name (mock; would be the ENS `name` text record). */
  title: string;
  /** Short description (mock; would be the ENS `description` text record). */
  description: string;
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

function makeAttestations(raw: SeedAttestation[] | undefined, pin: string, name: string): Attestation[] {
  return (raw ?? []).map((a) => ({
    provider: a.provider,
    status: a.status,
    score: a.score,
    attestationId: `seed-${a.provider}-${name}`,
    reviewedHash: pin,
  }));
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
      title: s.title,
      description: s.description,
      node: namehash(s.name) as Hex,
      pin,
      owner: seed.org,
      contentUri: s.file,
      fetchUri: s.file,
      isPrivate: s.isPrivate,
      status: s.status,
      verdict: makeVerdict(s.verdict, pin, s.name),
      attestations: makeAttestations(s.attestations, pin, s.name),
    };
  });
}

export const defaultPolicy: Policy = seed.policy;
