import type { Metadata } from "next";
import Link from "next/link";
import { getOrgs, type OrgEntry } from "@/lib/registry.server";
import { EnsName } from "@/components/ens-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Companies — Aegis",
  description: "The organizations on the Aegis ENS registry — each owns its subname and the skills under it.",
};

export default async function OrgsPage() {
  const orgs = await getOrgs();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="text-[13px] uppercase tracking-[0.04em] text-black">The registry</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-black">Companies</h1>
        <p className="max-w-2xl text-black">
          Each company owns its own ENS subname and the skills published under it. {orgs.length}{" "}
          {orgs.length === 1 ? "company" : "companies"} on the registry.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {orgs.map((org, i) => (
          <OrgCard key={org.name} org={org} i={i} />
        ))}
      </div>
    </div>
  );
}

// Soft pastel palette — matches the skill registry cards.
const CARD_TINTS = [
  { bg: "bg-[#eafaf2]", hoverBg: "hover:bg-[#e0f6ea]" }, // mint green
  { bg: "bg-[#fdeef4]", hoverBg: "hover:bg-[#fbe4ee]" }, // light pink
  { bg: "bg-[#eaf3fd]", hoverBg: "hover:bg-[#e0ecfb]" }, // light blue
  { bg: "bg-[#fff6e6]", hoverBg: "hover:bg-[#fdefd6]" }, // light amber
  { bg: "bg-[#f2edfc]", hoverBg: "hover:bg-[#eae1fa]" }, // light lavender
  { bg: "bg-[#e7f8f8]", hoverBg: "hover:bg-[#dbf3f3]" }, // light teal
];

function OrgCard({ org, i }: { org: OrgEntry; i: number }) {
  const tint = CARD_TINTS[i % CARD_TINTS.length]!;
  return (
    <div className={`flex flex-col border border-[#292524] p-5 font-mono ${tint.bg}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xl font-semibold capitalize text-black">{org.label}</span>
        <span className="font-mono text-xs text-black">
          {org.counts.total} skill{org.counts.total === 1 ? "" : "s"}
        </span>
      </div>
      <EnsName name={org.name} className="mt-0.5 text-xs text-black" />

      <ul className="mt-3 space-y-0 border-t border-[#292524] pt-2">
        {org.skills.map(({ record }) => (
          <li key={record.name}>
            <Link
              href={`/a/${encodeURIComponent(record.pin)}`}
              className="flex items-center justify-between gap-2 rounded-none px-2 py-0.5 text-[13px] text-black transition-colors hover:bg-white/50"
            >
              <EnsName name={record.name} display={record.name.split(".")[0]} className="min-w-0" />
              <span className="shrink-0 text-xs text-black">
                {record.verdict ? `${record.verdict.status} · ${record.verdict.riskScore}` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
