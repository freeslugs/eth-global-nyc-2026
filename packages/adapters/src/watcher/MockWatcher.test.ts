import { watcherContract } from "@aegis/core/testing";
import type { SubmissionEvent, SubmissionWatcher } from "@aegis/core";
import { loadSeededSkills } from "../seed";
import { MockWatcher } from "./MockWatcher";

const pending = loadSeededSkills().find((s) => s.name === "pending.acme.safeskills.eth")!;

const sample: SubmissionEvent = {
  node: pending.node,
  pin: pending.pin,
  fetchUri: pending.fetchUri,
  isPrivate: false,
  submitter: pending.owner,
};

watcherContract({
  make: () => new MockWatcher(),
  fire: (w: SubmissionWatcher, e) => (w as MockWatcher).emit(e),
  sample,
});
