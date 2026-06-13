import type { Attestation, Policy } from "./types";

export interface PolicyCheckResult {
  ok: boolean;
  detail?: string;
}

/**
 * Evaluate the trust policy against the gathered attestations.
 *
 * Provenance and revocation are checked by the verify() engine before this
 * runs; here we only enforce the remaining policy knobs:
 *   - `minReviews`: count of "review" attestations from trusted attestors
 *     (any attestor if `trustedAttestors` is omitted).
 *   - `trustedAnalyzers`: if a "confidential" attestation is present, its
 *     analyzer must be in the trusted set.
 */
export function checkPolicy(policy: Policy, attestations: Attestation[]): PolicyCheckResult {
  const isTrustedAttestor = (a: Attestation): boolean => {
    if (!policy.trustedAttestors || policy.trustedAttestors.length === 0) return true;
    return policy.trustedAttestors.includes(a.attestor);
  };

  const reviews = attestations.filter((a) => a.kind === "review" && isTrustedAttestor(a));
  if (reviews.length < policy.minReviews) {
    return {
      ok: false,
      detail: `requires ${policy.minReviews} review(s), found ${reviews.length}`,
    };
  }

  if (policy.trustedAnalyzers && policy.trustedAnalyzers.length > 0) {
    const confidential = attestations.filter((a) => a.kind === "confidential");
    for (const c of confidential) {
      if (!c.analyzer || !policy.trustedAnalyzers.includes(c.analyzer)) {
        return {
          ok: false,
          detail: `confidential verdict from untrusted analyzer ${c.analyzer ?? "<none>"}`,
        };
      }
    }
  }

  return { ok: true };
}
