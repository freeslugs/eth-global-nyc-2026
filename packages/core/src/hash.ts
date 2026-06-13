import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import type { Artifact, ArtifactDigest, ArtifactHash } from "./types";

/** Hash arbitrary bytes into canonical "sha256:<hex>" form. */
export function hashBytes(bytes: Uint8Array): ArtifactHash {
  return `sha256:${bytesToHex(sha256(bytes))}`;
}

/**
 * Digest an artifact. The bundle and manifest are hashed SEPARATELY: the
 * manifest (MCP tool descriptors) is the poisoning surface, so a changed
 * descriptor must move `manifestHash` without needing a new bundle.
 */
export function digest(a: Artifact): ArtifactDigest {
  return {
    bundleHash: hashBytes(a.bundle),
    manifestHash: hashBytes(a.manifest),
  };
}
