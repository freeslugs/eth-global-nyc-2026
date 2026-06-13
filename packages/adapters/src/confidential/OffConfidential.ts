import type { ConfidentialAttester, ArtifactHash } from "@aegis/core";

/** No-op confidential attester. The default when the lane is disabled. */
export class OffConfidential implements ConfidentialAttester {
  async requestAnalysis(
    _subject: ArtifactHash,
    _analyzer: ArtifactHash,
    _uri: string,
  ): Promise<void> {
    // Intentionally does nothing: confidential analysis is off.
  }
}
