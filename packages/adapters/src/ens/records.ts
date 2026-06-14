import type { Attestation, SkillMetadata, Verdict } from "@aegis/core";

/**
 * The ENS text-record keys Aegis pins onto a skill name, and the
 * encode/decode for the records. Shared by EnsV2Resolver (read) and the writers
 * (write) so the wire format has exactly one definition.
 *
 *   safeskills.pin                       -> "sha256:<hex>"   the content hash (org writes)
 *   safeskills.uri                       -> "https://…"      where to fetch the SKILL.md (org writes)
 *   safeskills.metadata                  -> Metadata JSON    parsed SKILL.md frontmatter (org writes)
 *   safeskills.attestation.<provider>    -> Attestation JSON (that provider writes)
 *   safeskills.verdict                   -> Verdict JSON     (legacy single-verdict)
 */
export const TEXT_KEYS = {
  pin: "safeskills.pin",
  uri: "safeskills.uri",
  metadata: "safeskills.metadata",
  verdict: "safeskills.verdict",
} as const;

/** Serialize parsed SKILL.md frontmatter for the `safeskills.metadata` record. */
export function encodeMetadata(m: SkillMetadata): string {
  return JSON.stringify(m);
}

/**
 * Parse the `safeskills.metadata` record. Returns undefined when absent. Tolerant
 * by design — metadata is descriptive, not load-bearing like the pin/verdict — so
 * a malformed blob yields undefined rather than throwing.
 */
export function parseMetadata(raw: string | null | undefined): SkillMetadata | undefined {
  if (raw == null || raw === "") return undefined;
  try {
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" ? (obj as SkillMetadata) : undefined;
  } catch {
    return undefined;
  }
}

/** The per-provider attestation record key, e.g. "safeskills.attestation.chainlink.eth". */
export const ATTESTATION_PREFIX = "safeskills.attestation.";
export function attestationKey(provider: string): string {
  return `${ATTESTATION_PREFIX}${provider}`;
}

/** Serialize an Attestation for its `safeskills.attestation.<provider>` record. */
export function encodeAttestation(a: Attestation): string {
  return JSON.stringify({
    provider: a.provider,
    status: a.status,
    score: a.score,
    attestationId: a.attestationId,
    reviewedHash: a.reviewedHash,
  });
}

/**
 * Parse a `safeskills.attestation.<provider>` record. `provider` is the key's
 * namespace (authoritative); the JSON's own `provider` field is ignored if it
 * disagrees. Returns undefined when absent; throws when present but malformed.
 */
export function parseAttestation(
  provider: string,
  raw: string | null | undefined,
): Attestation | undefined {
  if (raw == null || raw === "") return undefined;
  const key = attestationKey(provider);

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${key} is not valid JSON: ${raw}`);
  }

  const { status, score, attestationId, reviewedHash } = obj;
  if (status !== "pass" && status !== "fail")
    throw new Error(`${key}.status must be "pass" | "fail", got ${String(status)}`);
  if (typeof score !== "number") throw new Error(`${key}.score must be a number`);
  if (typeof attestationId !== "string") throw new Error(`${key}.attestationId must be a string`);
  if (typeof reviewedHash !== "string") throw new Error(`${key}.reviewedHash must be a string`);

  return { provider, status, score, attestationId, reviewedHash };
}

/** Serialize a Verdict for the `safeskills.verdict` text record. */
export function encodeVerdict(v: Verdict): string {
  return JSON.stringify({
    status: v.status,
    riskScore: v.riskScore,
    attestationId: v.attestationId,
    reviewedHash: v.reviewedHash,
  });
}

/**
 * Parse the `safeskills.verdict` text record. Returns undefined when the record
 * is absent (a name that hasn't been reviewed yet). Throws when the record is
 * present but malformed — a corrupt verdict must be loud, never silently
 * treated as "no verdict".
 */
export function parseVerdict(raw: string | null | undefined): Verdict | undefined {
  if (raw == null || raw === "") return undefined;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${TEXT_KEYS.verdict} is not valid JSON: ${raw}`);
  }

  const { status, riskScore, attestationId, reviewedHash } = obj;
  if (status !== "pass" && status !== "fail")
    throw new Error(`${TEXT_KEYS.verdict}.status must be "pass" | "fail", got ${String(status)}`);
  if (typeof riskScore !== "number")
    throw new Error(`${TEXT_KEYS.verdict}.riskScore must be a number`);
  if (typeof attestationId !== "string")
    throw new Error(`${TEXT_KEYS.verdict}.attestationId must be a string`);
  if (typeof reviewedHash !== "string")
    throw new Error(`${TEXT_KEYS.verdict}.reviewedHash must be a string`);

  return { status, riskScore, attestationId, reviewedHash };
}
