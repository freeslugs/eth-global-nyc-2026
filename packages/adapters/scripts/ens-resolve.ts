/**
 * Step 2 — resolve a real skill name through EnsV2Resolver and print the
 * SkillRecord the gate would consume. This is the mock → real swap, live.
 *
 * Prereq: an ENS name (Sepolia) with a `safeskills.pin` text record set; a
 * `safeskills.verdict` record is optional. See REGISTER below.
 *
 * Run (build the package first so node resolves @aegis/adapters -> dist):
 *   pnpm --filter @aegis/adapters build
 *   AEGIS_RPC_URL=https://sepolia.infura.io/v3/<key> \
 *     node packages/adapters/scripts/ens-resolve.ts myskill.eth
 *
 * REGISTER a test name (free on Sepolia):
 *   1. Get Sepolia ETH from a faucet (e.g. sepoliafaucet.com).
 *   2. app.ens.domains -> switch wallet to Sepolia -> register a name.
 *   3. On the name's page: Records -> add text records:
 *        safeskills.pin      = sha256:<hex>     (hashSkill(SKILL.md))
 *        safeskills.verdict  = {"status":"pass","riskScore":5,
 *                               "attestationId":"demo","reviewedHash":"sha256:<hex>"}
 *      and set the ETH address record (becomes SkillRecord.owner).
 */
import { EnsV2Resolver } from "@aegis/adapters";

const name = process.argv[2];
if (!name) {
  console.error("usage: node ens-resolve.ts <name.eth>");
  process.exit(1);
}

const resolver = new EnsV2Resolver();
console.log(`Resolving "${name}" via EnsV2Resolver…\n`);

const record = await resolver.resolve(name);
console.log(JSON.stringify(record, null, 2));
