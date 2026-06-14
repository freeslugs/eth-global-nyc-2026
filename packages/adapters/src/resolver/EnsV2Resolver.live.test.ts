import { describe, it, expect } from "vitest";
import { mainnet, sepolia } from "viem/chains";
import { EnsV2Resolver } from "./EnsV2Resolver";

/**
 * Opt-in LIVE test: drives the real EnsV2Resolver against a real network
 * (the Universal Resolver), proving the viem wiring round-trips end-to-end.
 * Skipped unless AEGIS_ENS_LIVE=1. Configure:
 *
 *   AEGIS_ENS_LIVE=1 \
 *   AEGIS_RPC_URL=https://ethereum-rpc.publicnode.com \
 *   pnpm --filter @aegis/adapters exec vitest run EnsV2Resolver.live
 *
 * Default target: vitalik.eth on mainnet (unpinned) — proves the round-trip via
 * the no-pin error. For ENS v2 on Sepolia point at any real name:
 *
 *   AEGIS_ENS_LIVE=1 AEGIS_ENS_LIVE_CHAIN=sepolia \
 *   AEGIS_ENS_LIVE_NAME=weather.acme.safeskills.eth \
 *   AEGIS_RPC_URL=<sepolia-rpc> pnpm --filter @aegis/adapters exec vitest run EnsV2Resolver.live
 */
const LIVE = process.env.AEGIS_ENS_LIVE === "1";
const name = process.env.AEGIS_ENS_LIVE_NAME ?? "vitalik.eth";
const chain = process.env.AEGIS_ENS_LIVE_CHAIN === "sepolia" ? sepolia : mainnet;

describe.skipIf(!LIVE)("EnsV2Resolver live", () => {
  it(`resolves "${name}" through the Universal Resolver`, async () => {
    const resolver = new EnsV2Resolver({ chain, rpcUrl: process.env.AEGIS_RPC_URL });

    // Either outcome proves the live UR call round-tripped: a pinned name yields
    // a valid record; an unpinned real name surfaces our explicit no-pin error.
    try {
      const rec = await resolver.resolve(name);
      expect(rec.pin).toMatch(/^sha256:[0-9a-f]+$/);
      expect(rec.owner).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(rec.node).toMatch(/^0x[0-9a-f]{64}$/);
    } catch (e) {
      expect((e as Error).message).toMatch(/no safeskills\.pin/);
    }
  }, 60_000);
});
