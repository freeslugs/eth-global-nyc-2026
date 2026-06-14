import type { Metadata } from "next";
import Link from "next/link";
import type { Attestation } from "@aegis/core";
import { getRegistry, type RegistryEntry } from "@/lib/registry.server";
import { EnsName } from "@/components/ens-name";
import { statusMeta } from "@/lib/status";
import { CARD_TINTS } from "@/lib/card-tints";

export const runtime = "nodejs";
// ISR: re-scan the chain at most every 30s (a new skill appears within that
// window) instead of on every request — the on-chain enumeration is a batch of
// getLogs calls we don't want to repeat per page view / Vercel cold start.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Registry — Aegis",
  description:
    "Browse every agent skill on the Aegis ENS registry — its ENS record and the safety scores from each attestation provider.",
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

function SkillCard({ entry, i }: { entry: RegistryEntry; i: number }) {
  const { record, title, description, status } = entry;
  const meta = statusMeta(status);
  const tint = CARD_TINTS[i % CARD_TINTS.length]!;
  const attestations = record.attestations ?? [];

  return (
    <Link
      href={`/a/${encodeURIComponent(record.pin)}`}
      className={`block border p-5 transition-colors ${tint.bg} ${tint.border} ${tint.hoverBorder} ${tint.hoverBg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          <EnsName name={record.name} className="mt-0.5 text-xs text-[#78716c]" />
        </div>
        <span className={`shrink-0 rounded-none px-2.5 py-0.5 text-[13px] font-medium ${meta.tint} ${meta.text}`}>
          {meta.glyph} {meta.label}
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#57534e] line-clamp-1">{description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[#a8a29e]">Attestations</span>
        {attestations.length === 0 ? (
          <span className="text-sm text-[#a8a29e]">Awaiting review</span>
        ) : (
          attestations.map((a) => <ProviderScore key={a.provider} a={a} />)
        )}
      </div>
    </Link>
  );
}

function ProviderScore({ a }: { a: Attestation }) {
  const pass = a.status === "pass";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs ${
        pass ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"
      }`}
      title={`${a.provider}: ${a.status} (${a.score}/100)`}
    >
      <span className="font-mono text-[#57534e]">{a.provider}</span>
      <span className={`font-semibold ${pass ? "text-emerald-600" : "text-red-600"}`}>
        {a.score}
        <span className="text-[#a8a29e]">/100</span>
      </span>
    </span>
  );
}
