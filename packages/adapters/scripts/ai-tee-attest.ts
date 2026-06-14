/**
 * Full attestation flow without CRE deployment:
 *   ENS lookup → fetch SKILL.md → Confidential AI TEE → write ENS attestation
 *
 * RUN
 *   node --env-file=.env packages/adapters/scripts/ai-tee-attest.ts \
 *     geo-audit.acme.safeskills.eth
 *
 * ENV  AEGIS_PRIVATE_KEY, AEGIS_RPC_URL, AEGIS_ENS_RESOLVER, CONFIDENTIAL_AI_API_KEY
 * OPT  CONFIDENTIAL_AI_BASE_URL, CONFIDENTIAL_AI_MODEL, CONFIDENTIAL_AI_PROVIDER
 */
import process from "node:process";
import { attestByName, configFromEnv } from "./attest-skill.js";

const skillName = process.argv[2];
if (!skillName) {
  console.error("usage: ai-tee-attest.ts <skill-ens-name>");
  process.exit(1);
}

console.log(`\nattest  ${skillName}`);
const result = await attestByName(skillName, configFromEnv(process.env));
console.log(
  `\ndone  verdict=${result.verdict.toUpperCase()}  score=${result.score}  inferenceId=${result.inferenceId}`,
);
