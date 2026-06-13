import type { AttestationStore, Attestation, ArtifactHash, Hex, ResolvedRecord } from "@aegis/core";
import type { RegistrySeed } from "../seed";

/** In-memory attestation store, seeded from the registry seed. */
export class MemoryStore implements AttestationStore {
  private readonly attestations = new Map<ArtifactHash, Attestation[]>();
  private readonly revoked = new Set<ArtifactHash>();
  private readonly pins = new Map<string, ResolvedRecord>();

  constructor(seed?: RegistrySeed) {
    if (!seed) return;
    for (const a of seed.attestations) {
      this.append(a.subject, a);
    }
    for (const r of seed.revocations) {
      this.revoked.add(r.subject);
      this.append(r.subject, {
        subject: r.subject,
        kind: "revocation",
        attestor: r.by,
        signature: r.signature,
        payload: r.reason ? { reason: r.reason } : undefined,
        createdAt: Date.now(),
      });
    }
    for (const rec of seed.records) {
      const { name, bundleHash, manifestHash, publisher, policyRef, logRef } = rec;
      this.pins.set(name, { name, bundleHash, manifestHash, publisher, policyRef, logRef });
    }
  }

  private append(subject: ArtifactHash, a: Attestation): void {
    const list = this.attestations.get(subject) ?? [];
    list.push(a);
    this.attestations.set(subject, list);
  }

  async getAttestations(subject: ArtifactHash): Promise<Attestation[]> {
    return [...(this.attestations.get(subject) ?? [])];
  }

  async isRevoked(subject: ArtifactHash): Promise<boolean> {
    return this.revoked.has(subject);
  }

  async postAttestation(a: Attestation): Promise<void> {
    this.append(a.subject, a);
  }

  async postRevocation(subject: ArtifactHash, by: Hex, signature: Hex): Promise<void> {
    this.revoked.add(subject);
    this.append(subject, {
      subject,
      kind: "revocation",
      attestor: by,
      signature,
      createdAt: Date.now(),
    });
  }

  async setPin(rec: ResolvedRecord): Promise<void> {
    this.pins.set(rec.name, rec);
  }

  async getPin(name: string): Promise<ResolvedRecord | undefined> {
    return this.pins.get(name);
  }
}
