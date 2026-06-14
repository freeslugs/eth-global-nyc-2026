import Link from "next/link";
import { shortHash } from "@/lib/utils";
import { EnsName } from "@/components/ens-name";
import { statusMeta } from "@/lib/status";
import type { RegistryEntry } from "@/lib/registry.server";

/** The shared registry table row — a skill name, its pin, verdict, and status. */
export function SkillList({ entries }: { entries: RegistryEntry[] }) {
  if (entries.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-[#a8a29e]">No skills yet.</div>;
  }
  return (
    <div>
      {entries.map(({ record, status: seedStatus }) => {
        const status = statusMeta(seedStatus);
        const verdictLabel = record.verdict
          ? `${record.verdict.status} · risk ${record.verdict.riskScore}`
          : "no verdict yet";
        return (
          <Link
            key={record.name}
            href={`/a/${encodeURIComponent(record.pin)}`}
            className={`flex items-center gap-4 border-b border-[#f5f4f1] px-6 py-4 transition-colors last:border-0 hover:bg-[#faf9f7] ${status.tint}`}
          >
            <EnsName name={record.name} className="flex-1 text-sm" />
            <span className="hidden font-mono text-xs text-[#a8a29e] sm:block">
              {shortHash(record.pin, 6, 4)}
            </span>
            <span className="hidden w-40 text-xs text-[#a8a29e] sm:block">{verdictLabel}</span>
            <span className={`w-24 text-right text-[13px] font-medium ${status.text}`}>
              {status.glyph} {status.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
