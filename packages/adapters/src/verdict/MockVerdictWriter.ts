import type { VerdictWriter, Hex, Verdict } from "@aegis/core";
import type { MockStore } from "../MockStore";

/**
 * Records the verdict in the shared MockStore so MockResolver serves it back —
 * this is the link that lets the submit→consume loop close offline.
 */
export class MockVerdictWriter implements VerdictWriter {
  constructor(private readonly store: MockStore) {}

  async writeVerdict(node: Hex, v: Verdict): Promise<void> {
    this.store.setVerdict(node, v);
  }
}
