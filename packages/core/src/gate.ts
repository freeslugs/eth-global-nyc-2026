import type { GateResult, Policy, SkillRecord, SkillHash } from "./types";

export interface GateInput {
  record: SkillRecord;
  /** Hash of the bytes the consumer actually fetched. */
  fetchedHash: SkillHash;
  policy: Policy;
  revoked: boolean;
  /** Ledger signature verified == true. */
  authorized: boolean;
}

/**
 * The pure gate. The caller does all fetching / resolving / signing and passes
 * the results in. No network, no chain, no fs, no device.
 *
 * Order (first failure wins):
 *   1. fetchedHash === record.pin          else hash_mismatch  (tamper / wrong content)
 *   2. requireVerdict && no verdict        ->   no_verdict
 *   3. verdict.reviewedHash === record.pin  else hash_mismatch  (verdict must bind to bytes)
 *   4. verdict.status === "pass"           else verdict_fail
 *   5. verdict.riskScore <= maxRiskScore   else under_policy
 *   6. !revoked                            else revoked
 *   7. authorized                          else unauthorized    (Ledger gate)
 */
export function gate(input: GateInput): GateResult {
  const { record, fetchedHash, policy, revoked, authorized } = input;

  // 1. fetched content matches the pin
  if (fetchedHash !== record.pin) {
    return {
      ok: false,
      reason: "hash_mismatch",
      detail: `pinned ${record.pin}, fetched ${fetchedHash}`,
    };
  }

  // 2. verdict present when required
  const verdict = record.verdict;
  if (policy.requireVerdict && !verdict) {
    return { ok: false, reason: "no_verdict", detail: `no verdict on ${record.name}` };
  }

  if (verdict) {
    // 3. verdict binds to this exact content
    if (verdict.reviewedHash !== record.pin) {
      return {
        ok: false,
        reason: "hash_mismatch",
        detail: `verdict reviewed ${verdict.reviewedHash}, pin is ${record.pin}`,
      };
    }

    // 4. verdict passed
    if (verdict.status !== "pass") {
      return { ok: false, reason: "verdict_fail", detail: `riskScore ${verdict.riskScore}` };
    }

    // 5. within risk policy
    if (verdict.riskScore > policy.maxRiskScore) {
      return {
        ok: false,
        reason: "under_policy",
        detail: `riskScore ${verdict.riskScore} > max ${policy.maxRiskScore}`,
      };
    }
  }

  // 6. not revoked
  if (revoked) {
    return { ok: false, reason: "revoked", detail: `${record.name} is revoked` };
  }

  // 7. human-authorized on the Ledger
  if (!authorized) {
    return { ok: false, reason: "unauthorized", detail: "install not authorized by signer" };
  }

  return { ok: true };
}
