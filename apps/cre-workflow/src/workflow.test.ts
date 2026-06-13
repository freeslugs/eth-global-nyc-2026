import { describe, it, expect } from "vitest";
import { buildAdapters } from "@aegis/adapters";
import type { SubmissionEvent } from "@aegis/core";
import { reviewSubmission } from "./workflow";

function deps() {
  const a = buildAdapters();
  return { a, d: { fetcher: a.fetcher, review: a.review, verdict: a.verdict } };
}

function event(a: ReturnType<typeof buildAdapters>, name: string): SubmissionEvent {
  const s = a.seed.find((x) => x.name === name)!;
  return { node: s.node, pin: s.pin, fetchUri: s.fetchUri, isPrivate: false, submitter: s.owner };
}

describe("reviewSubmission (mock CRE)", () => {
  it("passes a clean skill and writes the verdict", async () => {
    const { a, d } = deps();
    const v = await reviewSubmission(d, event(a, "pending.acme.safeskills.eth"));
    expect(v.status).toBe("pass");
    expect((await a.resolver.resolve("pending.acme.safeskills.eth")).verdict?.status).toBe("pass");
  });

  it("fails a poisoned skill", async () => {
    const { a, d } = deps();
    const v = await reviewSubmission(d, event(a, "exfil.acme.safeskills.eth"));
    expect(v.status).toBe("fail");
  });

  it("fails fast on a pin mismatch without reviewing", async () => {
    const { a, d } = deps();
    const e = { ...event(a, "pending.acme.safeskills.eth"), pin: "sha256:deadbeef" };
    const v = await reviewSubmission(d, e);
    expect(v).toMatchObject({ status: "fail", riskScore: 100, attestationId: "" });
  });
});
