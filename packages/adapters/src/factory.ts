import { readFileSync } from "node:fs";
import type {
  Resolver,
  Fetcher,
  Signer,
  AttestationStore,
  ConfidentialAttester,
  ResolvedRecord,
  Attestation,
  Hex,
} from "@aegis/core";

import { MockResolver } from "./resolver/MockResolver";
import { EnsResolver } from "./resolver/EnsResolver";
import { FileFetcher } from "./fetch/FileFetcher";
import { NpmFetcher } from "./fetch/NpmFetcher";
import { LocalSigner } from "./signer/LocalSigner";
import { LedgerSigner } from "./signer/LedgerSigner";
import { MemoryStore } from "./store/MemoryStore";
import { OnchainStore } from "./store/OnchainStore";
import { OffConfidential } from "./confidential/OffConfidential";
import { ChainlinkConfidential } from "./confidential/ChainlinkConfidential";
import { defaultSeed, type RegistrySeed } from "./seed";

export interface Adapters {
  resolver: Resolver;
  fetcher: Fetcher;
  signer: Signer;
  store: AttestationStore;
  confidential: ConfidentialAttester;
  /** The seed in use (records, policies) — convenient for explorer views. */
  seed: RegistrySeed;
  /** Provenance signature verifier to pass into core's verify(). */
  verifyProvenanceSig: (rec: ResolvedRecord, provenance: Attestation) => boolean;
}

/** In mock mode, a provenance attestation is valid iff it carries a signature. */
function mockVerifyProvenanceSig(_rec: ResolvedRecord, provenance: Attestation): boolean {
  return typeof provenance.signature === "string" && provenance.signature.length > 0;
}

function loadSeed(seedPath: string | undefined): RegistrySeed {
  if (!seedPath) return defaultSeed;
  return JSON.parse(readFileSync(seedPath, "utf8")) as RegistrySeed;
}

/**
 * Build the adapter set from environment flags. Every flag defaults to a mock,
 * so the repo runs with zero chain config. Switching a flag to its "real"
 * value reaches a stub that throws NotImplementedError.
 */
export function buildAdapters(env: NodeJS.ProcessEnv = process.env): Adapters {
  const seed = loadSeed(env.AEGIS_SEED_PATH);

  const resolver: Resolver = env.AEGIS_RESOLVER === "ens" ? new EnsResolver() : new MockResolver(seed);

  const fetcher: Fetcher = env.AEGIS_FETCHER === "npm" ? new NpmFetcher() : new FileFetcher();

  const signer: Signer =
    env.AEGIS_SIGNER === "ledger"
      ? new LedgerSigner()
      : new LocalSigner(env.AEGIS_PRIVATE_KEY as Hex | undefined);

  const store: AttestationStore =
    env.AEGIS_STORE === "onchain" ? new OnchainStore() : new MemoryStore(seed);

  const confidential: ConfidentialAttester =
    env.AEGIS_CONFIDENTIAL === "chainlink" ? new ChainlinkConfidential() : new OffConfidential();

  return { resolver, fetcher, signer, store, confidential, seed, verifyProvenanceSig: mockVerifyProvenanceSig };
}
