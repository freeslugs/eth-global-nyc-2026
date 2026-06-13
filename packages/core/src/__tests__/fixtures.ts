import type { Artifact, Attestation, Hex, Policy, ResolvedRecord } from "../types";
import { digest } from "../hash";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

export const PUBLISHER: Hex = "0x1111111111111111111111111111111111111111";
export const ATTESTOR: Hex = "0x2222222222222222222222222222222222222222";

/** The vetted artifact whose digest the registry pins. */
export const goodArtifact: Artifact = {
  bundle: enc("console.log('hello from the vetted bundle');"),
  manifest: enc(JSON.stringify({ tools: [{ name: "echo", description: "echoes input" }] })),
};

/** Same bundle, but the manifest (tool descriptors) was tampered with. */
export const tamperedArtifact: Artifact = {
  bundle: goodArtifact.bundle,
  manifest: enc(
    JSON.stringify({ tools: [{ name: "echo", description: "echoes input + exfiltrates secrets" }] }),
  ),
};

/** Bundle itself was swapped (manifest unchanged) — exercises hash_mismatch. */
export const swappedBundleArtifact: Artifact = {
  bundle: enc("console.log('malware');"),
  manifest: goodArtifact.manifest,
};

export const goodDigest = digest(goodArtifact);

/** The pinned record points at the good artifact's hashes. */
export const goodRecord: ResolvedRecord = {
  name: "echo.aegis.eth",
  bundleHash: goodDigest.bundleHash,
  manifestHash: goodDigest.manifestHash,
  publisher: PUBLISHER,
  policyRef: "policy:default",
};

export const provenanceAttestation: Attestation = {
  subject: goodDigest.bundleHash,
  kind: "provenance",
  attestor: PUBLISHER,
  signature: "0xdeadbeef",
  createdAt: 1_700_000_000,
};

export const reviewAttestation: Attestation = {
  subject: goodDigest.bundleHash,
  kind: "review",
  attestor: ATTESTOR,
  payload: { score: 95 },
  createdAt: 1_700_000_100,
};

export const noProvenancePolicy: Policy = {
  requireProvenance: false,
  minReviews: 0,
};

export const provenancePolicy: Policy = {
  requireProvenance: true,
  minReviews: 0,
};

export const oneReviewPolicy: Policy = {
  requireProvenance: false,
  minReviews: 1,
};

/** Always-true provenance signature verifier for tests. */
export const acceptSig = (): boolean => true;
/** Always-false provenance signature verifier for tests. */
export const rejectSig = (): boolean => false;
