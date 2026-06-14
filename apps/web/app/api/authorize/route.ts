import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const runtime = "nodejs";

const ORG_REGISTRY = "0xeb5A6844C1C09F1DdDfb83cb4257943EBE80F3a4"; // safeskills.eth's subregistry
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

/**
 * Authorize a wallet to register a company under safeskills.eth — called right
 * before the user's "Create company". The server (admin key) grants the caller
 * ROLE_REGISTRAR so their own register() tx succeeds. Idempotent: granting an
 * address that already holds the role is a no-op.
 *
 * NOTE: roles cap at 15 holders — fine for a demo, not unlimited sign-up (that's
 * the open-registrar contract). AEGIS_ADMIN_KEY is a SERVER secret.
 */
export async function POST(req: Request): Promise<Response> {
  let address: string;
  try {
    ({ address } = (await req.json()) as { address: string });
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "provide a valid address" }, { status: 400 });
  }

  const key = (process.env.AEGIS_ADMIN_KEY ?? process.env.AEGIS_PRIVATE_KEY) as
    | `0x${string}`
    | undefined;
  if (!key) {
    return NextResponse.json(
      { error: "server not configured (set AEGIS_ADMIN_KEY)" },
      { status: 500 },
    );
  }

  try {
    const account = privateKeyToAccount(key);
    const transport = http(process.env.AEGIS_RPC_URL);
    const wallet = createWalletClient({ account, chain: sepolia, transport });
    const pub = createPublicClient({ chain: sepolia, transport });

    const data = encodeFunctionData({
      abi: grantAbi,
      functionName: "grantRootRoles",
      args: [ROLE_REGISTRAR, getAddress(address)],
    });
    const hash = await wallet.sendTransaction({ account, chain: sepolia, to: ORG_REGISTRY, data });
    await pub.waitForTransactionReceipt({ hash });

    return NextResponse.json({ ok: true, tx: hash });
  } catch (e) {
    return NextResponse.json(
      { error: `grant failed: ${(e as { shortMessage?: string }).shortMessage ?? (e as Error).message}` },
      { status: 502 },
    );
  }
}
