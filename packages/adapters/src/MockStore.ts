import type { Hex, SkillRecord, Verdict } from "@aegis/core";
import { loadSeededSkills, type SeededSkill } from "./seed";

/**
 * The shared in-memory registry behind the mock adapters. MockResolver reads
 * it, MockVerdictWriter writes verdicts into it, MockWatcher fires submissions
 * against it — so the whole submit→review→store→resolve→gate loop runs offline
 * with no chain. Real adapters replace each reader/writer independently.
 */
export class MockStore {
  private readonly byName = new Map<string, SkillRecord>();
  private readonly nodeToName = new Map<Hex, string>();
  private readonly revoked = new Set<string>();

  /** The original seed, kept for explorer views (status badges, fetch uris). */
  readonly seeded: SeededSkill[];

  constructor(seeded: SeededSkill[] = loadSeededSkills()) {
    this.seeded = seeded;
    for (const s of seeded) {
      this.byName.set(s.name, {
        name: s.name,
        node: s.node,
        pin: s.pin,
        owner: s.owner,
        contentUri: s.contentUri,
        verdict: s.verdict,
        attestations: s.attestations,
      });
      this.nodeToName.set(s.node, s.name);
    }
  }

  getByName(name: string): SkillRecord | undefined {
    const r = this.byName.get(name);
    return r ? { ...r } : undefined;
  }

  setVerdict(node: Hex, verdict: Verdict): void {
    const name = this.nodeToName.get(node);
    if (!name) throw new Error(`MockStore: unknown node ${node}`);
    const r = this.byName.get(name);
    if (r) r.verdict = verdict;
  }

  getVerdict(node: Hex): Verdict | undefined {
    const name = this.nodeToName.get(node);
    return name ? this.byName.get(name)?.verdict : undefined;
  }

  isRevoked(name: string): boolean {
    return this.revoked.has(name);
  }

  revoke(name: string): void {
    this.revoked.add(name);
  }

  list(): SkillRecord[] {
    return [...this.byName.values()].map((r) => ({ ...r }));
  }
}
