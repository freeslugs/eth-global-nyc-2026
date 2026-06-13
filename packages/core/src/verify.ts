import type {
  ArtifactDigest,
  Attestation,
  Policy,
  ResolvedRecord,
  VerifyResult,
} from "./types";
import { checkPolicy } from "./policy";

export interface VerifyInput {
  resolved: ResolvedRecord;
  fetched: ArtifactDigest;
  policy: Policy;
  attestations: Attestation[];
  revoked: boolean;
  /** Provenance signature verification is injected (keeps verify() pure). */
  verifyProvenanceSig: (rec: ResolvedRecord, provenance: Attestation) => boolean;
}

/**
 * The pure verification engine. Caller gathers attestations / revocation state
 * via the AttestationStore and passes them in.
 *
 * Order (first failure wins):
 *   1. bundle hash match
 *   2. manifest hash match
 *   3. provenance signature valid (when policy requires it)
 *   4. not revoked
 *   5. policy satisfied (reviews, trusted analyzers)
 */
export function verify(input: VerifyInput): VerifyResult {
  const { resolved, fetched, policy, attestations, revoked, verifyProvenanceSig } = input;

  // 1. bundle hash match
  if (fetched.bundleHash !== resolved.bundleHash) {
    return {
      ok: false,
      reason: "hash_mismatch",
      detail: `expected ${resolved.bundleHash}, fetched ${fetched.bundleHash}`,
    };
  }

  // 2. manifest hash match
  if (fetched.manifestHash !== resolved.manifestHash) {
    return {
      ok: false,
      reason: "manifest_changed",
      detail: `expected ${resolved.manifestHash}, fetched ${fetched.manifestHash}`,
    };
  }

  // 3. provenance signature valid
  if (policy.requireProvenance) {
    const provenance = attestations.find((a) => a.kind === "provenance");
    if (!provenance) {
      return { ok: false, reason: "bad_provenance", detail: "no provenance attestation" };
    }
    if (provenance.attestor !== resolved.publisher) {
      return {
        ok: false,
        reason: "bad_provenance",
        detail: `provenance attestor ${provenance.attestor} != publisher ${resolved.publisher}`,
      };
    }
    if (!verifyProvenanceSig(resolved, provenance)) {
      return { ok: false, reason: "bad_provenance", detail: "invalid provenance signature" };
    }
  }

  // 4. not revoked
  if (revoked) {
    return { ok: false, reason: "revoked", detail: `subject ${resolved.bundleHash} is revoked` };
  }

  // 5. policy satisfied
  const policyResult = checkPolicy(policy, attestations);
  if (!policyResult.ok) {
    return { ok: false, reason: "under_policy", detail: policyResult.detail };
  }

  return { ok: true };
}
