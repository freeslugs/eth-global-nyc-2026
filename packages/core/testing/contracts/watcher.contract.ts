import { describe, it, expect } from "vitest";
import type { SubmissionWatcher } from "../../src/ports";
import type { SubmissionEvent } from "../../src/types";

export interface WatcherContractCtx {
  make: () => SubmissionWatcher;
  /** Triggers a submission (MockWatcher.emit today, a tx later). */
  fire: (w: SubmissionWatcher, e: SubmissionEvent) => void | Promise<void>;
  sample: SubmissionEvent;
}

/** The behavioral contract for SubmissionWatcher (Mock / Chain). */
export function watcherContract(ctx: WatcherContractCtx): void {
  describe("SubmissionWatcher contract", () => {
    it("delivers a submission to the callback", async () => {
      const w = ctx.make();
      const received = new Promise<SubmissionEvent>((resolve) => w.onSubmission(resolve));
      await ctx.fire(w, ctx.sample);
      const got = await received;
      expect(got.pin).toBe(ctx.sample.pin);
      expect(got.node).toBe(ctx.sample.node);
    });
  });
}
