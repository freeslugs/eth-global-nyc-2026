import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Artifact, Fetcher } from "@aegis/core";

/**
 * Reads an artifact from the local filesystem. `source` is a directory
 * containing `bundle.js` (the code) and `manifest.json` (the MCP tool
 * descriptors). Both are read as raw bytes and hashed separately downstream.
 */
export class FileFetcher implements Fetcher {
  async fetch(source: string): Promise<Artifact> {
    const [bundle, manifest] = await Promise.all([
      readFile(join(source, "bundle.js")),
      readFile(join(source, "manifest.json")),
    ]);
    return {
      bundle: new Uint8Array(bundle),
      manifest: new Uint8Array(manifest),
    };
  }
}
