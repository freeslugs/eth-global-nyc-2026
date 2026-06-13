import { buildAdapters } from "@aegis/adapters";
import { reviewSubmission } from "./workflow";

/**
 * Local runner / CRE entrypoint. With no env flags this runs entirely on mocks:
 * it wires the SubmissionWatcher to the review workflow. On Sepolia, flip
 * AEGIS_WATCHER=chain, AEGIS_FETCHER=ipfs, AEGIS_REVIEW=chainlink,
 * AEGIS_VERDICT=ens — the orchestration below is unchanged.
 *
 * NOTE: this is NOT a hosted web service. It is a Chainlink CRE workflow
 * (deployed to the DON) / a local one-shot runner — so it does not add a second
 * thing to host alongside the single Next.js app on Vercel.
 */
export function startWorkflow(): void {
  const a = buildAdapters();
  a.watcher.onSubmission((e) => {
    void reviewSubmission({ fetcher: a.fetcher, review: a.review, verdict: a.verdict }, e)
      .then((v) => console.log(`reviewed ${e.node}: ${v.status} (risk ${v.riskScore})`))
      .catch((err) => console.error(`review failed for ${e.node}:`, err));
  });
  console.log("cre-workflow listening for submissions (mock mode unless AEGIS_* flags set)");
}

startWorkflow();
