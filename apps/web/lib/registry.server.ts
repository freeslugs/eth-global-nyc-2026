import { digest, verify, type Attestation, type VerifyResult } from "@aegis/core";
import {
  buildAdapters,
  resolvePolicy,
  artifactDir,
  type Adapters,
  type SeedRecord,
} from "@aegis/adapters";

export interface RegistryEntry {
  record: SeedRecord;
  attestations: Attestation[];
  revoked: boolean;
}

let adaptersSingleton: Adapters | undefined;
function adapters(): Adapters {
  adaptersSingleton ??= buildAdapters();
  return adaptersSingleton;
}

/** All seeded records, enriched with attestations + revocation state. */
export async function getRegistry(): Promise<RegistryEntry[]> {
  const a = adapters();
  return Promise.all(
    a.seed.records.map(async (record) => ({
      record,
      attestations: await a.store.getAttestations(record.bundleHash),
      revoked: await a.store.isRevoked(record.bundleHash),
    })),
  );
}

/** A single entry by its pinned bundle hash. */
export async function getEntryByHash(bundleHash: string): Promise<RegistryEntry | undefined> {
  const all = await getRegistry();
  return all.find((e) => e.record.bundleHash === bundleHash);
}

export interface VerifyResponse {
  result: VerifyResult;
  resolved: { name: string; bundleHash: string; manifestHash: string; publisher: string };
  fetched: { bundleHash: string; manifestHash: string };
}

async function runVerify(
  name: string,
  bundle: Uint8Array,
  manifest: Uint8Array,
): Promise<VerifyResponse> {
  const a = adapters();
  const resolved = await a.resolver.resolve(name);
  const fetched = digest({ bundle, manifest });
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
  return {
    result,
    resolved: {
      name: resolved.name,
      bundleHash: resolved.bundleHash,
      manifestHash: resolved.manifestHash,
      publisher: resolved.publisher,
    },
    fetched,
  };
}

/** Verify uploaded bytes against a pinned name (the honest manual path). */
export async function verifyBytes(
  name: string,
  bundle: Uint8Array,
  manifest: Uint8Array,
): Promise<VerifyResponse> {
  return runVerify(name, bundle, manifest);
}

/** Verify a seeded fixture's on-disk bytes against its pin (one-click demo). */
export async function verifyFixture(name: string): Promise<VerifyResponse> {
  const a = adapters();
  const record = a.seed.records.find((r) => r.name === name);
  if (!record) throw new Error(`unknown name "${name}"`);
  const artifact = await a.fetcher.fetch(artifactDir(record));
  return runVerify(name, artifact.bundle, artifact.manifest);
}

/** Names available for the quick-verify buttons. */
export function seededNames(): { name: string; status: string }[] {
  return adapters().seed.records.map((r) => ({ name: r.name, status: r.status }));
}
