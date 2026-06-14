/**
 * Aegis / Safe Skills domain types. Pure data; no I/O, no chain, no fs.
 *
 * A "skill" is, for the demo, a single SKILL.md file (instructions an agent
 * loads into context). A poisoned skill hides an injected instruction; the gate
 * catches it before the agent ever loads it.
 */

export type Hex = `0x${string}`;

/** Canonical skill hash form: "sha256:<hex>" of the SKILL.md bytes. */
export type SkillHash = string;

/** A skill record as resolved from ENS. */
export interface SkillRecord {
  name: string;
  /** ENS namehash of the skill name. */
  node: Hex;
  /** safeskills.pin — the authoritative content hash, set by the org. */
  pin: SkillHash;
  /** safeskills.verdict — written by the Chainlink CRE (absent until reviewed). */
  verdict?: Verdict;
  /**
   * safeskills.attestation.<provider> records — one per third-party provider.
   * The Chainlink CRE is the first provider (`chainlink.eth`); orgs can add
   * others (e.g. an internal `my-local-verifier.eth`). Empty until reviewed.
   */
  attestations?: Attestation[];
  /** Resolved from contenthash (public skills only). */
  contentUri?: string;
  /** ENS name owner (the org). */
  owner: Hex;
}

/** The review verdict produced by the LLM inside the Chainlink TEE. */
export interface Verdict {
  status: "pass" | "fail";
  /** 0 (safe) .. 100 (dangerous). */
  riskScore: number;
  /** Chainlink Confidential AI attestation id. */
  attestationId: string;
  /** The hash the TEE actually reviewed — binds the verdict to specific bytes. */
  reviewedHash: SkillHash;
}

/**
 * A single provider's signed result for a skill, stored under the text record
 * `safeskills.attestation.<provider>`. Each provider (a third-party vendor named
 * by its own ENS name) writes ONLY its own slot — the org delegates write access
 * per-key via the resolver. Consumers read the providers they trust and apply
 * their policy (future: "trust acme when score > 70, else request a Ledger
 * bypass"). The score lives in the record so the CLI/SDK can query it.
 */
export interface Attestation {
  /** The provider's ENS name, e.g. "chainlink.eth". The record-key namespace. */
  provider: string;
  status: "pass" | "fail";
  /** 0..100, higher = safer / more trusted (the headline score). */
  score: number;
  /** Provider-specific attestation id (Chainlink CRE id, CLI run id, …). */
  attestationId: string;
  /** The hash the provider reviewed — binds the attestation to specific bytes. */
  reviewedHash: SkillHash;
}

/** Consumer-side gate policy. */
export interface Policy {
  requireVerdict: boolean;
  /** e.g. 30 — block anything riskier. */
  maxRiskScore: number;
}

/** What the human physically signs on the Ledger to authorize an install. */
export interface AuthRequest {
  node: Hex;
  name: string;
  pin: SkillHash;
  verdict: Verdict;
}

/** Emitted by SubmissionRegistry.SubmissionPaid — the CRE trigger. */
export interface SubmissionEvent {
  node: Hex;
  /** Org-committed content hash. */
  pin: SkillHash;
  /** Where the CRE pulls the skill from. */
  fetchUri: string;
  isPrivate: boolean;
  submitter: Hex;
}

export type GateFailureReason =
  | "hash_mismatch"
  | "no_verdict"
  | "verdict_fail"
  | "under_policy"
  | "revoked"
  | "unauthorized";

export type GateResult =
  | { ok: true }
  | {
      ok: false;
      reason: GateFailureReason;
      detail?: string;
    };
