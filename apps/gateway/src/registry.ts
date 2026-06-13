import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Resolver, ResolvedRecord, Hex } from "@aegis/core";

const here = dirname(fileURLToPath(import.meta.url));
/** Gateway root (one level up from dist/ or src/). */
export const gatewayRoot = resolve(here, "..");

export interface UpstreamPin extends ResolvedRecord {
  /** How to launch the upstream MCP server. */
  command: string;
  args: string[];
  /** Repo/gateway-relative path to the artifact dir (bundle.js + manifest.json). */
  artifactPath: string;
}

function loadPin(): UpstreamPin {
  const raw = readFileSync(join(gatewayRoot, "fixtures", "pin.json"), "utf8");
  return JSON.parse(raw) as UpstreamPin;
}

/** Tiny single-entry resolver over the gateway's pin.json. ENS replaces it. */
export class GatewayResolver implements Resolver {
  private readonly pin = loadPin();

  async resolve(name: string): Promise<ResolvedRecord> {
    if (name !== this.pin.name) {
      throw new Error(`GatewayResolver: unknown upstream "${name}"`);
    }
    const { bundleHash, manifestHash, publisher, policyRef } = this.pin;
    return { name, bundleHash, manifestHash, publisher: publisher as Hex, policyRef };
  }

  pinFor(name: string): UpstreamPin {
    if (name !== this.pin.name) throw new Error(`GatewayResolver: unknown upstream "${name}"`);
    return this.pin;
  }
}
