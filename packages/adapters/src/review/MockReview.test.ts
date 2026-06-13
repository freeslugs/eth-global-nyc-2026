import { describe, it, expect } from "vitest";
import { reviewContract } from "@aegis/core/testing";
import { MockReview } from "./MockReview";
import { fixtureContent } from "../fixtures";

const clean = new Uint8Array(fixtureContent["clean.md"]!);
const poisoned = new Uint8Array(fixtureContent["poisoned.md"]!);

reviewContract({ make: () => new MockReview(), prompt: "review this skill", file: clean });

describe("MockReview scoring", () => {
  it("passes a clean skill", async () => {
    const r = new MockReview();
    const v = await r.attestation(await r.submit("p", clean));
    expect(v.status).toBe("pass");
  });

  it("fails a poisoned skill", async () => {
    const r = new MockReview();
    const v = await r.attestation(await r.submit("p", poisoned));
    expect(v.status).toBe("fail");
  });
});
