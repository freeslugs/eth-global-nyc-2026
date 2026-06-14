import type { Address, Chain, PublicClient } from "viem";
import { namehash } from "viem/ens";
import { getEnsV2Addresses, makePublicClient } from "@aegis/chain";
import type { Attestation, Hex, SkillResolver, SkillRecord } from "@aegis/core";
import { TEXT_KEYS, attestationKey, parseAttestation, parseVerdict } from "../ens/records";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Providers whose attestation slots the resolver reads, unless overridden. */
const DEFAULT_PROVIDERS = ["chainlink.eth", "my-local-verifier.eth"];

export interface EnsV2ResolverOptions {
  /** Inject a viem public client (tests). Defaults to a Sepolia client. */
  client?: PublicClient;
  rpcUrl?: string;
  chain?: Chain;
  /** ENS resolution is a heavy CCIP eth_call; default 30s (viem default is 10s). */
  timeoutMs?: number;
  /** Provider names to read attestation slots for. Default chainlink + local verifier. */
  providers?: string[];
}

/**
 * Reads a skill's records from an ENS v2 name via viem. ENS v2 / Namechain
 * requires no new SDK: viem >= 2.35 routes `getEnsText` / `getEnsAddress`
 * through the new Universal Resolver automatically (Sepolia UR is baked into
 * viem's chain config). Maps:
 *
 *   safeskills.pin      (text)   -> SkillRecord.pin       (required)
 *   safeskills.verdict  (text)   -> SkillRecord.verdict   (optional, JSON)
 *   namehash(name)               -> SkillRecord.node
 *   addr(name)                   -> SkillRecord.owner     (the org's address)
 *
 * `contentUri` (contenthash) is deferred: viem has no getEnsContentHash action,
 * and the pin model is text-record based, so it isn't needed to gate.
 *
 * Passes the SAME resolver.contract suite the MockResolver passes.
 */
export class EnsV2Resolver implements SkillResolver {
  private readonly client: PublicClient;
  private readonly providers: string[];

  constructor(opts: EnsV2ResolverOptions = {}) {
    this.client =
      opts.client ??
      makePublicClient({ rpcUrl: opts.rpcUrl, chain: opts.chain, timeout: opts.timeoutMs ?? 30_000 });
    this.providers =
      opts.providers ??
      (process.env.AEGIS_PROVIDERS?.split(",").map((p) => p.trim()).filter(Boolean) ??
        DEFAULT_PROVIDERS);
  }

  /** The v2 Universal Resolver to read through (pin it rather than rely on viem's chain default). */
  private universalResolver(): Address | undefined {
    const chainId = this.client.chain?.id;
    if (chainId == null) return undefined; // injected/mock client: let viem decide
    try {
      return getEnsV2Addresses(chainId).universalResolver;
    } catch {
      return undefined; // unconfigured chain (e.g. mainnet): fall back to viem's default UR
    }
  }

  async resolve(name: string): Promise<SkillRecord> {
    const node = namehash(name) as Hex;
    const universalResolverAddress = this.universalResolver();

    const [pin, verdictRaw, address, ...attestationRaws] = await Promise.all([
      this.client.getEnsText({ name, key: TEXT_KEYS.pin, universalResolverAddress }),
      this.client.getEnsText({ name, key: TEXT_KEYS.verdict, universalResolverAddress }),
      this.client.getEnsAddress({ name, universalResolverAddress }),
      ...this.providers.map((provider) =>
        this.client.getEnsText({ name, key: attestationKey(provider), universalResolverAddress }),
      ),
    ]);

    // No pin => the name is unknown to Aegis (or was never pinned). The gate
    // can't run without an authoritative hash, so treat it as not-found.
    if (!pin) {
      throw new Error(
        `EnsV2Resolver: "${name}" has no ${TEXT_KEYS.pin} text record (unknown or unpinned)`,
      );
    }

    const attestations: Attestation[] = this.providers
      .map((provider, i) => parseAttestation(provider, attestationRaws[i]))
      .filter((a): a is Attestation => a !== undefined);

    return {
      name,
      node,
      pin,
      // owner is taken from the name's ETH address record (the org's address).
      // gate() never reads it; it's surfaced for the explorer / audit trail.
      owner: (address ?? ZERO_ADDRESS) as Hex,
      verdict: parseVerdict(verdictRaw),
      attestations,
    };
  }
}
