import { NotImplementedError, type Signer, type Hex } from "@aegis/core";

/**
 * Signs with a hardware Ledger device (the trust key, deliberately separate
 * from the publish credential). Stubbed for now.
 */
export class LedgerSigner implements Signer {
  async address(): Promise<Hex> {
    throw new NotImplementedError("TODO(ledger): derive address via @ledgerhq/hw-app-eth");
  }

  async sign(_msg: Uint8Array): Promise<Hex> {
    throw new NotImplementedError("TODO(ledger): sign on-device with @ledgerhq/hw-app-eth");
  }
}
