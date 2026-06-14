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
        <div className="text-[13px] uppercase tracking-[0.04em] text-accent">The registry</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">Companies</h1>
        <p className="max-w-2xl text-[#57534e]">
          Each company owns its own ENS subname and the skills published under it. {orgs.length}{" "}
          {orgs.length === 1 ? "company" : "companies"} on the registry.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {orgs.map((org) => (
          <OrgCard key={org.name} org={org} />
        ))}
      </div>
    </div>
  );
}

function OrgCard({ org }: { org: OrgEntry }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#e7e5e1] bg-white p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-semibold capitalize">{org.label}</span>
        <span className="font-mono text-xs text-[#a8a29e]">
          {org.counts.total} skill{org.counts.total === 1 ? "" : "s"}
        </span>
      </div>
      <EnsName name={org.name} className="mt-0.5 text-xs text-[#78716c]" />

      <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
        {org.counts.verified > 0 && (
          <span className="rounded-full bg-[#f3fbf7] px-2.5 py-0.5 text-accent">
            {org.counts.verified} verified
          </span>
        )}
        {org.counts.poisoned > 0 && (
          <span className="rounded-full bg-[#fef5f5] px-2.5 py-0.5 text-[#dc2626]">
            {org.counts.poisoned} tampered
          </span>
        )}
        {org.counts.pending > 0 && (
          <span className="rounded-full bg-[#faf9f7] px-2.5 py-0.5 text-[#78716c]">
            {org.counts.pending} pending
          </span>
        )}
        {org.counts.revoked > 0 && (
          <span className="rounded-full bg-[#fffaf0] px-2.5 py-0.5 text-[#d97706]">
            {org.counts.revoked} revoked
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-1 border-t border-[#f5f4f1] pt-3">
        {org.skills.map(({ record }) => (
          <li key={record.name}>
            <Link
              href={`/a/${encodeURIComponent(record.pin)}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-[#faf9f7]"
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
