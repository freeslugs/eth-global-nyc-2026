import type { Resolver, ResolvedRecord } from "@aegis/core";
import type { RegistrySeed, SeedRecord } from "../seed";

/** Resolves names from the seeded registry. ENS replaces this later. */
export class MockResolver implements Resolver {
  private readonly byName: Map<string, SeedRecord>;

  constructor(seed: RegistrySeed) {
    this.byName = new Map(seed.records.map((r) => [r.name, r]));
  }

  async resolve(name: string): Promise<ResolvedRecord> {
    const rec = this.byName.get(name);
    if (!rec) throw new Error(`MockResolver: unknown name "${name}"`);
    const { name: n, bundleHash, manifestHash, publisher, policyRef, logRef } = rec;
    return { name: n, bundleHash, manifestHash, publisher, policyRef, logRef };
  }

  /** Convenience for the explorer: the full seeded records (with status). */
  list(): SeedRecord[] {
    return [...this.byName.values()];
  }
}
