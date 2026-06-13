import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry.server";

// Reads flow through @aegis/adapters (mock resolver today) so the swap to the
// real ENS v2 resolver later is automatic — no client change. This route
// handler IS the API: there is no separate standalone service to host.
export const runtime = "nodejs";

export async function GET() {
  const entries = await getRegistry();
  return NextResponse.json({
    skills: entries.map((e) => ({
      name: e.record.name,
      pin: e.record.pin,
      owner: e.record.owner,
      status: e.status,
      verdict: e.record.verdict ?? null,
    })),
  });
}
