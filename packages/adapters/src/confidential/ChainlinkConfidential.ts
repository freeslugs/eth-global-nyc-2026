import { NotImplementedError, type ConfidentialAttester, type ArtifactHash } from "@aegis/core";

/**
 * Requests a confidential analysis verdict through Chainlink Functions running
 * an analyzer program inside a TEE, posting the signed verdict back on-chain.
 * Stubbed for now.
 */
export class ChainlinkConfidential implements ConfidentialAttester {
  async requestAnalysis(
    _subject: ArtifactHash,
    _analyzer: ArtifactHash,
    _uri: string,
  ): Promise<void> {
    throw new NotImplementedError(
      "TODO(chainlink): send Chainlink Functions request running the analyzer in a TEE",
    );
  }
}
