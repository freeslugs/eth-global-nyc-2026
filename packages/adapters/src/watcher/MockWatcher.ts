import type { SubmissionWatcher, SubmissionEvent } from "@aegis/core";

/**
 * In-memory submission trigger. `emit(event)` lets a test or script fire a
 * SubmissionEvent on demand, driving the CRE workflow with no chain.
 */
export class MockWatcher implements SubmissionWatcher {
  private readonly callbacks: ((e: SubmissionEvent) => void)[] = [];

  onSubmission(cb: (e: SubmissionEvent) => void): void {
    this.callbacks.push(cb);
  }

  /** Test/demo hook: fire a submission to all registered callbacks. */
  emit(event: SubmissionEvent): void {
    for (const cb of this.callbacks) cb(event);
  }
}
