/**
 * Authorize a wallet to register companies under safeskills.eth — pure ENS
 * policy, no new contract. Calls grantRootRoles(ROLE_REGISTRAR, <wallet>) on
 * safeskills.eth's subregistry, so that wallet can then create companies.
 *
 * Must be run by the ADMIN wallet (the one that deployed the subregistry and
 * holds the admin roles). Roles cap at 15 holders per role — for unlimited
 * self-serve you'd need an open-registrar contract instead.
 *
 * RUN (AEGIS_PRIVATE_KEY = the ADMIN wallet, e.g. 0xE976…):
 *   node --env-file=.env packages/adapters/scripts/grant-registrar.ts 0x<wallet-to-authorize>
 */
import { encodeFunctionData, getAddress, type Address } from "viem";
import { makeAccount, makePublicClient, makeWalletClient } from "@aegis/chain";

const ORG_REGISTRY = (process.env.AEGIS_SAFESKILLS_REGISTRY ??
  "0xeb5A6844C1C09F1DdDfb83cb4257943EBE80F3a4") as Address; // safeskills.eth's subregistry
const ROLE_REGISTRAR = 1n; // 1 << 0

const grantAbi = [
  {
    name: "grantRootRoles",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roleBitmap", type: "uint256" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const target = process.argv[2];
if (!target) {
  console.error("usage: grant-registrar.ts <wallet-to-authorize>");
  process.exit(1);
}
const account = await makeAccount(process.env);
if (!account) throw new Error("set AEGIS_PRIVATE_KEY (the ADMIN wallet that owns the subregistry)");

const pub = makePublicClient({ timeout: 30_000 });
const wallet = makeWalletClient({ account, timeout: 30_000 });

console.log(`Granting ROLE_REGISTRAR on ${ORG_REGISTRY}`);
console.log(`  to ${getAddress(target)}   (signed by admin ${account.address})`);

const data = encodeFunctionData({
  abi: grantAbi,
  functionName: "grantRootRoles",
  args: [ROLE_REGISTRAR, getAddress(target)],
});
const hash = await wallet.sendTransaction({ account, chain: wallet.chain, to: ORG_REGISTRY, data });
await pub.waitForTransactionReceipt({ hash });

console.log(`✓ ${getAddress(target)} can now register companies under safeskills.eth`);
console.log(`  tx ${hash}`);
