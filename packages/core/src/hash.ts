import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import type { SkillHash } from "./types";

/** Hash SKILL.md bytes into canonical "sha256:<hex>" form. */
export function hashSkill(md: Uint8Array): SkillHash {
  return `sha256:${bytesToHex(sha256(md))}`;
}
