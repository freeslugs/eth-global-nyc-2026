import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SDK — safeskill",
  description:
    "safeskill is the SDK + CLI your agent runs. Onboard a signer and a policy, then gate every skill against the ENS registry before it loads — auto-approve, require a Ledger override, or block.",
};

export const dynamic = "force-static";

const DECISIONS = [
  {
    label: "AUTO-APPROVE",
    cls: "text-accent border-accent bg-[#f3fbf7]",
    when: "rating ≥ policy · verdict passes · hash matches",
    body: "Installed with no human in the loop.",
  },
  {
    label: "NEEDS OVERRIDE",
    cls: "text-[#b45309] border-[#f5d9a8] bg-[#fffaf0]",
    when: "below policy · failing verdict · unreviewed",
    body: "Installable only with a verified Ledger signature — the bypass override.",
  },
  {
    label: "BLOCKED",
    cls: "text-[#dc2626] border-[#f1c9c9] bg-[#fef5f5]",
    when: "content hash ≠ pinned hash (tampering)",
    body: "Never installable. A signature cannot override the integrity floor.",
  },
];

const COMMANDS: [string, string][] = [
  ["safeskill onboard --ledger --min-security 70", "Part 1 — hook up a signer + set the policy"],
  ["safeskill policy", "Show the active ruleset (or --presets for the built-ins)"],
  ["safeskill list", "The registry + the decision the policy makes for each skill"],
  ["safeskill check <name>", "Resolve ENS → re-hash → decide (no install)"],
  ["safeskill use <name>", "check + install: auto-approve, or require a Ledger override"],
];

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-night p-6 font-mono text-[13px] leading-[1.95] text-[#e7e5e4] shadow-xl">
      {children}
    </div>
  );
}

