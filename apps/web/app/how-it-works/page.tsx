import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works — Aegis",
  description:
    "Every artifact travels one tamper-proof path: hashed, signed on Ledger, anchored on-chain via Chainlink CRE, resolvable by ENS name.",
};

const PIPELINE = [
  { title: "Artifact", sub: "raw source", tone: "default" },
  { title: "Hash", sub: "fingerprint", tone: "default" },
  { title: "Ledger sign", sub: "hardware key", tone: "default" },
  { title: "Chainlink CRE", sub: "anchor on-chain", tone: "ink" },
  { title: "ENS verified", sub: "name.aegis.eth", tone: "accent" },
];

const STAGES = [
  {
    n: "01",
    title: "Hash & sign",
    body: "The bundle and manifest are fingerprinted separately and signed by a Ledger device — the trust key never touches the network.",
  },
  {
    n: "02",
    title: "Chainlink CRE workflow",
    body: "A CRE workflow validates the signature and writes the pinned record on-chain, automatically and verifiably.",
  },
  {
    n: "03",
    title: "ENS naming",
    body: "Each artifact gets a human-readable ENS name — anyone can resolve it and look up its full provenance history.",
  },
  {
    n: "04",
    title: "Verify at runtime",
    body: "Before execution, the verifier re-hashes the real bytes and checks them against the chain. Any mismatch is blocked.",
  },
];

function PipelineCard({ title, sub, tone }: { title: string; sub: string; tone: string }) {
  const border =
    tone === "accent"
      ? "border-accent bg-[#f3fbf7]"
      : tone === "ink"
        ? "border-ink"
        : "border-[#e7e5e1]";
  const titleColor = tone === "accent" ? "text-accent" : "";
  return (
    <div className={`min-w-[140px] rounded-xl border px-4 py-5 ${border}`}>
      <div className={`text-[15px] font-semibold ${titleColor}`}>{title}</div>
      <div className="mt-0.5 text-[13px] text-[#a8a29e]">{sub}</div>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div>
      {/* hero + pipeline */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-20 text-center">
        <div className="mb-4 text-[13px] uppercase tracking-[0.04em] text-accent">
          The trust pipeline
        </div>
        <h1 className="mx-auto max-w-3xl font-display text-5xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-6xl">
          From raw artifact to verified execution.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#57534e]">
          Every npm package and MCP server travels one tamper-proof path — signed by hardware,
          anchored on-chain, resolvable by name.
        </p>

        <div className="mt-12 flex items-center justify-center gap-0 overflow-x-auto pb-2">
          {PIPELINE.map((p, i) => (
            <div key={p.title} className="flex items-center">
              <PipelineCard {...p} />
              {i < PIPELINE.length - 1 && <span className="px-3 text-xl text-[#d6d3ce]">→</span>}
            </div>
          ))}
        </div>

        <div className="mt-11 flex flex-wrap justify-center gap-3">
          <Link
            href="/verify"
            className="rounded-md bg-ink px-6 py-3 text-base font-medium text-white transition-colors hover:bg-ink/90"
          >
            Get the SDK →
          </Link>
          <Link
            href="/"
            className="rounded-md border border-[#d6d3ce] bg-white px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-[#faf9f7]"
          >
            See the live registry
          </Link>
        </div>
      </section>

      {/* each stage expanded (dark) */}
      <section className="bg-night px-6 py-20 text-[#fafaf9]">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl font-semibold tracking-[-0.01em]">
            What happens at each stage
          </h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[#2a2520] bg-[#2a2520] sm:grid-cols-2">
            {STAGES.map((s) => (
              <div key={s.n} className="flex gap-4 bg-night p-6">
                <span className="font-display text-[15px] font-semibold text-[#34d399]">{s.n}</span>
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-[#a8a29e]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* why it matters */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em]">
          Why the pipeline matters
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[#78716c]">
          Without it, a single swapped artifact hijacks the agent — silently, with no trace.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {["supply-chain swap", "manifest poisoning", "no audit trail"].map((x) => (
            <span
              key={x}
              className="rounded-full border border-[#f1c9c9] bg-[#fef5f5] px-4 py-1.5 text-sm text-[#dc2626]"
            >
              {x}
            </span>
          ))}
        </div>
      </section>

      {/* footer CTA */}
      <section className="bg-mint px-6 py-20 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.02em]">
          Put your artifacts on the pipeline.
        </h2>
        <Link
          href="/verify"
          className="mt-6 inline-block rounded-md bg-ink px-8 py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-ink/90"
        >
          Get the SDK →
        </Link>
      </section>
    </div>
  );
}
