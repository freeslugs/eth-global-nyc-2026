// Single source of truth for how a skill's status renders — its display word,
// glyph, text color, and soft row/badge tint. Previously this mapping lived in
// three places (ui/badge, registry, skill-list) and drifted: the same
// "poisoned" status showed as "tampered" in the list but "poisoned" on the
// detail page. Everything now reads its label from here so the word is the same
// across every surface; each surface still decides whether to prefix the glyph.

export interface StatusMeta {
  /** Friendly word shown to users — consistent everywhere. */
  label: string;
  /** Leading glyph for compact rows/badges (lists prefix it; the detail badge omits it). */
  glyph: string;
  /** Text color class. */
  text: string;
  /** Soft background tint for rows/pills (empty = no tint). */
  tint: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  verified: { label: "verified", glyph: "✓", text: "text-accent", tint: "bg-[#f3fbf7]" },
  poisoned: { label: "tampered", glyph: "✗", text: "text-[#dc2626]", tint: "bg-[#fef5f5]" },
  pending: { label: "pending", glyph: "•", text: "text-[#78716c]", tint: "" },
  revoked: { label: "revoked", glyph: "⚠", text: "text-[#d97706]", tint: "bg-[#fffaf0]" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, glyph: "", text: "text-[#78716c]", tint: "" };
}
