/**
 * Watch the ENS resolver for safeskills.pin writes and automatically run the
 * full TEE attestation + ENS write for each new skill pinned.
 *
 * Demo usage: run this in one terminal. In another, use the ENS app or the
 * CRE simulation to set a safeskills.pin. The attestation will appear on its
 * own ~60s later.
 *
 * RUN
 *   node --env-file=.env packages/adapters/scripts/watch-and-attest.ts
 *
 * ENV  AEGIS_PRIVATE_KEY, AEGIS_RPC_URL, AEGIS_ENS_RESOLVER, CONFIDENTIAL_AI_API_KEY
 * OPT  CONFIDENTIAL_AI_BASE_URL, CONFIDENTIAL_AI_MODEL, CONFIDENTIAL_AI_PROVIDER
 *      WATCH_FROM_BLOCK   — start scanning from this block (default: current - 100)
 *      WATCH_POLL_MS      — polling interval in ms (default: 5000)
 */
import process from "node:process";
import {
  createPublicClient,
  http,
  keccak256,
  toBytes,
  decodeAbiParameters,
  type Hex,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { attestByNode, configFromEnv } from "./attest-skill.js";
import { makePublicClient } from "@aegis/chain";

// ── Config ────────────────────────────────────────────────────────────────────

const cfg = configFromEnv(process.env);
const RESOLVER = cfg.resolver;
const POLL_MS = Number(process.env.WATCH_POLL_MS ?? 5000);

// TextChanged(bytes32 indexed node, string indexed key, string keyPreimage, string value)
const TEXT_CHANGED_SIG = keccak256(toBytes("TextChanged(bytes32,string,string,string)")) as Hex;
const PIN_KEY_HASH = keccak256(toBytes("safeskills.pin")) as Hex;

// ── Setup ─────────────────────────────────────────────────────────────────────

const pub = makePublicClient({ timeout: 30_000 });
const currentBlock = await pub.getBlockNumber();
let fromBlock = process.env.WATCH_FROM_BLOCK
  ? BigInt(process.env.WATCH_FROM_BLOCK)
  : currentBlock - 100n;

// Track seen tx hashes to avoid double-processing in case of reorgs/re-polls.
const seen = new Set<string>();
// Track nodes currently being processed to avoid concurrent duplicate runs.
const inFlight = new Set<string>();

console.log(
  `\nwatch-and-attest  resolver=${RESOLVER}  provider=${cfg.provider ?? "chainlink.eth"}`,
);
console.log(`scanning from block ${fromBlock}  poll=${POLL_MS}ms\n`);

// ── Event loop ────────────────────────────────────────────────────────────────

async function readUri(node: Hex): Promise<string | null> {
  try {
    const result = await pub.readContract({
      address: RESOLVER,
      abi: [
        {
          name: "text",
          type: "function",
          stateMutability: "view",
          inputs: [{ type: "bytes32" }, { type: "string" }],
          outputs: [{ type: "string" }],
        },
      ] as const,
      functionName: "text",
      args: [node, "safeskills.uri"],
    });
    return result || null;
  } catch {
    return null;
  }
}

async function processEvent(node: Hex, pin: string, txHash: string) {
  if (seen.has(txHash) || inFlight.has(node)) return;
  seen.add(txHash);
  inFlight.add(node);

  console.log(
    `\n[${new Date().toISOString()}] TextChanged  node=${node.slice(0, 10)}…  pin=${pin.slice(0, 20)}…`,
  );

  try {
    const uri = await readUri(node);
    if (!uri) {
      console.log("  ✗ safeskills.uri not set — skipping");
      return;
    }
    console.log(`  uri=${uri}`);
    await attestByNode(node, pin, uri, cfg);
  } catch (e) {
    console.error(`  ✗ attestation failed: ${(e as Error).message}`);
  } finally {
    inFlight.delete(node);
  }
}

async function poll() {
  const toBlock = await pub.getBlockNumber();
  if (toBlock < fromBlock) return;

  const logs = await pub.getLogs({
    address: RESOLVER,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    if (log.topics[0] !== TEXT_CHANGED_SIG) continue;
    if (log.topics[2] !== PIN_KEY_HASH) continue;

    const node = log.topics[1] as Hex;
    const [, pin] = decodeAbiParameters([{ type: "string" }, { type: "string" }], log.data);
    const txHash = `${log.transactionHash}:${log.logIndex}`;

    // Fire and forget — don't await so poll() can return on time
    processEvent(node, pin, txHash).catch(() => {});
  }

  fromBlock = toBlock + 1n;
}

// Run immediately then on interval
await poll();
setInterval(() => {
  poll().catch(console.error);
}, POLL_MS);
console.log("Listening… (Ctrl+C to stop)\n");
