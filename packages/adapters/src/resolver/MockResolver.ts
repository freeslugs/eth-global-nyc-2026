import type { SkillResolver, SkillRecord } from "@aegis/core";
import type { MockStore } from "../MockStore";

/** Resolves names from the shared in-memory store. ENS replaces this later. */
export class MockResolver implements SkillResolver {
  constructor(private readonly store: MockStore) {}

  async resolve(name: string): Promise<SkillRecord> {
    const rec = this.store.getByName(name);
    if (!rec) throw new Error(`MockResolver: unknown name "${name}"`);
    return rec;
  }
}
