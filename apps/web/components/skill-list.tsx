import Link from "next/link";
import { shortHash } from "@/lib/utils";
import type { RegistryEntry } from "@/lib/registry.server";

const STATUS_STYLE: Record<string, { label: string; cls: string; row: string }> = {
  verified: { label: "✓ verified", cls: "text-accent", row: "bg-[#f3fbf7]" },
  poisoned: { label: "✗ tampered", cls: "text-[#dc2626]", row: "bg-[#fef5f5]" },
  pending: { label: "• pending", cls: "text-[#78716c]", row: "" },
  revoked: { label: "⚠ revoked", cls: "text-[#d97706]", row: "bg-[#fffaf0]" },
};

/** The shared registry table row — a skill name, its pin, verdict, and status. */
export function SkillList({ entries }: { entries: RegistryEntry[] }) {
  if (entries.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-[#a8a29e]">No skills yet.</div>;
  }
  return (
    <div>
      {entries.map(({ record, status: seedStatus }) => {
        const status = STATUS_STYLE[seedStatus] ?? { label: seedStatus, cls: "text-[#78716c]", row: "" };
        const verdictLabel = record.verdict
          ? `${record.verdict.status} · risk ${record.verdict.riskScore}`
          : "no verdict yet";
        return (
          <Link
            key={record.name}
            href={`/a/${encodeURIComponent(record.pin)}`}
            className={`flex items-center gap-4 border-b border-[#f5f4f1] px-6 py-4 transition-colors last:border-0 hover:bg-[#faf9f7] ${status.row}`}
          >
            <span className="flex-1 font-mono text-sm">{record.name}</span>
            <span className="hidden font-mono text-xs text-[#a8a29e] sm:block">
              {shortHash(record.pin, 6, 4)}
            </span>
            <span className="hidden w-40 text-xs text-[#a8a29e] sm:block">{verdictLabel}</span>
            <span className={`w-24 text-right text-[13px] font-medium ${status.cls}`}>
              {status.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
