import { NotImplementedError, type SubmissionWatcher, type SubmissionEvent } from "@aegis/core";

/**
 * Watches `SubmissionRegistry.SubmissionPaid` on Sepolia (viem watchEvent) and
 * forwards each as a SubmissionEvent. Must pass the SAME watcherContract the
 * mock passes.
 */
export class ChainWatcher implements SubmissionWatcher {
  onSubmission(_cb: (e: SubmissionEvent) => void): void {
    throw new NotImplementedError("TODO(chain): viem watchEvent on SubmissionPaid");
  }
}
