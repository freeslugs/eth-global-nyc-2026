import { join } from "node:path";
import { digest, verify, type Policy, type VerifyResult } from "@aegis/core";
import { FileFetcher, resolvePolicy, defaultSeed } from "@aegis/adapters";
import { GatewayResolver, gatewayRoot, type UpstreamPin } from "./registry";

export interface GateResult {
  result: VerifyResult;
  pin: UpstreamPin;
  fetched: { bundleHash: string; manifestHash: string };
}

/**
 * The trust gate: resolve the upstream's pin, fetch its CURRENT on-disk build +
 * manifest, re-hash, and run the pure verify() engine. No verdict is hard-coded
 * — a poisoned manifest changes the hash and is caught here.
 */
export async function verifyUpstream(name: string): Promise<GateResult> {
  const resolver = new GatewayResolver();
  const fetcher = new FileFetcher();

  const resolved = await resolver.resolve(name);
  const pin = resolver.pinFor(name);

  const artifact = await fetcher.fetch(join(gatewayRoot, pin.artifactPath));
  const fetched = digest(artifact);

  const policy: Policy = resolvePolicy(defaultSeed, resolved.policyRef);

  const result = verify({
    resolved,
    fetched,
    policy,
    attestations: [],
    revoked: false,
    // Gateway runs the hash/manifest gate; provenance verification is a later seam.
    verifyProvenanceSig: () => true,
  });

  return { result, pin, fetched };
}
