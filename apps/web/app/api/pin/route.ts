import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

/**
 * Fetch a skill URL server-side (avoids browser CORS) and return its content
 * pin — the same `sha256:<hex>` the gate compares against. The org commits this
 * pin on-chain; the Chainlink CRE re-fetches the URL and re-hashes to confirm.
 */
export async function POST(req: Request): Promise<Response> {
  let url: string;
  try {
    ({ url } = (await req.json()) as { url: string });
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "provide an http(s) URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed: HTTP ${res.status}` }, { status: 502 });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const pin = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    return NextResponse.json({ pin, bytes: bytes.length });
  } catch (e) {
    return NextResponse.json({ error: `fetch error: ${(e as Error).message}` }, { status: 502 });
  }
}
