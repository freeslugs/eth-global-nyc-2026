import { NotImplementedError, type Artifact, type Fetcher } from "@aegis/core";

/**
 * Fetches an artifact tarball from an npm registry (`npm:<pkg>@<version>`),
 * extracting the bundle and its MCP manifest. Stubbed for now.
 */
export class NpmFetcher implements Fetcher {
  async fetch(_source: string): Promise<Artifact> {
    throw new NotImplementedError(
      "TODO(npm): download tarball from registry, extract bundle + manifest",
    );
  }
}
