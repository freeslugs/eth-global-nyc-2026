import { NotImplementedError, type ReviewClient, type Verdict } from "@aegis/core";

/**
 * Chainlink Confidential AI (LLM in a TEE), two endpoints:
 *   submit(prompt, file) -> attestationId
 *   attestation(id)      -> Verdict   (poll until ready)
 * Must pass the SAME reviewContract the mock passes.
 */
export class ConfidentialAiClient implements ReviewClient {
  async submit(_prompt: string, _file: Uint8Array): Promise<string> {
    throw new NotImplementedError("TODO(chainlink): POST to Confidential AI submit endpoint");
  }

  async attestation(_id: string): Promise<Verdict> {
    throw new NotImplementedError("TODO(chainlink): poll Confidential AI attestation endpoint");
  }
}
