import Link from "next/link";
import { getRegistry } from "@/lib/registry.server";
import { SkillList } from "@/components/skill-list";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { CARD_TINTS } from "@/lib/card-tints";

export const runtime = "nodejs";
export const revalidate = 30;

const STEPS = [
  {
    n: "01",
    title: "Name on ENS",
    body: "Each skill gets a human-readable ENS name that pins the exact content hash of its Markdown.",
  },
  {
    n: "02",
    title: "Attest via Chainlink CRE",
    body: "A trustless AI attestor runs inside Chainlink CRE and posts a signed safety verdict on-chain.",
  },
  {
    n: "03",
    title: "Gate on Ledger",
    body: "You set what skills may do. Approvals and emergency bypasses are signed on your hardware device.",
  },
  {
    n: "04",
    title: "Verify before it runs",
    body: "The verifier re-hashes the live skill and checks it against the chain. Any mismatch is blocked.",
  },
];

const THREATS = [
  {
    title: "Skill swap",
    body: "A skill's Markdown is silently edited at its URL — new content, no alert.",
  },
  {
    title: "Frontmatter poisoning",
    body: "A skill's allowed-tools is rewritten to grant capabilities it was never trusted with.",
  },
  {
    title: "No audit trail",
    body: "No way to prove which version of a skill actually ran, or who approved it.",
  },
];

export default async function HomePage() {
  const entries = await getRegistry();

  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-4 text-[13px] uppercase tracking-[0.04em] text-accent">
              Integrity for agent skills
            </div>
            <h1 className="font-display text-5xl font-semibold leading-[1.03] tracking-[-0.025em] sm:text-6xl">
              Verify every skill before it runs.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#57534e]">
              Cryptographic integrity for agent skills — each named on ENS, evaluated by a trustless
              AI attestor on Chainlink CRE, and gated by policies you approve on your Ledger.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/sdk"
                className="rounded-md bg-ink px-6 py-3 text-base font-medium text-white transition-colors hover:bg-ink/90"
              >
                Get the SDK →
              </Link>
              <Link
                href="/#how"
                className="rounded-md border border-[#d6d3ce] bg-white px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-[#faf9f7]"
              >
                How it works
              </Link>
            </div>
            <div className="mt-8 rounded-[10px] bg-ink px-5 py-4 font-mono text-[13px] leading-[1.9] text-mint">
              <div className="text-[#78716c]">$ npm i -g @aegis/safeskill</div>
              <div>$ safeskill onboard --ledger --min-security 70</div>
              <div>$ safeskill check weather.acme.safeskills.eth</div>
            </div>
          </div>

          {/* terminal mock */}
          <div className="rounded-xl bg-night p-6 font-mono text-[13px] leading-[1.95] text-[#e7e5e4] shadow-2xl">
            <div className="text-[#78716c]">$ safeskill onboard --ledger --min-security 70</div>
            <div className="text-[#34d399]">✓ policy · auto-approve ≥ 70% · below → Ledger override</div>
            <div className="h-3" />
            <div className="text-[#78716c]">$ safeskill use weather.acme.safeskills.eth</div>
            <div className="text-[#34d399]">✓ hash matches ENS pin · verdict pass · security 97%</div>
            <div className="text-mint">AUTO-APPROVE — installed</div>
            <div className="h-3" />
            <div className="text-[#78716c]">$ safeskill use sync.evilcorp.safeskills.eth</div>
            <div className="text-[#fbbf24]">⚠ verdict fail · security 4% — below policy</div>
            <div className="text-[#fbbf24]">NEEDS OVERRIDE — Ledger signature required</div>
            <div className="h-3" />
            <div className="text-[#78716c]">$ safeskill use tampered.acme.safeskills.eth</div>
            <div className="text-[#f87171]">✗ content hash ≠ pinned hash</div>
            <div className="text-[#fca5a5]">BLOCKED — a signature can&apos;t override this</div>
          </div>
        </div>
      </section>

      {/* ===== THREAT STRIP ===== */}
      <section className="bg-night px-6 py-20 text-[#fafaf9]">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">
            A poisoned skill is a hijacked agent.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[#a8a29e]">
            Skills are instructions your agent follows blindly. Tamper with one and you own the
            agent.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-px overflow-hidden rounded-xl border border-[#2a2520] bg-[#2a2520] sm:grid-cols-3">
            {THREATS.map((t) => (
              <div key={t.title} className="bg-night p-7">
                <div className="text-[17px] font-semibold text-[#f87171]">{t.title}</div>
                <p className="mt-2.5 text-sm leading-relaxed text-[#a8a29e]">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
        <h2 className="text-center font-display text-4xl font-semibold tracking-[-0.01em]">
          How it works
        </h2>
        <p className="mt-2 text-center text-[#78716c]">
          Four steps from a Markdown skill to verifiable execution.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const tint = CARD_TINTS[i % CARD_TINTS.length]!;
            return (
              <div
                key={s.n}
                className={`rounded-xl border p-6 transition-colors ${tint.bg} ${tint.border} ${tint.hoverBorder}`}
              >
                <div className="mb-3.5 font-display text-[15px] font-semibold text-accent">
                  {s.n}
                </div>
                <div className="mb-2 text-lg font-semibold">{s.title}</div>
                <p className="text-sm leading-relaxed text-[#57534e]">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== ARCHITECTURE DIAGRAM ===== */}
      <section id="architecture" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-20">
        <div className="mb-7 text-center">
          <div className="mb-2 text-[13px] uppercase tracking-[0.04em] text-accent">
            The architecture
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em]">
            One pipeline, public and private skills.
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[#78716c]">
            A Chainlink CRE workflow reviews each skill inside a TEE and writes a verifiable verdict
            on-chain — private code never leaves the enclave.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#e7e5e1] bg-white p-5 sm:p-8">
          <ArchitectureDiagram />
        </div>
      </section>

      {/* ===== LIVE REGISTRY (real data) ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-[#e7e5e1] bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#f0eee9] px-6 py-5">
            <span className="font-display text-lg font-semibold">Live registry</span>
            <span className="text-sm text-[#78716c]">
              — resolve any skill and re-verify it against its on-chain record
            </span>
            <Link
              href="/registry"
              className="ml-auto rounded-full border border-[#e7e5e1] px-3.5 py-1.5 font-mono text-xs text-[#78716c] transition-colors hover:border-ink hover:text-ink"
            >
              browse safeskills.eth →
            </Link>
          </div>
          <SkillList entries={entries} />
        </div>
      </section>

      {/* ===== INTEGRATIONS ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center font-display text-2xl font-semibold tracking-[-0.01em]">
          Built on tools you trust
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {["Chainlink CRE", "ENS", "Ledger", "Agent Skills", "AI Attestor", "CLI"].map((x, i) => {
            const tint = CARD_TINTS[i % CARD_TINTS.length]!;
            return (
              <span
                key={x}
                className={`rounded-full border px-4 py-2 text-sm font-medium text-ink ${tint.bg} ${tint.border}`}
              >
                {x}
              </span>
            );
          })}
        </div>
      </section>

      {/* ===== FOOTER CTA ===== */}
      <section className="bg-mint px-6 py-20 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.02em]">
          Ship agents that can&apos;t be hijacked.
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
