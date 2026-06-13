import { describe, it, expect } from "vitest";
import type { VerdictWriter } from "../../src/ports";
import type { Hex, Verdict } from "../../src/types";

export interface VerdictWriterContractCtx {
  make: () => VerdictWriter;
  node: Hex;
  verdict: Verdict;
  /** How a test reads the verdict back (mock store today, resolver later). */
  readBack: (node: Hex) => Promise<Verdict | undefined>;
}

/** The behavioral contract for VerdictWriter (Mock / EnsV2). */
export function verdictWriterContract(ctx: VerdictWriterContractCtx): void {
  describe("VerdictWriter contract", () => {
    it("writeVerdict persists a verdict readable for the node", async () => {
      await ctx.make().writeVerdict(ctx.node, ctx.verdict);
      const got = await ctx.readBack(ctx.node);
      expect(got?.status).toBe(ctx.verdict.status);
      expect(got?.reviewedHash).toBe(ctx.verdict.reviewedHash);
    });
  });
}
