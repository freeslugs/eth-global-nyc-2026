import type { Hex, SkillRecord, Verdict, AuthRequest, SubmissionEvent } from "./types";

/**
 * Ports = the typed seams between every component. Each port has a MOCK adapter
 * (the offline default) and, later, a REAL adapter — both proven against the
 * same contract test (see `@aegis/core/testing`). Nothing outside an adapter
 * calls a chain / SDK / device directly, so each port is built and tested in
 * total isolation by a different person.
 */

// ---------------------------------------------------------------------------
// consumer side
// ---------------------------------------------------------------------------

/** ENS v2 read: resolve a skill name to its pin + verdict + owner. */
export interface SkillResolver {
  resolve(name: string): Promise<SkillRecord>;
}

/** Pulls SKILL.md bytes from IPFS / URL / file. */
export interface SkillFetcher {
  fetch(uri: string): Promise<Uint8Array>;
}

/** Ledger (or a dev key): authorizes the install with a human-present signature. */
export interface InstallSigner {
  address(): Promise<Hex>;
  /** Device shows the request detail; returns a signature. */
  authorize(req: AuthRequest): Promise<Hex>;
  verify(req: AuthRequest, sig: Hex, signer: Hex): boolean;
}

// ---------------------------------------------------------------------------
// producer / CRE side
// ---------------------------------------------------------------------------

/** Watches the on-chain SubmissionPaid event (the CRE trigger). */
export interface SubmissionWatcher {
  onSubmission(cb: (e: SubmissionEvent) => void): void;
}

/** Chainlink Confidential AI — the LLM-in-a-TEE review (two endpoints). */
export interface ReviewClient {
  /** -> attestationId */
  submit(prompt: string, file: Uint8Array): Promise<string>;
  /** -> verdict (poll until ready) */
  attestation(id: string): Promise<Verdict>;
}

/** Writes safeskills.verdict to the ENS name (CRE-only via special-access rule). */
export interface VerdictWriter {
  writeVerdict(node: Hex, v: Verdict): Promise<void>;
}
