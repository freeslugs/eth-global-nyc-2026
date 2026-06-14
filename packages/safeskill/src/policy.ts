import type { SkillRecord } from "@aegis/core";
import type { Decision, PolicyRule, SafeskillPolicy, SkillAssessment } from "./types";

/** A review of a skill: the official verdict OR any third-party attestation. */
interface Review {
  status: "pass" | "fail";
  /** 0–100, higher = safer. */
  securityRating: number;
  /** The hash the reviewer actually looked at — must bind to the pin. */
  reviewedHash: string;
}

/**
 * The review that counts. The official `safeskills.verdict` wins if present;
 * otherwise ANY provider's attestation counts — a passing one (best score) lets
 * a skill clear the policy without a dedicated verdict review. Failing reviews
 * are surfaced too (worst score) so a "fail" still drives the decision.
 */
function effectiveReview(record: SkillRecord): Review | undefined {
  if (record.verdict) {
    return {
      status: record.verdict.status,
      securityRating: 100 - record.verdict.riskScore,
      reviewedHash: record.verdict.reviewedHash,
    };
  }
  const atts = record.attestations ?? [];
  const passing = atts.filter((a) => a.status === "pass").sort((a, b) => b.score - a.score);
  if (passing[0]) return { status: "pass", securityRating: passing[0].score, reviewedHash: passing[0].reviewedHash };
  const failing = atts.filter((a) => a.status === "fail").sort((a, b) => a.score - b.score);
  if (failing[0]) return { status: "fail", securityRating: failing[0].score, reviewedHash: failing[0].reviewedHash };
  return undefined;
}

/**
 * Derive the policy-independent facts about a skill. This mirrors the integrity
 * invariants the core `gate()` enforces (fetched hash == pin == reviewed hash),
 * expressed as data a policy can be evaluated against.
 */
export function assess(record: SkillRecord, fetchedHash: string, revoked: boolean): SkillAssessment {
  const pinOk = fetchedHash === record.pin;
  const review = effectiveReview(record);
  const reviewedOk = review ? review.reviewedHash === record.pin : true;
  return {
    name: record.name,
    publisher: publisherOf(record.name),
    securityRating: review?.securityRating,
    verdictStatus: review?.status,
    hasVerdict: !!review,
    hashMatches: pinOk && reviewedOk,
    revoked,
  };
}

/** The ENS parent — everything after the leftmost label (e.g. acme.safeskills.eth). */
function publisherOf(name: string): string {
  const dot = name.indexOf(".");
  return dot === -1 ? name : name.slice(dot + 1);
}

/** Does a single rule match the assessment? Every specified predicate must hold. */
export function ruleMatches(rule: PolicyRule, a: SkillAssessment): boolean {
  if (rule.minSecurityRating !== undefined && !(a.securityRating !== undefined && a.securityRating >= rule.minSecurityRating)) return false;
  if (rule.maxSecurityRating !== undefined && !(a.securityRating !== undefined && a.securityRating <= rule.maxSecurityRating)) return false;
  if (rule.verdictStatus !== undefined && a.verdictStatus !== rule.verdictStatus) return false;
  if (rule.hasVerdict !== undefined && a.hasVerdict !== rule.hasVerdict) return false;
  if (rule.revoked !== undefined && a.revoked !== rule.revoked) return false;
  if (rule.publisherIn !== undefined && !rule.publisherIn.includes(a.publisher)) return false;
  if (rule.publisherNotIn !== undefined && rule.publisherNotIn.includes(a.publisher)) return false;
  return true;
}

export interface PolicyOutcome {
  decision: Decision;
  /** The rule that decided it; undefined for the integrity floor or the default. */
  rule?: PolicyRule;
  explanation: string;
}

/**
 * Evaluate a policy against an assessment. The **integrity floor** runs first and
 * is not overridable by any rule: if the bytes don't match what was reviewed, the
 * skill is blocked. After that, rules are tried top-to-bottom (first match wins),
 * then the policy default.
 */
export function evaluatePolicy(policy: SafeskillPolicy, a: SkillAssessment): PolicyOutcome {
  // Integrity floor — absolute, before any user rule.
  if (!a.hashMatches) {
    return { decision: "blocked", explanation: "content hash does not match the pinned/reviewed hash — possible tampering (integrity floor)" };
  }

  for (const rule of policy.rules) {
    if (ruleMatches(rule, a)) {
      return { decision: rule.action, rule, explanation: rule.label ?? describeRule(rule, a) };
    }
  }
  return { decision: policy.default, explanation: `no rule matched — policy default (${policy.default})` };
}

