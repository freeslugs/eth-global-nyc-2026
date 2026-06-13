import { describe, it, expect } from "vitest";
import type { ReviewClient } from "../../src/ports";

export interface ReviewContractCtx {
  make: () => ReviewClient;
  prompt: string;
  /** Bytes to send for review. */
  file: Uint8Array;
}

/** The behavioral contract for ReviewClient (MockReview / ConfidentialAiClient). */
export function reviewContract(ctx: ReviewContractCtx): void {
  describe("ReviewClient contract", () => {
    it("submit() returns a non-empty attestation id", async () => {
      const id = await ctx.make().submit(ctx.prompt, ctx.file);
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("attestation(id) returns a well-formed verdict", async () => {
      const client = ctx.make();
      const id = await client.submit(ctx.prompt, ctx.file);
      const v = await client.attestation(id);
      expect(["pass", "fail"]).toContain(v.status);
      expect(v.riskScore).toBeGreaterThanOrEqual(0);
      expect(v.riskScore).toBeLessThanOrEqual(100);
      expect(v.attestationId).toBe(id);
    });
  });
}
