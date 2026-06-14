import type { SkillRecord } from "@aegis/core";
import { assess, evaluatePolicy } from "./policy";
import type { SafeskillPolicy, SkillDecision } from "./types";

/**
 * Assess a skill (derive the facts) and run the user's policy over them.
 * The policy is fully customizable; this function contains no hardcoded
 * thresholds — only the integrity floor lives in `evaluatePolicy`.
 */
export function decide(input: {
  record: SkillRecord;
  fetchedHash: string;
  revoked: boolean;
  policy: SafeskillPolicy;
}): SkillDecision {
  const { record, fetchedHash, revoked, policy } = input;
  const assessment = assess(record, fetchedHash, revoked);
  const outcome = evaluatePolicy(policy, assessment);
  return {
    name: record.name,
    decision: outcome.decision,
    securityRating: assessment.securityRating,
    explanation: outcome.explanation,
    assessment,
    matchedRule: outcome.rule,
    record,
    fetchedHash,
  };
}
