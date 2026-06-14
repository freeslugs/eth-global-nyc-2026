"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Attestation } from "@aegis/core";
import type { RegistryEntry } from "@/lib/registry.server";
import { EnsName } from "@/components/ens-name";
import { statusMeta } from "@/lib/status";
import { CARD_TINTS } from "@/lib/card-tints";

/**
 * Client-side search over the registry. Filters skills by name (title), ENS name,
 * and description. The tint index is the entry's ORIGINAL position so each card
 * keeps the same color as the list is filtered.
 */
export function RegistrySearch({ entries }: { entries: RegistryEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const indexed = entries.map((entry, i) => ({ entry, i }));
    const q = query.trim().toLowerCase();
    if (!q) return indexed;
    return indexed.filter(({ entry }) =>
      `${entry.title} ${entry.record.name} ${entry.description}`.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8a29e]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills by name, ENS, or description…"
          aria-label="Search skills"
          className="w-full rounded-md border border-[#d6d3ce] bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-ink"
        />
      </div>

      {query.trim() && (
        <p className="text-sm text-[#78716c]">
          {filtered.length} result{filtered.length === 1 ? "" : "s"} for “{query.trim()}”
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#e7e5e1] bg-white px-6 py-12 text-center text-sm text-[#a8a29e]">
          No skills match your search.
        </div>
      ) : (
        filtered.map(({ entry, i }) => <SkillCard key={entry.record.name} entry={entry} i={i} />)
      )}
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
