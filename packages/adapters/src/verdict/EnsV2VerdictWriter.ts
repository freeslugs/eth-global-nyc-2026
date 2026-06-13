import { NotImplementedError, type VerdictWriter, type Hex, type Verdict } from "@aegis/core";

/**
 * Writes `safeskills.verdict` to the ENS v2 name via the CRE special-access
 * grant (only callable by the CRE/forwarder). Must pass the SAME
 * verdictWriterContract the mock passes.
 */
export class EnsV2VerdictWriter implements VerdictWriter {
  async writeVerdict(_node: Hex, _v: Verdict): Promise<void> {
    throw new NotImplementedError("TODO(ens): write safeskills.verdict via CRE special-access rule");
  }
}
