import type { Metadata } from "next";
import Link from "next/link";
import { getOrgs, type OrgEntry } from "@/lib/registry.server";
import { EnsName } from "@/components/ens-name";
import { CARD_TINTS } from "@/lib/card-tints";

export const runtime = "nodejs";
// ISR: re-scan the chain at most every 30s instead of per request — see /registry.
export const revalidate = 30;

export const metadata: Metadata = {
  title: "Companies — Aegis",
  description: "The organizations on the Aegis ENS registry — each owns its subname and the skills under it.",
};

export default async function OrgsPage() {
  const orgs = await getOrgs();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="text-[13px] uppercase tracking-[0.04em] text-accent">The registry</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">Companies</h1>
        <p className="max-w-2xl text-[#57534e]">
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

function OrgCard({ org, i }: { org: OrgEntry; i: number }) {
  const tint = CARD_TINTS[i % CARD_TINTS.length]!;
  return (
    <div className={`flex flex-col rounded-lg border p-5 ${tint.bg} ${tint.border}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xl font-semibold capitalize tracking-[-0.01em]">{org.label}</span>
        <span className="text-xs text-[#78716c]">
          {org.counts.total} skill{org.counts.total === 1 ? "" : "s"}
        </span>
      </div>
      <EnsName name={org.name} className="mt-0.5 text-xs text-[#78716c]" />

      <ul className="mt-3 space-y-0 border-t border-[#e7e5e1] pt-2">
        {org.skills.map(({ record }) => (
          <li key={record.name}>
            <Link
              href={`/a/${encodeURIComponent(record.pin)}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px] text-[#57534e] transition-colors hover:bg-white/60"
            >
              <EnsName name={record.name} display={record.name.split(".")[0]} className="min-w-0" />
              <span className="shrink-0 text-xs text-[#a8a29e]">
                {record.verdict ? `${record.verdict.status} · ${record.verdict.riskScore}` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
