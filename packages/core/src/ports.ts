import type { Artifact, ArtifactHash, ResolvedRecord, Attestation, Hex } from "./types";

/** Pulls an artifact from a source (npm / url / file). */
export interface Fetcher {
  fetch(source: string): Promise<Artifact>;
}

/** Resolves a human-readable name to its pinned record. ENS lives here. */
export interface Resolver {
  resolve(name: string): Promise<ResolvedRecord>;
}

/** Signs bytes with a trust key. Ledger lives here. */
export interface Signer {
  address(): Promise<Hex>;
  sign(msg: Uint8Array): Promise<Hex>;
}

/** Stores pins, attestations, and revocations. On-chain store lives here. */
export interface AttestationStore {
  getAttestations(subject: ArtifactHash): Promise<Attestation[]>;
  isRevoked(subject: ArtifactHash): Promise<boolean>;
  postAttestation(a: Attestation): Promise<void>;
  postRevocation(subject: ArtifactHash, by: Hex, signature: Hex): Promise<void>;
  /** Used by the publish flow to record/move the pin. */
  setPin(rec: ResolvedRecord): Promise<void>;
  /** Resolve a pin previously set (used by mock resolver/registry views). */
  getPin?(name: string): Promise<ResolvedRecord | undefined>;
}

/** Requests an off-chain confidential analysis verdict. Chainlink lives here. */
export interface ConfidentialAttester {
  requestAnalysis(subject: ArtifactHash, analyzer: ArtifactHash, uri: string): Promise<void>;
}