function describeRule(rule: PolicyRule, a: SkillAssessment): string {
  const parts: string[] = [];
  if (rule.minSecurityRating !== undefined) parts.push(`security ${a.securityRating} ≥ ${rule.minSecurityRating}`);
  if (rule.maxSecurityRating !== undefined) parts.push(`security ${a.securityRating} ≤ ${rule.maxSecurityRating}`);
  if (rule.verdictStatus !== undefined) parts.push(`verdict ${rule.verdictStatus}`);
  if (rule.hasVerdict === false) parts.push("no verdict");
  if (rule.hasVerdict === true) parts.push("has verdict");
  if (rule.revoked === true) parts.push("revoked");
  if (rule.publisherIn) parts.push(`publisher ∈ {${rule.publisherIn.join(", ")}}`);
  if (rule.publisherNotIn) parts.push(`publisher ∉ {${rule.publisherNotIn.join(", ")}}`);
  return (parts.length ? parts.join(" · ") : "catch-all") + ` → ${rule.action}`;
}

// ── Policy builders + presets ─────────────────────────────────────────────────

/**
 * The threshold policy the demo described: auto-approve a passing skill at or
 * above `minSecurityRating`; revoked is blocked; an unreviewed skill needs an
 * override iff `requireVerdict`; everything else needs an override.
 */
export function thresholdPolicy(minSecurityRating: number, requireVerdict = true): SafeskillPolicy {
  return {
    name: `threshold-${minSecurityRating}`,
    rules: [
      { revoked: true, action: "blocked", label: "revoked by owner" },
      {
        hasVerdict: false,
        action: requireVerdict ? "needs-override" : "auto-approve",
        label: requireVerdict ? "no verdict — requires override" : "no verdict — allowed (verdict not required)",
      },
      { minSecurityRating, verdictStatus: "pass", action: "auto-approve", label: `security ≥ ${minSecurityRating}% and verdict passes` },
    ],
    default: "needs-override",
  };
}

/** Named presets so a user can pick a stance without hand-writing rules. */
export const PRESETS: Record<string, SafeskillPolicy> = {
  /** Balanced — the demo default. ≥70% auto, below/failing/unreviewed need an override. */
  default: thresholdPolicy(70, true),

  /** Strict — a failing or unreviewed skill is blocked outright (no override), ≥90% auto. */
  strict: {
    name: "strict",
    rules: [
      { revoked: true, action: "blocked", label: "revoked by owner" },
      { verdictStatus: "fail", action: "blocked", label: "verdict FAIL — never installable" },
      { hasVerdict: false, action: "blocked", label: "unreviewed — never installable" },
      { minSecurityRating: 90, action: "auto-approve", label: "security ≥ 90%" },
    ],
    default: "needs-override",
  },

  /** Permissive — anything passing is auto-approved; only revoked/failing need a human. */
  permissive: {
    name: "permissive",
    rules: [
      { revoked: true, action: "needs-override", label: "revoked — needs a human" },
      { verdictStatus: "pass", action: "auto-approve", label: "verdict passes" },
    ],
    default: "needs-override",
  },
};

/** Validate a (possibly user-supplied) policy object. Throws on a malformed shape. */
export function validatePolicy(p: unknown): SafeskillPolicy {
  if (!p || typeof p !== "object") throw new Error("policy must be an object");
  const policy = p as Partial<SafeskillPolicy>;
  if (typeof policy.name !== "string") throw new Error("policy.name must be a string");
  if (!Array.isArray(policy.rules)) throw new Error("policy.rules must be an array");
  const actions: Decision[] = ["auto-approve", "needs-override", "blocked"];
  if (!policy.default || !actions.includes(policy.default)) throw new Error(`policy.default must be one of ${actions.join(", ")}`);
  policy.rules.forEach((r, i) => {
    if (!r || typeof r !== "object") throw new Error(`policy.rules[${i}] must be an object`);
    if (!actions.includes((r as PolicyRule).action)) throw new Error(`policy.rules[${i}].action must be one of ${actions.join(", ")}`);
  });
  return policy as SafeskillPolicy;
}
