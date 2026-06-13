import type {
  SkillResolver,
  SkillFetcher,
  InstallSigner,
  ReviewClient,
  VerdictWriter,
  SubmissionWatcher,
  Policy,
  Hex,
} from "@aegis/core";

import { MockStore } from "./MockStore";
import { defaultPolicy, type SeededSkill } from "./seed";

import { MockResolver } from "./resolver/MockResolver";
import { EnsV2Resolver } from "./resolver/EnsV2Resolver";
import { MockFetcher } from "./fetch/MockFetcher";
import { FileFetcher } from "./fetch/FileFetcher";
import { IpfsFetcher } from "./fetch/IpfsFetcher";
import { LocalSigner } from "./signer/LocalSigner";
import { LedgerSigner } from "./signer/LedgerSigner";
import { MockReview } from "./review/MockReview";
import { ConfidentialAiClient } from "./review/ConfidentialAiClient";
import { MockVerdictWriter } from "./verdict/MockVerdictWriter";
import { EnsV2VerdictWriter } from "./verdict/EnsV2VerdictWriter";
import { MockWatcher } from "./watcher/MockWatcher";
import { ChainWatcher } from "./watcher/ChainWatcher";

export interface Adapters {
  resolver: SkillResolver;
  fetcher: SkillFetcher;
  signer: InstallSigner;
  review: ReviewClient;
  verdict: VerdictWriter;
  watcher: SubmissionWatcher;
  /** The shared mock store (explorer views, submit→consume loop). Mock mode only. */
  store: MockStore;
  /** Seeded skills with status badges. */
  seed: SeededSkill[];
  /** Default consumer gate policy. */
  policy: Policy;
}

/**
 * Build the adapter set from env flags. EVERY flag defaults to its mock, so the
 * whole system runs with zero chain / Ledger / Chainlink config. Flip ONE flag
 * to bring up ONE real adapter in isolation while everything else stays mocked.
 *
 *   AEGIS_RESOLVER=mock|ens     AEGIS_FETCHER=mock|file|ipfs
 *   AEGIS_SIGNER=local|ledger   AEGIS_REVIEW=mock|chainlink
 *   AEGIS_VERDICT=mock|ens      AEGIS_WATCHER=mock|chain
 */
export function buildAdapters(env: NodeJS.ProcessEnv = process.env): Adapters {
  const store = new MockStore();

  const resolver: SkillResolver =
    env.AEGIS_RESOLVER === "ens" ? new EnsV2Resolver() : new MockResolver(store);

  const fetcher: SkillFetcher =
    env.AEGIS_FETCHER === "ipfs"
      ? new IpfsFetcher()
      : env.AEGIS_FETCHER === "file"
        ? new FileFetcher()
        : new MockFetcher();

  const signer: InstallSigner =
    env.AEGIS_SIGNER === "ledger"
      ? new LedgerSigner()
      : new LocalSigner(env.AEGIS_PRIVATE_KEY as Hex | undefined);

  const review: ReviewClient =
    env.AEGIS_REVIEW === "chainlink" ? new ConfidentialAiClient() : new MockReview();

  const verdict: VerdictWriter =
    env.AEGIS_VERDICT === "ens" ? new EnsV2VerdictWriter() : new MockVerdictWriter(store);

  const watcher: SubmissionWatcher =
    env.AEGIS_WATCHER === "chain" ? new ChainWatcher() : new MockWatcher();

  return { resolver, fetcher, signer, review, verdict, watcher, store, seed: store.seeded, policy: defaultPolicy };
}
