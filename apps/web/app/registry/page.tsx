import type { Metadata } from "next";
import { getRegistry } from "@/lib/registry.server";
import { RegistrySearch } from "@/components/registry-search";

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

      <RegistrySearch entries={entries} />
    </div>
  );
}
