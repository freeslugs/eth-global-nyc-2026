import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Account,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

export interface ChainClientOptions {
  rpcUrl?: string;
  chain?: Chain;
  /**
   * The signing account. The swappable unit: build it once via `makeAccount(env)`
   * (local key OR Ledger) and pass it in. Required for the Ledger path, which is
   * async and can't be derived synchronously here. Takes precedence over
   * `privateKey`.
   */
  account?: Account;
  /** Local-mode convenience: derive a LocalAccount from this key. Ignored if
   *  `account` is set. Defaults to AEGIS_PRIVATE_KEY. */
  privateKey?: `0x${string}`;
  /** HTTP transport timeout in ms. ENS resolution is a heavy CCIP eth_call, so
   *  callers that resolve names should raise this above viem's 10s default. */
  timeout?: number;
}

/**
 * Factory for viem clients. RPC URL comes from env (optional). In mock mode no
 * app constructs these, so a missing RPC is fine until on-chain wiring lands.
 */
export function makePublicClient(opts: ChainClientOptions = {}): PublicClient {
  const chain = opts.chain ?? sepolia;
  const rpcUrl = opts.rpcUrl ?? process.env.AEGIS_RPC_URL;
  return createPublicClient({
    chain,
    transport: http(rpcUrl, opts.timeout ? { timeout: opts.timeout } : undefined),
  });
}

/**
 * Build a wallet client. Pass `account` (from `makeAccount`) to use any signer
 * backend, including Ledger. As a local-mode convenience, when no `account` is
 * given it derives a LocalAccount from `privateKey` / AEGIS_PRIVATE_KEY — the
 * Ledger path can't be derived here because it's async, so Ledger callers MUST
 * build the account first: `makeWalletClient({ account: await makeAccount() })`.
 */
export function makeWalletClient(opts: ChainClientOptions = {}): WalletClient {
  const chain = opts.chain ?? sepolia;
  const rpcUrl = opts.rpcUrl ?? process.env.AEGIS_RPC_URL;
  const privateKey = opts.privateKey ?? (process.env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined);
  const account = opts.account ?? (privateKey ? privateKeyToAccount(privateKey) : undefined);
  return createWalletClient({
    chain,
    transport: http(rpcUrl, opts.timeout ? { timeout: opts.timeout } : undefined),
    account,
  });
}