export default function SdkPage() {
  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="mb-4 text-[13px] uppercase tracking-[0.04em] text-accent">The agent SDK</div>
            <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-[-0.025em] sm:text-6xl">
              Gate every skill before your agent loads it.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#57534e]">
              <code className="font-mono text-[15px] text-ink">safeskill</code> is the SDK + CLI your agent runs. Onboard a
              signer and a policy once, then it checks each skill against the ENS registry, re-hashes the file locally, and
              decides — <span className="text-accent">auto-approve</span>, a{" "}
              <span className="text-[#b45309]">Ledger override</span>, or <span className="text-[#dc2626]">block</span>.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/registry"
                className="rounded-md bg-ink px-6 py-3 text-base font-medium text-white transition-colors hover:bg-ink/90"
              >
                Browse the registry →
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-md border border-[#d6d3ce] bg-white px-6 py-3 text-base font-medium text-ink transition-colors hover:bg-[#faf9f7]"
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[13px] uppercase tracking-[0.04em] text-[#a8a29e]">Install</div>
            <Mono>
              <div className="text-[#78716c]"># install the CLI globally</div>
              <div className="text-mint">$ npm i -g @aegis/safeskill</div>
              <div className="h-3" />
              <div className="text-[#78716c]"># …or run it straight from the monorepo</div>
              <div className="text-mint">$ pnpm --filter @aegis/safeskill build</div>
              <div className="text-mint">
                $ alias safeskill=&quot;node $PWD/packages/safeskill/dist/cli.js&quot;
              </div>
            </Mono>
            <p className="text-xs text-[#a8a29e]">
              Runs offline against a hardcoded demo registry with zero chain config.{" "}
              <code className="font-mono">--ens</code> swaps in real ENS v2 on Sepolia.
            </p>
          </div>
        </div>
      </section>

      {/* ===== TWO PARTS ===== */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-[#e7e5e1] bg-[#e7e5e1] sm:grid-cols-2">
          <div className="bg-[#eafaf2] p-8">
            <div className="mb-2 font-display text-[15px] font-semibold text-accent">Part 1</div>
            <h2 className="text-xl font-semibold">Onboard</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
              Hook up a signer — a real <strong>Ledger</strong>, a local dev key, or none — and set a{" "}
              <strong>policy</strong>. The policy is yours: a preset, a one-line threshold, or a custom ruleset. It is
              persisted to <code className="font-mono text-xs">~/.safeskill/config.json</code>.
            </p>
          </div>
          <div className="bg-[#eaf3fd] p-8">
            <div className="mb-2 font-display text-[15px] font-semibold text-accent">Part 2</div>
            <h2 className="text-xl font-semibold">Gate</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
              Before loading any skill, <code className="font-mono text-xs">safeskill</code> resolves its verdict from the{" "}
              <strong>ENS registry</strong>, re-hashes the live file, and runs your policy. Below-policy skills require a
              hardware signature; tampered files are always blocked.
            </p>
          </div>
        </div>
      </section>

      {/* ===== THE DECISION ===== */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center font-display text-3xl font-semibold tracking-[-0.01em]">Three outcomes</h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[#78716c]">
          Every skill resolves to exactly one — decided by your policy, with one floor it can never loosen.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {DECISIONS.map((d) => (
            <div key={d.label} className={`rounded-xl border p-6 ${d.cls}`}>
              <div className="font-mono text-sm font-bold">{d.label}</div>
              <div className="mt-3 text-[13px] font-medium text-[#57534e]">{d.when}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#78716c]">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TERMINAL WALKTHROUGH ===== */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <Mono>
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
        </Mono>
      </section>

      {/* ===== POLICY IS YOURS ===== */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="mb-2 text-[13px] uppercase tracking-[0.04em] text-accent">Customizable</div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.01em]">The policy is yours.</h2>
            <p className="mt-3 text-[#57534e]">
              A policy is an ordered ruleset evaluated top-to-bottom, first match wins, then a default. Plain JSON — ship
              it, hand-edit it, or pick a preset. Predicates compose with AND:
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-[#57534e]">
              <li>
                <code className="font-mono text-xs">minSecurityRating</code> ·{" "}
                <code className="font-mono text-xs">maxSecurityRating</code> — 0–100, higher is safer
              </li>
              <li>
                <code className="font-mono text-xs">verdictStatus</code> ·{" "}
                <code className="font-mono text-xs">hasVerdict</code> · <code className="font-mono text-xs">revoked</code>
              </li>
              <li>
                <code className="font-mono text-xs">publisherIn</code> ·{" "}
                <code className="font-mono text-xs">publisherNotIn</code> — trust by ENS parent
              </li>
            </ul>
            <p className="mt-4 text-sm text-[#78716c]">
              Built-in presets: <code className="font-mono text-xs">default</code> ·{" "}
              <code className="font-mono text-xs">strict</code> · <code className="font-mono text-xs">permissive</code>.
              Set one with <code className="font-mono text-xs">--preset</code>,{" "}
              <code className="font-mono text-xs">--min-security</code>, or{" "}
              <code className="font-mono text-xs">--policy ./file.json</code>.
            </p>
          </div>
          <Mono>
            <pre className="whitespace-pre">{`{
  "name": "trust-acme-only",
  "rules": [
    { "publisherNotIn": ["acme.safeskills.eth"],
      "action": "blocked" },
    { "minSecurityRating": 70,
      "verdictStatus": "pass",
      "action": "auto-approve" }
  ],
  "default": "needs-override"
}`}</pre>
          </Mono>
        </div>
      </section>

      {/* ===== FAIL-CLOSED ===== */}
      <section className="bg-night px-6 py-16 text-[#fafaf9]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 text-[13px] uppercase tracking-[0.04em] text-[#34d399]">Fail-closed by design</div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.01em]">
            If the signature fails, the skill never loads.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#a8a29e]">
            A skill is written to disk <strong className="text-[#fafaf9]">only</strong> on an explicit auto-approve, or a
            below-policy skill whose Ledger signature <em>verifies</em>. A blocked skill, a missing signer, a declined or
            errored signature, or one that fails verification all result in <strong className="text-[#fafaf9]">no
            install</strong> — nothing is fetched to disk.
          </p>
        </div>
      </section>

      {/* ===== SDK USAGE ===== */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="mb-2 text-[13px] uppercase tracking-[0.04em] text-accent">For agents</div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.01em]">Or call it from code.</h2>
            <p className="mt-3 text-[#57534e]">
              The same two parts as the CLI, behind a tiny typed API. Onboard once; then{" "}
              <code className="font-mono text-sm">use()</code> before loading any skill and respect the result.
            </p>
          </div>
          <Mono>
            <pre className="whitespace-pre text-[#e7e5e4]">{`import { Safeskill } from "@aegis/safeskill";

// 1 — onboard once (signer + policy)
await Safeskill.onboard({
  signer: "ledger",
  minSecurityRating: 70,
});

// 2 — gate a skill before loading it
const ss = await Safeskill.load();
const r = await ss.use("weather.acme.safeskills.eth");
if (!r.installed) throw new Error(r.error); // fail-closed`}</pre>
          </Mono>
        </div>
      </section>

      {/* ===== COMMAND REFERENCE ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em]">Command reference</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e7e5e1] bg-white">
          {COMMANDS.map(([cmd, desc], i) => (
            <div
              key={cmd}
              className={`flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-6 ${
                i < COMMANDS.length - 1 ? "border-b border-[#f5f4f1]" : ""
              }`}
            >
              <code className="font-mono text-[13px] text-ink sm:w-[52%]">{cmd}</code>
              <span className="text-sm text-[#78716c]">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FOOTER CTA ===== */}
      <section className="bg-mint px-6 py-20 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.02em]">Check a skill in 60 seconds.</h2>
        <div className="mx-auto mt-6 max-w-md">
          <Mono>
            <div className="text-mint">$ npm i -g @aegis/safeskill</div>
            <div className="text-mint">$ safeskill onboard --ledger --min-security 70</div>
            <div className="text-mint">$ safeskill check weather.acme.safeskills.eth</div>
          </Mono>
        </div>
        <Link
          href="/registry"
          className="mt-7 inline-block rounded-md bg-ink px-8 py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-ink/90"
        >
          Browse the registry →
        </Link>
      </section>
    </div>
  );
}
