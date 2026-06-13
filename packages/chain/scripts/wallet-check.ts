/**
 * Test the signing account end-to-end, in three escalating levels. This is the
 * exact wallet you'll use to WRITE ENS records (safeskills.pin) to Sepolia, so
 * proving it here de-risks the ship.
 *
 * Node >= 23 strips the TS types natively — run straight from repo root:
 *
 *   LEVEL 1 — offline, zero setup (no funds, no RPC). Proves derive + sign:
 *     node packages/chain/scripts/wallet-check.ts
 *
 *   LEVEL 2 — read Sepolia (needs AEGIS_RPC_URL). Proves RPC + funding:
 *     AEGIS_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key> \
 *       node packages/chain/scripts/wallet-check.ts
 *
 *   LEVEL 3 — real tx (needs a funded address). Sends a 0-value self-transfer,
 *   the cheapest possible proof of the FULL sign->broadcast->mine pipeline that
 *   an ENS write uses. Add --send:
 *     AEGIS_RPC_URL=... node packages/chain/scripts/wallet-check.ts --send
 *
 * Swap to Ledger for any level by flipping the flag — the device will prompt:
 *     AEGIS_SIGNER=ledger node packages/chain/scripts/wallet-check.ts --send
 */
import { formatEther, parseGwei } from "viem";
import { makeAccount } from "../src/account.ts";
import { makePublicClient, makeWalletClient } from "../src/clients.ts";

const send = process.argv.includes("--send");
const backend = process.env.AEGIS_SIGNER ?? "local";

// ── Level 1: derive + sign offline ──────────────────────────────────────────
const account = await makeAccount(process.env);
if (!account) {
  console.error(
    "No signer configured. Set AEGIS_PRIVATE_KEY (local) or AEGIS_SIGNER=ledger.",
  );
  process.exit(1);
}
console.log(`signer backend     ${backend}`);
console.log(`address            ${account.address}`);

const sampleTx = {
  chainId: 11155111,
  to: account.address,
  value: 0n,
  nonce: 0,
  gas: 21000n,
  maxFeePerGas: parseGwei("20"),
  maxPriorityFeePerGas: parseGwei("1"),
  type: "eip1559" as const,
};
const signed = await account.signTransaction(sampleTx);
console.log(`offline sign       ok (${signed.length} chars)`);

// ── Level 2: read Sepolia ───────────────────────────────────────────────────
if (!process.env.AEGIS_RPC_URL) {
  console.log(`\nLevel 1 passed. Set AEGIS_RPC_URL to check balance (level 2).`);
  process.exit(0);
}

const pub = makePublicClient({ timeout: 30_000 });
const [balance, nonce, chainId] = await Promise.all([
  pub.getBalance({ address: account.address }),
  pub.getTransactionCount({ address: account.address }),
  pub.getChainId(),
]);
console.log(`chainId            ${chainId}${chainId === 11155111 ? " (sepolia)" : ""}`);
console.log(`balance            ${formatEther(balance)} ETH`);
console.log(`nonce              ${nonce}`);

if (balance === 0n) {
  console.log(`\nAddress is unfunded — get Sepolia ETH from a faucet before --send.`);
  process.exit(0);
}

// ── Level 3: real self-transfer (full pipeline) ─────────────────────────────
if (!send) {
  console.log(`\nLevel 2 passed. Re-run with --send to broadcast a real 0-ETH self-tx.`);
  process.exit(0);
}

console.log(`\nbroadcasting 0-ETH self-transfer (confirm on device if Ledger)…`);
const wallet = makeWalletClient({ account, timeout: 30_000 });
const hash = await wallet.sendTransaction({
  account,
  chain: wallet.chain,
  to: account.address,
  value: 0n,
});
console.log(`tx hash            ${hash}`);
console.log(`explorer           https://sepolia.etherscan.io/tx/${hash}`);

const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`mined in block     ${receipt.blockNumber} (status: ${receipt.status})`);
console.log(`\nFull sign->broadcast->mine pipeline works. ENS writes use this same wallet.`);
