import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

/** Parsed SKILL.md frontmatter — scalars and (inline/block) lists. */
type Metadata = Record<string, string | string[]>;

/**
 * Minimal YAML-frontmatter parser for SKILL.md. Handles the shapes skills
 * actually use: `key: value` scalars, inline lists `[a, b]`, and block lists
 * (`-` items). Not a full YAML engine — deliberately dependency-free.
 */
function parseFrontmatter(md: string): Metadata {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md.replace(/^\uFEFF/, ""));
  if (!m) return {};
  const out: Metadata = {};
  let blockKey: string | null = null;
  const unquote = (s: string) => s.replace(/^["']|["']$/g, "").trim();

  for (const raw of m[1]!.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && blockKey) {
      (out[blockKey] as string[]).push(unquote(item[1]!));
      continue;
    }

    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1]!;
    const val = kv[2]!.trim();

    if (val === "") {
      out[key] = []; // start of a block list
      blockKey = key;
    } else if (val.startsWith("[") && val.endsWith("]")) {
      out[key] = val.slice(1, -1).split(",").map(unquote).filter(Boolean);
      blockKey = null;
    } else {
      out[key] = unquote(val);
      blockKey = null;
    }
  }
  return out;
}

/**
 * Fetch a skill's SKILL.md server-side (avoids browser CORS) and return what the
 * org commits on-chain:
 *   - pin: the `sha256:<hex>` the gate compares against
 *   - uri: the source URL itself, so a consuming agent can re-download the skill
 *          and re-hash it against the pin (contentUrl)
 *   - metadata: parsed frontmatter (name, description, license, allowed-tools…)
 * The Chainlink CRE re-fetches `uri` and re-hashes to confirm the pin.
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
    const buf = new Uint8Array(await res.arrayBuffer());
    const pin = `sha256:${createHash("sha256").update(buf).digest("hex")}`;
    const text = new TextDecoder().decode(buf);
    const metadata = parseFrontmatter(text);
    return NextResponse.json({ pin, bytes: buf.length, uri: url, metadata });
  } catch (e) {
    return NextResponse.json({ error: `fetch error: ${(e as Error).message}` }, { status: 502 });
  }
}
