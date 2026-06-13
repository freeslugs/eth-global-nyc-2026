import { verdictWriterContract } from "@aegis/core/testing";
import type { Verdict } from "@aegis/core";
import { MockStore } from "../MockStore";
import { loadSeededSkills } from "../seed";
import { MockVerdictWriter } from "./MockVerdictWriter";

const store = new MockStore();
const pending = loadSeededSkills().find((s) => s.name === "pending.acme.safeskills.eth")!;

const verdict: Verdict = {
  status: "pass",
  riskScore: 10,
  attestationId: "att-test-1",
  reviewedHash: pending.pin,
};

verdictWriterContract({
  make: () => new MockVerdictWriter(store),
  node: pending.node,
  verdict,
  readBack: async (node) => store.getVerdict(node),
});
