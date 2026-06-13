import { describe, it, expect } from "vitest";
import { gate, hashSkill, type SubmissionEvent } from "@aegis/core";
import { buildAdapters } from "./factory";
import type { MockWatcher } from "./watcher/MockWatcher";

/**
 * The whole submit→review→store→resolve→gate loop, offline on mocks:
 * MockWatcher → MockReview → MockVerdictWriter → MockResolver → gate().
 */
describe("offline submit→consume loop", () => {
  it("reviews a submitted skill and the consumer gate then sees the verdict", async () => {
    const a = buildAdapters();
    const watcher = a.watcher as MockWatcher;
    const pending = a.seed.find((s) => s.name === "pending.acme.safeskills.eth")!;

    // --- producer side: the CRE workflow reacts to a submission ---
    watcher.onSubmission((e: SubmissionEvent) => {
      void (async () => {
        const bytes = await a.fetcher.fetch(e.fetchUri);
        expect(hashSkill(bytes)).toBe(e.pin); // CRE rebinds the verdict to bytes
        const id = await a.review.submit("review", bytes);
        const verdict = await a.review.attestation(id);
        await a.verdict.writeVerdict(e.node, { ...verdict, reviewedHash: e.pin });
      })();
    });

    watcher.emit({
      node: pending.node,
      pin: pending.pin,
      fetchUri: pending.fetchUri,
      isPrivate: false,
      submitter: pending.owner,
    });
    await new Promise((r) => setTimeout(r, 0)); // let the async callback settle

    // --- consumer side: resolve + gate now sees the written verdict ---
    const record = await a.resolver.resolve(pending.name);
    expect(record.verdict?.status).toBe("pass");

    const fetched = await a.fetcher.fetch(record.contentUri!);
    const result = gate({
      record,
      fetchedHash: hashSkill(fetched),
      policy: a.policy,
      revoked: false,
      authorized: true,
    });
    expect(result.ok).toBe(true);
  });
});
