import type { Metadata } from "next";
import Link from "next/link";
import type { Attestation } from "@aegis/core";
import { getRegistry, type RegistryEntry } from "@/lib/registry.server";
import { shortHash } from "@/lib/utils";
import { EnsName } from "@/components/ens-name";

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
        {entries.map((entry) => (
          <SkillCard key={entry.record.name} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function SkillCard({ entry }: { entry: RegistryEntry }) {
  const { record, title, description, status } = entry;
  const badge = STATUS[status] ?? { label: status, cls: "bg-[#faf9f7] text-[#78716c]" };
  const attestations = record.attestations ?? [];

  return (
    <Link
      href={`/a/${encodeURIComponent(record.pin)}`}
      className="block rounded-2xl border border-[#e7e5e1] bg-white p-6 transition-colors hover:border-[#d6d3ce] hover:bg-[#fcfbfa]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <EnsName name={record.name} className="mt-0.5 text-xs text-[#78716c]" />
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#57534e]">{description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-[#a8a29e]">Attestations</span>
        {attestations.length === 0 ? (
          <span className="text-sm text-[#a8a29e]">Awaiting review</span>
        ) : (
          attestations.map((a) => <ProviderScore key={a.provider} a={a} />)
        )}
      </div>

      <div className="mt-4 border-t border-[#f5f4f1] pt-3 font-mono text-[11px] text-[#a8a29e]">
        pin {shortHash(record.pin, 8, 6)} · owner {record.owner.slice(0, 6)}…{record.owner.slice(-4)}
      </div>
    </Link>
  );
}

function ProviderScore({ a }: { a: Attestation }) {
  const pass = a.status === "pass";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        pass ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
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
