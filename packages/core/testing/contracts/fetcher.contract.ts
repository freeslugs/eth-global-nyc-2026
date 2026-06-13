import { describe, it, expect } from "vitest";
import type { SkillFetcher } from "../../src/ports";
import { hashSkill } from "../../src/hash";

export interface FetcherContractCtx {
  make: () => SkillFetcher;
  /** A uri the fetcher can resolve to SKILL.md bytes. */
  knownUri: string;
  /** The expected "sha256:<hex>" of those bytes. */
  expectedHash: string;
  /** A uri that does not resolve. */
  unknownUri: string;
}

/** The behavioral contract for SkillFetcher (Mock / File / Ipfs all pass it). */
export function fetcherContract(ctx: FetcherContractCtx): void {
  describe("SkillFetcher contract", () => {
    it("returns bytes for a known uri", async () => {
      const bytes = await ctx.make().fetch(ctx.knownUri);
      expect(bytes.byteLength).toBeGreaterThan(0);
    });

    it("fetched bytes hash to the expected pin", async () => {
      const bytes = await ctx.make().fetch(ctx.knownUri);
      expect(hashSkill(bytes)).toBe(ctx.expectedHash);
    });

    it("throws for an unknown uri", async () => {
      await expect(ctx.make().fetch(ctx.unknownUri)).rejects.toThrow();
    });
  });
}
