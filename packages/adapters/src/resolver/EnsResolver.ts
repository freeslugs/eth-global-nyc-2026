import { NotImplementedError, type Resolver, type ResolvedRecord } from "@aegis/core";

/**
 * Resolves a name's pin via ENS text records (e.g. `aegis.bundle`,
 * `aegis.manifest`, `aegis.publisher`). Stubbed for now.
 */
export class EnsResolver implements Resolver {
  async resolve(_name: string): Promise<ResolvedRecord> {
    throw new NotImplementedError(
      "TODO(ens): resolve via viem getEnsText (aegis.bundle/manifest/publisher records)",
    );
  }
}
