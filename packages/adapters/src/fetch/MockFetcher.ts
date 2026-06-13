import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillFetcher } from "@aegis/core";
import { fixturesDir } from "../seed";

/** Returns fixture SKILL.md bytes keyed by uri (the fixture filename). */
export class MockFetcher implements SkillFetcher {
  async fetch(uri: string): Promise<Uint8Array> {
    const file = uri.split("/").pop() ?? uri;
    try {
      return new Uint8Array(readFileSync(join(fixturesDir, file)));
    } catch {
      throw new Error(`MockFetcher: unknown uri "${uri}"`);
    }
  }
}
