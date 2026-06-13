import { describe, it, expect } from "vitest";
import { reviewContract } from "@aegis/core/testing";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixturesDir } from "../seed";
import { MockReview } from "./MockReview";

const clean = new Uint8Array(readFileSync(join(fixturesDir, "clean.md")));
const poisoned = new Uint8Array(readFileSync(join(fixturesDir, "poisoned.md")));

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
