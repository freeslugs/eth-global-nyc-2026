/**
 * Aegis domain types. Pure data; no I/O, no chain, no fs.
 */

export type Hex = `0x${string}`;

/** Canonical artifact hash form: "sha256:<hex>". */
export type ArtifactHash = string;

export interface Artifact {
  /** Package / server code. */
  bundle: Uint8Array;
  /** MCP tool descriptors — hashed SEPARATELY (it is the poisoning surface). */
  manifest: Uint8Array;
}

export interface ArtifactDigest {
  bundleHash: ArtifactHash;
  manifestHash: ArtifactHash;
}

export interface ResolvedRecord {
  name: string;
  /** The PIN: expected bundle hash. */
  bundleHash: ArtifactHash;
  /** The PIN: expected manifest (descriptors) hash. */
  manifestHash: ArtifactHash;
  /** Address that must have signed provenance. */
  publisher: Hex;
  /** Policy id or URI. */
  policyRef: string;
  /** Optional pointer to attestation log. */
  logRef?: string;
}

export type AttestationKind = "provenance" | "review" | "confidential" | "revocation";

export interface Attestation {
  /** = bundleHash of the subject artifact. */
  subject: ArtifactHash;
  kind: AttestationKind;
  attestor: Hex;
  signature?: Hex;
  /** Confidential lane: which program produced the verdict. */
  analyzer?: ArtifactHash;
  /** Verdict / score / flags. */
  payload?: unknown;
  bond?: bigint;
  createdAt: number;
}

export interface Policy {
  requireProvenance: boolean;
  minReviews: number;
  trustedAttestors?: Hex[];
  /** Confidential lane: analyzers whose verdicts are trusted. */
  trustedAnalyzers?: ArtifactHash[];
}

export type VerifyFailureReason =
  | "hash_mismatch"
  | "manifest_changed"
  | "bad_provenance"
  | "revoked"
  | "under_policy";

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: VerifyFailureReason;
      detail?: string;
    };
