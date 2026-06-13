import { describe, it, expect } from "vitest";
import type { SkillResolver } from "../../src/ports";

export interface ResolverContractCtx {
  make: () => SkillResolver;
  /** A name the resolver knows, with a pin. */
  knownName: string;
  /** A name the resolver does not know. */
  unknownName: string;
  /** A known name that has a verdict written. */
  nameWithVerdict: string;
}

/**
 * The behavioral contract for SkillResolver. Both MockResolver (today) and
 * EnsV2Resolver (later) must pass this *same* suite — that is what guarantees
 * they are interchangeable and lets each be built in isolation.
 */
export function resolverContract(ctx: ResolverContractCtx): void {
  describe("SkillResolver contract", () => {
    it("returns a record with a pin for a known name", async () => {
      const rec = await ctx.make().resolve(ctx.knownName);
      expect(rec.name).toBe(ctx.knownName);
      expect(rec.pin).toMatch(/^sha256:[0-9a-f]+$/);
      expect(rec.owner).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("throws for an unknown name", async () => {
      await expect(ctx.make().resolve(ctx.unknownName)).rejects.toThrow();
    });

    it("includes the verdict when one exists", async () => {
      const rec = await ctx.make().resolve(ctx.nameWithVerdict);
      expect(rec.verdict).toBeDefined();
      expect(["pass", "fail"]).toContain(rec.verdict?.status);
    });
  });
}
