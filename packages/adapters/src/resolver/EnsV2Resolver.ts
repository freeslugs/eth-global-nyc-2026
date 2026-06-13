import { NotImplementedError, type SkillResolver, type SkillRecord } from "@aegis/core";

/**
 * Reads `safeskills.pin`, `safeskills.verdict`, contenthash, and owner from an
 * ENS v2 name on Sepolia (viem getEnsText / getEnsContentHash; the ENS v2 SDK
 * stays isolated here). Must pass the SAME resolverContract the mock passes.
 */
export class EnsV2Resolver implements SkillResolver {
  async resolve(_name: string): Promise<SkillRecord> {
    throw new NotImplementedError(
      "TODO(ens): resolve safeskills.pin/safeskills.verdict/contenthash/owner via viem",
    );
  }
}
