import { type SkillFetcher } from "@aegis/core";

/**
 * Fetches a skill's SKILL.md directly from its on-chain `contentUri` — the record
 * stores a plain `https://…` URL that points straight at the file (e.g. a raw
 * GitHub URL). This layer only retrieves bytes; the caller re-hashes them against
 * the on-chain pin, so a wrong/forged fetch is caught by the integrity floor.
 */
export class HttpFetcher implements SkillFetcher {
  async fetch(uri: string): Promise<Uint8Array> {
    if (!/^https?:\/\//i.test(uri)) {
      throw new Error(`contentUri must be an http(s) URL, got: ${uri}`);
    }
    let res: Response;
    try {
      res = await fetch(uri, { redirect: "follow" });
    } catch (err) {
      throw new Error(`could not fetch ${uri}: ${(err as Error).message}`);
    }
    if (!res.ok) {
      throw new Error(`could not fetch ${uri}: HTTP ${res.status} ${res.statusText}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
