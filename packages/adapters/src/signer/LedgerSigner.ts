import { NotImplementedError, type InstallSigner, type AuthRequest, type Hex } from "@aegis/core";
import { verifyAuth } from "./auth";

/**
 * Authorizes installs on a hardware Ledger: the device clear-signs the
 * AuthRequest (shows name + verdict), and `verify()` recovers the signer.
 * `verify()` shares `auth.ts` with LocalSigner, so it works today; only
 * `address()`/`authorize()` need the device. Must pass the signerContract.
 */
export class LedgerSigner implements InstallSigner {
  async address(): Promise<Hex> {
    throw new NotImplementedError("TODO(ledger): derive address via @ledgerhq/hw-app-eth");
  }

  async authorize(_req: AuthRequest): Promise<Hex> {
    throw new NotImplementedError("TODO(ledger): clear-sign the AuthRequest on device");
  }

  verify(req: AuthRequest, sig: Hex, signer: Hex): boolean {
    return verifyAuth(req, sig, signer);
  }
}
