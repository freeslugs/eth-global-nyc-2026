import { hexToBytes } from "@noble/hashes/utils";
import type { InstallSigner, AuthRequest, Hex } from "@aegis/core";
import { addressFromPrivateKey, authDigest, signDigest, verifyAuth } from "./auth";

/** A well-known Anvil/Hardhat dev key. Dev-only; never use with real funds. */
const DEFAULT_DEV_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Authorizes installs with a local key — exercises the gate's `authorized`
 * path with NO device, so the whole consumer flow is testable offline. The
 * real LedgerSigner is the same contract with on-device `authorize()`.
 */
export class LocalSigner implements InstallSigner {
  private readonly priv: Uint8Array;

  constructor(privateKey?: Hex) {
    const hex = (privateKey ?? `0x${DEFAULT_DEV_KEY}`).replace(/^0x/, "");
    this.priv = hexToBytes(hex);
  }

  async address(): Promise<Hex> {
    return addressFromPrivateKey(this.priv);
  }

  async authorize(req: AuthRequest): Promise<Hex> {
    return signDigest(authDigest(req), this.priv);
  }

  verify(req: AuthRequest, sig: Hex, signer: Hex): boolean {
    return verifyAuth(req, sig, signer);
  }
}
