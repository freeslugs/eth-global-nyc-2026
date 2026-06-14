/**
 * Fetch the result of a Chainlink Confidential AI inference job by ID.
 *
 * Useful for checking jobs submitted by the CRE workflow that timed out before
 * the status endpoint reflected "completed" (~90s lag observed in practice).
 *
 * RUN
 *   node --env-file=apps/cre-workflow/.env packages/adapters/scripts/ai-tee-result.ts <inference-id>
 *   node --env-file=apps/cre-workflow/.env packages/adapters/scripts/ai-tee-result.ts <inference-id> --poll
 *
 * ENV
 *   CONFIDENTIAL_AI_API_KEY   — required
 *   CONFIDENTIAL_AI_BASE_URL  — optional, defaults to https://confidential-ai-dev-preview.cldev.cloud
 */

export {};

const [inferenceId, flag] = process.argv.slice(2);
if (!inferenceId) {
  console.error("usage: ai-result.ts <inference-id> [--poll]");
  process.exit(1);
}

const apiKey = process.env.CONFIDENTIAL_AI_API_KEY;
if (!apiKey) {
  console.error("CONFIDENTIAL_AI_API_KEY not set");
  process.exit(1);
}

const baseUrl =
  process.env.CONFIDENTIAL_AI_BASE_URL ?? "https://confidential-ai-dev-preview.cldev.cloud";
const url = `${baseUrl}/v1/inference/${inferenceId}`;
const headers = { Authorization: `Bearer ${apiKey}` };

async function fetchResult() {
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    console.error(`HTTP ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }
  return resp.json() as Promise<{
    id: string;
    status: string;
    output?: string;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
    created_at?: string;
    completed_at?: string;
    resource_summaries?: Array<{ filename: string; digest: string }>;
  }>;
}

if (flag === "--poll") {
  console.log(`Polling ${inferenceId} ...`);
  for (let i = 0; i < 120; i++) {
    const data = await fetchResult();
    const elapsed = data.created_at
      ? `${Math.round((Date.now() - new Date(data.created_at).getTime()) / 1000)}s`
      : "?";
    process.stdout.write(`\r[${elapsed}] status=${data.status}   `);
    if (data.status === "completed" || data.status === "failed") {
      console.log("");
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
} else {
  const data = await fetchResult();
  console.log(JSON.stringify(data, null, 2));

  if (data.status === "completed" && data.output) {
    console.log("\n─── parsed output ───");
    try {
      console.log(JSON.parse(data.output));
    } catch {
      console.log(data.output);
    }
  }
}
