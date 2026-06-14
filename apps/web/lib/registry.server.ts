import { gate, hashSkill, type GateResult, type SkillRecord, type Verdict } from "@aegis/core";
import { buildAdapters, type Adapters } from "@aegis/adapters";

export interface RegistryEntry {
  record: SkillRecord;
  /** Human-readable name (mock; would be the ENS `name` text record). */
  title: string;
  /** Short description (mock; would be the ENS `description` text record). */
  description: string;
  /** Demo status badge from the seed (verified / poisoned / pending / revoked). */
  status: string;
  /** The fetch uri used to re-verify the bytes. */
  fetchUri: string;
}

let adaptersSingleton: Adapters | undefined;
function adapters(): Adapters {
  adaptersSingleton ??= buildAdapters();
  return adaptersSingleton;
}

/**
 * All seeded skills, resolved to their current record (pin + attestations).
 * Resilient to names that don't resolve — in `ens` mode a seeded name may not be
 * deployed on-chain yet, and one unresolved name shouldn't blank the whole page.
 */
export async function getRegistry(): Promise<RegistryEntry[]> {
  const a = adapters();
  const settled = await Promise.allSettled(
    a.seed.map(async (s) => ({
      record: await a.resolver.resolve(s.name),
      title: s.title,
      description: s.description,
      status: s.status,
      fetchUri: s.fetchUri,
    })),
  );
  for (const [i, r] of settled.entries()) {
    if (r.status === "rejected") {
      console.warn(`registry: skipping "${a.seed[i].name}" — ${(r.reason as Error).message}`);
    }
  }
  return settled
    .filter((r): r is PromiseFulfilledResult<RegistryEntry> => r.status === "fulfilled")
    .map((r) => r.value);
}

/** A single entry by its pinned content hash. */
export async function getEntryByPin(pin: string): Promise<RegistryEntry | undefined> {
  const all = await getRegistry();
  return all.find((e) => e.record.pin === pin);
}

export interface OrgEntry {
  /** The org's ENS name, e.g. "acme.safeskills.eth". */
  name: string;
  /** The org label, e.g. "acme". */
  label: string;
  /** The registry root the org sits under, e.g. "safeskills.eth". */
  root: string;
  /** The org's skills (each a resolved registry entry). */
  skills: RegistryEntry[];
  counts: { total: number; verified: number; poisoned: number; pending: number; revoked: number };
}

/**
 * The companies on the registry, derived from the skill names. A skill
 * `weather.acme.safeskills.eth` belongs to org `acme.safeskills.eth` — i.e. the
 * name with its leftmost (skill) label dropped.
 */
export async function getOrgs(): Promise<OrgEntry[]> {
  const byOrg = new Map<string, RegistryEntry[]>();
  for (const entry of await getRegistry()) {
    const labels = entry.record.name.split(".");
    const orgName = labels.length > 2 ? labels.slice(1).join(".") : entry.record.name;
    const list = byOrg.get(orgName) ?? [];
    list.push(entry);
    byOrg.set(orgName, list);
  }

  return [...byOrg.entries()]
    .map(([name, skills]) => {
      const counts = { total: skills.length, verified: 0, poisoned: 0, pending: 0, revoked: 0 };
      for (const s of skills) if (s.status in counts) counts[s.status as keyof typeof counts]++;
      const labels = name.split(".");
      return { name, label: labels[0] ?? name, root: labels.slice(1).join("."), skills, counts };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface VerifyResponse {
  result: GateResult;
  resolved: { name: string; pin: string; owner: string; verdict?: Verdict };
  fetched: { hash: string };
  error?: string;
}

/**
 * The honest verify path: resolve the name, re-hash the actual bytes, and run
 * the same gate() the CLI uses. The web has no Ledger, so it gates with
 * `authorized: true` — it answers "is this content safe & verified?", leaving
 * the hardware authorization step to the CLI install flow.
 */
async function runGate(name: string, bytes: Uint8Array): Promise<VerifyResponse> {
  const a = adapters();
  const record = await a.resolver.resolve(name);
  const fetchedHash = hashSkill(bytes);
  const result = gate({
    record,
    fetchedHash,
    policy: a.policy,
    revoked: false,
    authorized: true,
  });
  return {
    result,
    resolved: { name: record.name, pin: record.pin, owner: record.owner, verdict: record.verdict },
    fetched: { hash: fetchedHash },
  };
}

/** Verify uploaded SKILL.md bytes against a pinned name. */
export async function verifyBytes(name: string, md: Uint8Array): Promise<VerifyResponse> {
  return runGate(name, md);
}

/** Verify a seeded skill's on-disk bytes against its pin (one-click demo). */
export async function verifyFixture(name: string): Promise<VerifyResponse> {
  const a = adapters();
  const s = a.seed.find((r) => r.name === name);
  if (!s) throw new Error(`unknown name "${name}"`);
  const bytes = await a.fetcher.fetch(s.fetchUri);
  return runGate(name, bytes);
}

/** Names available for the quick-verify buttons. */
export function seededNames(): { name: string; status: string }[] {
  return adapters().seed.map((s) => ({ name: s.name, status: s.status }));
}
