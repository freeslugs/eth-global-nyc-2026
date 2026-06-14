import type { SkillRecord, Verdict } from "@aegis/core";

/**
 * The three things a policy can decide for a skill.
 *  - auto-approve   → install with no human in the loop.
 *  - needs-override → installable ONLY with a Ledger signature (a present human takes responsibility).
 *  - blocked        → never installable; a signature cannot override it.
 */
export type Decision = "auto-approve" | "needs-override" | "blocked";

/**
 * The facts the engine derives about a skill, independent of any policy. A
 * policy is a pure function of this. (Computed from the ENS record + the locally
 * re-hashed bytes + revocation state.)
 */
export interface SkillAssessment {
  name: string;
  publisher: string;
  /** 0–100, higher = safer (`100 - verdict.riskScore`). Undefined with no verdict. */
  securityRating?: number;
  /** The verdict status on the ENS name, if any. */
  verdictStatus?: "pass" | "fail";
  /** Does the ENS name carry a verdict at all? */
  hasVerdict: boolean;
  /**
   * Does the locally re-hashed file match the pinned hash AND the reviewed hash?
   * False means the bytes are not what was reviewed — tampering. This is an
   * **integrity floor**: a false value is always blocked, before policy runs.
   */
  hashMatches: boolean;
  /** Has the owner revoked this skill? */
  revoked: boolean;
}

/**
 * One policy rule. A rule MATCHES when every predicate it specifies holds (AND).
 * Omitted predicates are ignored. A rule with no predicates matches everything
 * (a catch-all). Rules are evaluated top-to-bottom; the first match wins.
 *
 * This is plain JSON — it serializes into the config and can be hand-edited or
 * shipped as a preset, so every user defines their own policy.
 */
export interface PolicyRule {
  /** securityRating ≥ this (skills with no verdict never match a rating predicate). */
  minSecurityRating?: number;
  /** securityRating ≤ this. */
  maxSecurityRating?: number;
  /** verdict status equals this. */
  verdictStatus?: "pass" | "fail";
  /** whether a verdict is present. */
  hasVerdict?: boolean;
  /** revocation state. */
  revoked?: boolean;
  /** publisher (ENS parent) is in this allowlist. */
  publisherIn?: string[];
  /** publisher is NOT in this blocklist. */
  publisherNotIn?: string[];
  /** the decision to apply when this rule matches. */
  action: Decision;
  /** optional human-readable reason shown in explanations. */
  label?: string;
}

/**
 * A user's policy: an ordered ruleset plus a fallback. Fully customizable and
 * serializable — this is the thing onboarding persists and the CLI/SDK never
 * hardcodes. The integrity floor (hash mismatch ⇒ blocked) is enforced by the
 * engine regardless of the rules here.
 */
export interface SafeskillPolicy {
  name: string;
  rules: PolicyRule[];
  /** Applied when no rule matches. */
  default: Decision;
}

/** Which signer authorizes a Ledger override during onboarding. */
export type SignerKind = "ledger" | "local" | "none";

/** Where skill verdicts are read from. `demo` is self-contained; `ens` hits Sepolia. */
export type ResolverKind = "demo" | "ens";

/** Persisted onboarding state (written to ~/.safeskill/config.json). */
export interface SafeskillConfig {
  signer: SignerKind;
  /** Captured at onboard time when a signer is hooked up. */
  signerAddress?: string;
  resolver: ResolverKind;
  /** The full, user-owned policy. */
  policy: SafeskillPolicy;
  /** ISO timestamp the config was written. */
  createdAt: string;
}

/** The full result of checking one skill against the live registry + policy. */
export interface SkillDecision {
  name: string;
  decision: Decision;
  /** 0–100, higher = safer. Undefined when there is no verdict to derive it from. */
  securityRating?: number;
  /** Human-readable one-liner explaining the decision. */
  explanation: string;
  /** The derived facts the policy was evaluated against. */
  assessment: SkillAssessment;
  /** The rule that decided this (undefined ⇒ integrity floor or policy default). */
  matchedRule?: PolicyRule;
  /** The resolved ENS record (pin, verdict, owner, node). */
  record: SkillRecord;
  /** The hash we computed locally from the fetched bytes. */
  fetchedHash: string;
}

/** The outcome of `use()` — check + (maybe) override + (maybe) install. */
export interface UseResult {
  decision: SkillDecision;
  /** True ONLY if the skill was actually written to disk. */
  installed: boolean;
  /** True if a Ledger signature was required and obtained to get here. */
  overridden: boolean;
  /** Where it was installed, when installed. */
  path?: string;
  /** Why it was not installed (blocked, override failed/declined, no signer, …). */
  error?: string;
}

/** A catalog entry — the hardcoded "on-chain registry" listing for the demo. */
export interface RegistrySkill {
  name: string;
  title: string;
  description: string;
  publisher: string;
}

/** Re-export the verdict shape so SDK consumers don't need a second import. */
export type { Verdict };
