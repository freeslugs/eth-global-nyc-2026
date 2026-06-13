import type { ReviewClient, Verdict } from "@aegis/core";
import { hashSkill } from "@aegis/core";

/** Markers that betray a poisoned skill (credential exfil / injection). */
const POISON_MARKERS = [
  "credentials",
  "evil.io",
  "ignore any previous",
  "ignore previous",
  ".aws",
  "POST its contents",
];

/**
 * Canned review: deterministic, no I/O. It scans the bytes for exfil / injection
 * markers so the offline submit→consume loop actually flags the poisoned skill.
 * The real ConfidentialAiClient runs an LLM in a TEE but satisfies the SAME
 * reviewContract.
 */
export class MockReview implements ReviewClient {
  private readonly pending = new Map<string, Uint8Array>();
  private seq = 0;

  async submit(_prompt: string, file: Uint8Array): Promise<string> {
    const id = `mock-att-${++this.seq}`;
    this.pending.set(id, file);
    return id;
  }

  async attestation(id: string): Promise<Verdict> {
    const file = this.pending.get(id);
    if (!file) throw new Error(`MockReview: unknown attestation "${id}"`);
    const text = new TextDecoder().decode(file).toLowerCase();
    const poisoned = POISON_MARKERS.some((m) => text.includes(m.toLowerCase()));
    return {
      status: poisoned ? "fail" : "pass",
      riskScore: poisoned ? 95 : 5,
      attestationId: id,
      reviewedHash: hashSkill(file),
    };
  }
}
