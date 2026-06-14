import type { Metadata } from "next";
import Link from "next/link";
import { getRegistry, type RegistryEntry } from "@/lib/registry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registry — Aegis",
  description:
    "Browse every agent skill on the Aegis ENS registry — its ENS record and the safety scores from each attestation provider.",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  verified: { label: "✓ verified", cls: "bg-[#f3fbf7] text-accent" },
  poisoned: { label: "✗ tampered", cls: "bg-[#fef5f5] text-[#dc2626]" },
  pending: { label: "• pending", cls: "bg-[#faf9f7] text-[#78716c]" },
  revoked: { label: "⚠ revoked", cls: "bg-[#fffaf0] text-[#d97706]" },
};

export default async function RegistryPage() {
  const entries = await getRegistry();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="text-[13px] uppercase tracking-[0.04em] text-accent">The registry</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">Skill registry</h1>
        <p className="max-w-2xl text-[#57534e]">
          Every skill named on ENS, with its content pin and the safety score each attestation
          provider has written on-chain. {entries.length} skill{entries.length === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="space-y-4">
        {entries.map((entry, i) => (
          <SkillCard key={entry.record.name} entry={entry} i={i} />
        ))}
      </div>
    </div>
  );
}

// Soft pastel palette — each card rotates through these.
const CARD_TINTS = [
  { bg: "bg-[#eafaf2]", border: "border-[#c3ecd7]", hoverBorder: "hover:border-[#a9e3c5]", hoverBg: "hover:bg-[#e0f6ea]" }, // mint green
  { bg: "bg-[#fdeef4]", border: "border-[#f6cfdf]", hoverBorder: "hover:border-[#f0bad1]", hoverBg: "hover:bg-[#fbe4ee]" }, // light pink
  { bg: "bg-[#eaf3fd]", border: "border-[#c5dcf5]", hoverBorder: "hover:border-[#aacef0]", hoverBg: "hover:bg-[#e0ecfb]" }, // light blue
  { bg: "bg-[#fff6e6]", border: "border-[#f6e3bd]", hoverBorder: "hover:border-[#f0d8a3]", hoverBg: "hover:bg-[#fdefd6]" }, // light amber
  { bg: "bg-[#f2edfc]", border: "border-[#d9cdf3]", hoverBorder: "hover:border-[#cabaee]", hoverBg: "hover:bg-[#eae1fa]" }, // light lavender
  { bg: "bg-[#e7f8f8]", border: "border-[#bfe9e9]", hoverBorder: "hover:border-[#a5e0e0]", hoverBg: "hover:bg-[#dbf3f3]" }, // light teal
];

function SkillCard({ entry, i }: { entry: RegistryEntry; i: number }) {
  const { record, title, description, status } = entry;
  const badge = STATUS[status] ?? { label: status, cls: "bg-[#faf9f7] text-[#78716c]" };
  const tint = CARD_TINTS[i % CARD_TINTS.length]!;

  return (
    <Link
      href={`/a/${encodeURIComponent(record.pin)}`}
      className={`block border p-5 transition-colors ${tint.bg} ${tint.border} ${tint.hoverBorder} ${tint.hoverBg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          <div className="mt-0.5 font-mono text-xs text-[#78716c]">{record.name}</div>
        </div>
        <span className={`shrink-0 rounded-none px-2.5 py-0.5 text-[13px] font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e] line-clamp-1">{description}</p>
    </Link>
  );
}
