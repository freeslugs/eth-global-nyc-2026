import type { Signer, Hex } from "@aegis/core";
import { privateKeyToAccount } from "viem/accounts";

/** A well-known Anvil/Hardhat dev key. Dev-only; never use with real funds. */
const DEFAULT_DEV_KEY: Hex =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** Signs with a local viem account derived from a private key. */
export class LocalSigner implements Signer {
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(privateKey: Hex = DEFAULT_DEV_KEY) {
    this.account = privateKeyToAccount(privateKey);
  }

  async address(): Promise<Hex> {
    return this.account.address;
  }

  async sign(msg: Uint8Array): Promise<Hex> {
    return this.account.signMessage({ message: { raw: msg } });
  }
}
