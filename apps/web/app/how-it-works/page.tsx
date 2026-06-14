import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works — Aegis",
  description:
    "Every agent skill travels one tamper-proof path: named on ENS, evaluated by a trustless AI attestor on Chainlink CRE, gated by your Ledger, and re-verified before it runs.",
};

const PIPELINE = [
  { title: "Skill", sub: "Markdown at a URL", tone: "default" },
  { title: "Hash", sub: "content fingerprint", tone: "default" },
  { title: "AI attestor", sub: "Chainlink CRE", tone: "ink" },
  { title: "Ledger policy", sub: "you approve", tone: "default" },
  { title: "ENS verified", sub: "skill.acme.safeskills.eth", tone: "accent" },
];

const STAGES = [
  {
    n: "01",
    title: "Hash the skill",
    body: "A skill is a Markdown file at a URL. Aegis fingerprints it into a single content hash — change one character and the hash moves.",
  },
  {
    n: "02",
    title: "AI attestor on Chainlink CRE",
    body: "A trustless AI evaluator runs inside Chainlink CRE, scores the skill for prompt injection and capability over-reach, and posts a signed verdict on-chain — no party you have to trust.",
  },
  {
    n: "03",
    title: "Policy & bypass on Ledger",
    body: "You set what skills may do. Approvals and emergency bypasses are signed on your Ledger — every override is hardware-signed, time-boxed, and auditable.",
  },
  {
    n: "04",
    title: "Verify before it runs",
    body: "Before the agent loads a skill, the verifier re-hashes the live Markdown, checks the ENS pin and the attestor verdict, and blocks any mismatch.",
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
          From Markdown skill to verified execution.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#57534e]">
          Every agent skill travels one tamper-proof path — named on ENS, evaluated by a trustless
          AI attestor, gated by your Ledger.
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
            href="/sdk"
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
          Without it, a single edited skill hijacks the agent — silently, with no trace.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {["skill swap", "frontmatter poisoning", "no audit trail"].map((x) => (
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
          Put your skills on the pipeline.
        </h2>
        <Link
          href="/sdk"
          className="mt-6 inline-block rounded-md bg-ink px-8 py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-ink/90"
        >
          Get the SDK →
        </Link>
      </section>
    </div>
  );
}
