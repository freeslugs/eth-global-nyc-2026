import { describe } from "vitest";
import { signerContract } from "@aegis/core/testing";
import type { AuthRequest } from "@aegis/core";
import { loadSeededSkills } from "../seed";
import { LedgerSigner } from "./LedgerSigner";

/**
 * Hardware e2e: runs the InstallSigner contract against a PHYSICAL Ledger.
 * Gated behind LEDGER_E2E so CI (and `pnpm test`) stay green with no device —
 * the contract for the software path is already covered by LocalSigner.test.ts.
 *
 * To run against a real Flex/Stax:
 *   LEDGER_E2E=1 pnpm --filter @aegis/adapters test LedgerSigner
 * (Node 24, Ethereum app open, unplug/replug if the device returns 0x6511.)
 */
const RUN_E2E = !!process.env.LEDGER_E2E;

const weather = loadSeededSkills().find((s) => s.name === "weather.acme.safeskills.eth")!;

const request: AuthRequest = {
  node: weather.node,
  name: weather.name,
  pin: weather.pin,
  verdict: weather.verdict!,
};

describe.skipIf(!RUN_E2E)("LedgerSigner (hardware e2e)", () => {
  signerContract({
    make: () => new LedgerSigner(process.env.AEGIS_LEDGER_PATH),
    request,
  });
});
