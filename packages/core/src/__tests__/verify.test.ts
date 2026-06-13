import { describe, it, expect } from "vitest";
import { verify } from "../verify";
import { digest } from "../hash";
import {
  goodRecord,
  goodDigest,
  goodArtifact,
  tamperedArtifact,
  swappedBundleArtifact,
  provenanceAttestation,
  reviewAttestation,
  noProvenancePolicy,
  provenancePolicy,
  oneReviewPolicy,
  acceptSig,
  rejectSig,
  PUBLISHER,
  ATTESTOR,
} from "./fixtures";
import type { Attestation } from "../types";

describe("verify()", () => {
  it("ALLOWs a good artifact (no provenance required, no reviews required)", () => {
    const result = verify({
      resolved: goodRecord,
      fetched: goodDigest,
      policy: noProvenancePolicy,
      attestations: [],
      revoked: false,
      verifyProvenanceSig: acceptSig,
    });
    expect(result).toEqual({ ok: true });
  });

  it("re-hashes the real file (no hard-coded verdict): good bytes => allow", () => {
    const fetched = digest(goodArtifact);
    const result = verify({
      resolved: goodRecord,
      fetched,
      policy: noProvenancePolicy,
      attestations: [],
      revoked: false,
      verifyProvenanceSig: acceptSig,
    });
    expect(result.ok).toBe(true);
  });

  it("BLOCKs hash_mismatch when the bundle was swapped", () => {
    const fetched = digest(swappedBundleArtifact);
    const result = verify({
      resolved: goodRecord,
      fetched,
      policy: noProvenancePolicy,
      attestations: [],
      revoked: false,
      verifyProvenanceSig: acceptSig,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("hash_mismatch");
  });

  it("BLOCKs manifest_changed when only the manifest was tampered", () => {
    const fetched = digest(tamperedArtifact);
    const result = verify({
      resolved: goodRecord,
      fetched,
      policy: noProvenancePolicy,
      attestations: [],
      revoked: false,
      verifyProvenanceSig: acceptSig,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("manifest_changed");
  });

  describe("provenance", () => {
    it("BLOCKs bad_provenance when provenance attestation is missing", () => {
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: provenancePolicy,
        attestations: [],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad_provenance");
    });

    it("BLOCKs bad_provenance when attestor is not the pinned publisher", () => {
      const wrongAttestor: Attestation = { ...provenanceAttestation, attestor: ATTESTOR };
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: provenancePolicy,
        attestations: [wrongAttestor],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad_provenance");
    });

    it("BLOCKs bad_provenance when the signature is invalid", () => {
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: provenancePolicy,
        attestations: [provenanceAttestation],
        revoked: false,
        verifyProvenanceSig: rejectSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad_provenance");
    });

    it("ALLOWs when provenance is present, attestor matches, signature valid", () => {
      expect(PUBLISHER).toBe(provenanceAttestation.attestor);
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: provenancePolicy,
        attestations: [provenanceAttestation],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(true);
    });
  });

  it("BLOCKs revoked even when hashes and provenance are fine", () => {
    const result = verify({
      resolved: goodRecord,
      fetched: goodDigest,
      policy: provenancePolicy,
      attestations: [provenanceAttestation],
      revoked: true,
      verifyProvenanceSig: acceptSig,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("revoked");
  });

  describe("policy", () => {
    it("BLOCKs under_policy when zero reviews but minReviews=1", () => {
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: oneReviewPolicy,
        attestations: [],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("under_policy");
    });

    it("ALLOWs when minReviews=1 and a review attestation is present", () => {
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: oneReviewPolicy,
        attestations: [reviewAttestation],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(true);
    });

    it("BLOCKs under_policy when reviews come from untrusted attestors", () => {
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: { requireProvenance: false, minReviews: 1, trustedAttestors: [PUBLISHER] },
        attestations: [reviewAttestation], // from ATTESTOR, not trusted
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("under_policy");
    });

    it("BLOCKs under_policy on a confidential verdict from an untrusted analyzer", () => {
      const confidential: Attestation = {
        subject: goodDigest.bundleHash,
        kind: "confidential",
        attestor: ATTESTOR,
        analyzer: "sha256:unknownanalyzer",
        createdAt: 1_700_000_200,
      };
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: {
          requireProvenance: false,
          minReviews: 0,
          trustedAnalyzers: ["sha256:trustedanalyzer"],
        },
        attestations: [confidential],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("under_policy");
    });

    it("ALLOWs a confidential verdict from a trusted analyzer", () => {
      const confidential: Attestation = {
        subject: goodDigest.bundleHash,
        kind: "confidential",
        attestor: ATTESTOR,
        analyzer: "sha256:trustedanalyzer",
        createdAt: 1_700_000_200,
      };
      const result = verify({
        resolved: goodRecord,
        fetched: goodDigest,
        policy: {
          requireProvenance: false,
          minReviews: 0,
          trustedAnalyzers: ["sha256:trustedanalyzer"],
        },
        attestations: [confidential],
        revoked: false,
        verifyProvenanceSig: acceptSig,
      });
      expect(result.ok).toBe(true);
    });
  });
});
