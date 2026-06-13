import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The threat — Aegis",
  description:
    "One edited skill and your agent leaks data, calls the wrong tool, or worse — and nothing in your logs would show it. Aegis verifies before it runs.",
};

const TIMELINE = [
  {
    dot: "#a8a29e",
    title: "Trusted skill installed",
    sub: "verified by no one",
    accent: false,
  },
  {
    dot: "#fbbf24",
    title: "Its Markdown is silently swapped",
    sub: "content changes, no alert",
    accent: false,
  },
  {
    dot: "#f87171",
    title: "Agent follows the poison",
    sub: "exfiltrates, no trace left",
    accent: true,
  },
];

export default function ThreatsPage() {
  return (
    <div>
      {/* threat hero (dark) */}
      <section className="bg-night px-6 py-20 text-[#fafaf9]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="mb-4 text-[13px] uppercase tracking-[0.04em] text-[#fca5a5]">
              The agent skill problem
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-6xl">
              Your agent just ran a skill it didn&apos;t vet.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#d6d3ce]">
              One edited skill and your agent leaks data, calls the wrong tool, or worse — and
              nothing in your logs would ever show it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#fix"
                className="rounded-md bg-mint px-6 py-3 text-base font-medium text-night transition-colors hover:bg-mint/90"
              >
                See the fix →
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-md border border-[#44403c] px-6 py-3 text-base font-medium text-[#fafaf9] transition-colors hover:bg-[#2a2520]"
              >
                How it works
              </Link>
            </div>
          </div>

          {/* attack timeline */}
          <div>
            <div className="mb-5 text-[13px] uppercase tracking-[0.04em] text-[#a8a29e]">
              Anatomy of a skill hijack
            </div>
            <div className="flex flex-col">
              {TIMELINE.map((t, i) => (
                <div
                  key={t.title}
                  className={`relative ml-1.5 border-l border-[#44403c] pl-5 ${
                    i < TIMELINE.length - 1 ? "pb-6" : ""
                  }`}
                >
                  <span
                    className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full"
                    style={{ background: t.dot }}
                  />
                  <div className={`text-[15px] font-semibold ${t.accent ? "text-[#fca5a5]" : ""}`}>
                    {t.title}
                  </div>
                  <p className="mt-1 text-sm text-[#a8a29e]">{t.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* the fix */}
      <section id="fix" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 text-center">
        <div className="mb-4 text-[13px] uppercase tracking-[0.04em] text-accent">The fix</div>
        <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
          Don&apos;t trust skills. Verify them.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#57534e]">
          Aegis fingerprints every skill, evaluates it with a trustless AI attestor on Chainlink
          CRE, gates it behind policies you approve on Ledger, and names it on ENS. The verifier
          checks before it runs.
        </p>

        <div className="mx-auto mt-11 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-[#f1c9c9] bg-[#fef5f5] p-6">
            <div className="mb-2.5 text-base font-semibold text-[#dc2626]">✗ Without Aegis</div>
            <p className="text-[15px] leading-relaxed text-[#9f5050]">
              Skills run on blind trust. Tampering is invisible. No proof of what the agent followed.
            </p>
          </div>
          <div className="rounded-xl border border-[#b7e3cd] bg-[#f3fbf7] p-6">
            <div className="mb-2.5 text-base font-semibold text-accent">✓ With Aegis</div>
            <p className="text-[15px] leading-relaxed text-[#3f7a5f]">
              Every run checks hash vs. on-chain record. Tampered skills are blocked. Full audit
              trail.
            </p>
          </div>
        </div>

        {/* mini pipeline */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-[15px] text-[#57534e]">
          <span className="rounded-full border border-[#e7e5e1] px-4 py-2">Hash</span>
          <span className="text-[#d6d3ce]">→</span>
          <span className="rounded-full border border-[#e7e5e1] px-4 py-2">AI attestor</span>
          <span className="text-[#d6d3ce]">→</span>
          <span className="rounded-full border border-[#e7e5e1] px-4 py-2">Ledger policy</span>
          <span className="text-[#d6d3ce]">→</span>
          <span className="rounded-full border border-[#b7e3cd] bg-[#f3fbf7] px-4 py-2 text-accent">
            ENS verify
          </span>
        </div>
      </section>

      {/* footer CTA (dark) */}
      <section className="bg-night px-6 py-20 text-center text-[#fafaf9]">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.02em]">
          Close the door before it&apos;s kicked in.
        </h2>
        <Link
          href="/verify"
          className="mt-6 inline-block rounded-md bg-mint px-8 py-3.5 text-[17px] font-medium text-night transition-colors hover:bg-mint/90"
        >
          Get the SDK →
        </Link>
      </section>
    </div>
  );
}
