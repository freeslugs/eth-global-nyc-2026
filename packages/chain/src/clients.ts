import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

export interface ChainClientOptions {
  rpcUrl?: string;
  chain?: Chain;
  /** Optional private key for a wallet client. */
  privateKey?: `0x${string}`;
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
    transport: http(rpcUrl),
  });
}

export function makeWalletClient(opts: ChainClientOptions = {}): WalletClient {
  const chain = opts.chain ?? sepolia;
  const rpcUrl = opts.rpcUrl ?? process.env.AEGIS_RPC_URL;
  const privateKey = opts.privateKey ?? (process.env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined);
  return createWalletClient({
    chain,
    transport: http(rpcUrl),
    account: privateKey ? privateKeyToAccount(privateKey) : undefined,
  });
}
