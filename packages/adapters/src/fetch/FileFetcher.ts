import { readFile } from "node:fs/promises";
import type { SkillFetcher } from "@aegis/core";

/** Reads a SKILL.md from a local filesystem path (uri = file path). */
export class FileFetcher implements SkillFetcher {
  async fetch(uri: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(uri));
  }
}
