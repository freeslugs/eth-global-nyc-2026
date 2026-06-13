import { gate, hashSkill, type GateResult, type SkillRecord, type Verdict } from "@aegis/core";
import { buildAdapters, type Adapters } from "@aegis/adapters";

export interface RegistryEntry {
  record: SkillRecord;
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

/** All seeded skills, resolved to their current record (pin + verdict). */
export async function getRegistry(): Promise<RegistryEntry[]> {
  const a = adapters();
  return Promise.all(
    a.seed.map(async (s) => ({
      record: await a.resolver.resolve(s.name),
      status: s.status,
      fetchUri: s.fetchUri,
    })),
  );
}

/** A single entry by its pinned content hash. */
export async function getEntryByPin(pin: string): Promise<RegistryEntry | undefined> {
  const all = await getRegistry();
  return all.find((e) => e.record.pin === pin);
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
