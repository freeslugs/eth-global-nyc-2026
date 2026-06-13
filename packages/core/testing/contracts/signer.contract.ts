import { describe, it, expect } from "vitest";
import type { InstallSigner } from "../../src/ports";
import type { AuthRequest } from "../../src/types";

export interface SignerContractCtx {
  make: () => InstallSigner;
  /** A representative AuthRequest the signer will authorize. */
  request: AuthRequest;
}

/** The behavioral contract for InstallSigner (LocalSigner / LedgerSigner). */
export function signerContract(ctx: SignerContractCtx): void {
  describe("InstallSigner contract", () => {
    it("address() returns a 0x address", async () => {
      const addr = await ctx.make().address();
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("authorize() then verify() round-trips", async () => {
      const signer = ctx.make();
      const addr = await signer.address();
      const sig = await signer.authorize(ctx.request);
      expect(signer.verify(ctx.request, sig, addr)).toBe(true);
    });

    it("verify() rejects a tampered request", async () => {
      const signer = ctx.make();
      const addr = await signer.address();
      const sig = await signer.authorize(ctx.request);
      const tampered: AuthRequest = {
        ...ctx.request,
        verdict: { ...ctx.request.verdict, riskScore: ctx.request.verdict.riskScore + 50 },
      };
      expect(signer.verify(tampered, sig, addr)).toBe(false);
    });
  });
}
