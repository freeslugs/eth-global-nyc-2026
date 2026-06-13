import type { SkillFetcher } from "@aegis/core";
import { fixtureContent } from "../fixtures";

/** Returns fixture SKILL.md bytes keyed by uri (the fixture filename). */
export class MockFetcher implements SkillFetcher {
  async fetch(uri: string): Promise<Uint8Array> {
    const file = uri.split("/").pop() ?? uri;
    const content = fixtureContent[file];
    if (!content) throw new Error(`MockFetcher: unknown uri "${uri}"`);
    return new Uint8Array(content);
  }
}
