import { NotImplementedError, type SkillFetcher } from "@aegis/core";

/**
 * GETs SKILL.md from an IPFS gateway by CID (uri = ipfs://<cid> or a gateway
 * URL). Must pass the SAME fetcherContract the mock passes.
 */
export class IpfsFetcher implements SkillFetcher {
  async fetch(_uri: string): Promise<Uint8Array> {
    throw new NotImplementedError("TODO(ipfs): GET SKILL.md from an IPFS gateway by CID");
  }
}
