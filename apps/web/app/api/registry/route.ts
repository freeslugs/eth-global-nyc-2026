import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry.server";

// Reads flow through @aegis/adapters (mock store today) so the swap to an
// on-chain store later is automatic — no client change.
export const runtime = "nodejs";

export async function GET() {
  const entries = await getRegistry();
  return NextResponse.json({
    artifacts: entries.map((e) => ({
      name: e.record.name,
      bundleHash: e.record.bundleHash,
      manifestHash: e.record.manifestHash,
      publisher: e.record.publisher,
      policyRef: e.record.policyRef,
      status: e.record.status,
      revoked: e.revoked,
      attestations: e.attestations.length,
    })),
  });
}
