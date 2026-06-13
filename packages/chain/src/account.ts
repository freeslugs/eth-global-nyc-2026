import { privateKeyToAccount, toAccount } from "viem/accounts";
import { hashMessage, serializeTransaction } from "viem";
import type { Account, LocalAccount } from "viem";

/**
 * The swappable signing seam for ON-CHAIN transactions (policies, ENS writes,
 * Chainlink calls). The unit viem swaps is the `Account`, NOT the WalletClient —
 * makeWalletClient just delegates signing to whatever this returns, so flipping
 * `AEGIS_SIGNER` changes WHERE the key lives with zero downstream change.
 *
 *   AEGIS_SIGNER=local   -> in-process key from AEGIS_PRIVATE_KEY (dev burner)
 *   AEGIS_SIGNER=ledger  -> a physical Ledger over USB-HID (node only)
 *
 * Mirrors the InstallSigner factory in @aegis/adapters, keyed off the SAME flag
 * so "which signer backend" is one decision across the whole app.
 */
export interface AccountOptions {
  /** Override AEGIS_SIGNER (`local` | `ledger`). */
  signer?: string;
  /** Override AEGIS_PRIVATE_KEY (local mode only). */
  privateKey?: `0x${string}`;
  /** BIP-44 path for the Ledger account. Default: account 0. */
  ledgerPath?: string;
}

const DEFAULT_LEDGER_PATH = "44'/60'/0'/0/0";

/**
 * Build the signing account from env. Returns `undefined` when no signer is
 * configured (local mode with no key) so read-only flows still work — callers
 * that send txs must assert a non-undefined account.
 */
export async function makeAccount(
  env: NodeJS.ProcessEnv = process.env,
  opts: AccountOptions = {},
): Promise<Account | undefined> {
  const signer = opts.signer ?? env.AEGIS_SIGNER ?? "local";

  if (signer === "ledger") {
    return makeLedgerAccount(opts.ledgerPath ?? env.AEGIS_LEDGER_PATH ?? DEFAULT_LEDGER_PATH);
  }

  const privateKey = opts.privateKey ?? (env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined);
  return privateKey ? makeLocalAccount(privateKey) : undefined;
}

/** In-process key. Signs without a device — dev/CI only. */
export function makeLocalAccount(privateKey: `0x${string}`): LocalAccount {
  return privateKeyToAccount(privateKey);
}

/**
 * A viem Account backed by a physical Ledger. signTransaction / signTypedData /
 * signMessage are forwarded to the device (the user confirms on-screen). Lazily
 * imports the @ledgerhq libs so `local` mode needs no native (node-hid) build.
 *
 * Node/CLI only — the transport is USB-HID. A browser build would swap
 * `@ledgerhq/hw-transport-node-hid` for `@ledgerhq/hw-transport-webhid`.
 */
export async function makeLedgerAccount(path = DEFAULT_LEDGER_PATH): Promise<Account> {
  const { default: TransportNodeHid } = await import("@ledgerhq/hw-transport-node-hid");
  const { default: Eth } = await import("@ledgerhq/hw-app-eth");

  const transport = await TransportNodeHid.create();
  const eth = new Eth(transport);

  const { address } = await eth.getAddress(path, false);

  // toAccount lets us define the three sign* primitives; viem composes the rest
  // (signTransaction for any tx type, prepared via the WalletClient).
  return toAccount({
    address: address as `0x${string}`,

    async signMessage({ message }) {
      const hash = hashMessage(message).slice(2);
      const sig = await eth.signPersonalMessage(path, hash);
      return assembleSig(sig);
    },

    async signTransaction(transaction, { serializer = serializeTransaction } = {}) {
      const unsigned = (await serializer(transaction)).slice(2);
      const sig = await eth.signTransaction(path, unsigned, null);
      // Re-serialize WITH the signature the device returned.
      return serializer(transaction, {
        r: `0x${sig.r}`,
        s: `0x${sig.s}`,
        v: BigInt(`0x${sig.v}`),
      });
    },

    async signTypedData(typedData) {
      // Hand the device the full EIP-712 object so it can clear-sign (display
      // the fields). The viem typedData shape matches what hw-app-eth expects.
      const sig = await eth.signEIP712Message(
        path,
        typedData as unknown as Parameters<typeof eth.signEIP712Message>[1],
      );
      return assembleSig(sig);
    },
  });
}

/** Ledger returns r/s/v as hex strings; viem wants 0x r||s||v. */
function assembleSig(sig: { r: string; s: string; v: number | string }): `0x${string}` {
  const v = typeof sig.v === "number" ? sig.v.toString(16).padStart(2, "0") : sig.v;
  return `0x${sig.r}${sig.s}${v}`;
}
