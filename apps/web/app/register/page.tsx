"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { zeroAddress } from "viem";
import { namehash } from "viem/ens";
import { ConnectButton } from "@/components/connect-button";
import {
  ALL_ROLES,
  COMPANY,
  COMPANY_REGISTRY,
  ENS_RESOLVER,
  MAX_EXPIRY,
  ORG_REGISTRY,
  PUBLIC_RESOLVER,
  permissionedRegistryAbi,
  permissionedResolverAbi,
} from "@/lib/ens-contracts";

const ROOT = "safeskills.eth";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="text-[13px] uppercase tracking-[0.04em] text-accent">Submit a skill</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">
          Publish your skills
        </h1>
        <p className="max-w-2xl text-[#57534e]">
          Connect your wallet, claim your company name on ENS, and submit skills for review. Your
          wallet owns the names and pays the gas — no account, no custody.
        </p>
      </header>

      {mounted ? (
        <RegisterBody />
      ) : (
        <div className="h-40 rounded-2xl border border-[#e7e5e1] bg-white" />
      )}
    </div>
  );
}

function RegisterBody() {
  const { isConnected } = useAccount();
  if (!isConnected) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#e7e5e1] bg-white p-8">
        <p className="text-[#57534e]">Connect a wallet to get started.</p>
        <ConnectButton />
      </div>
    );
  }
  return (
    <>
      <CreateOrg />
      <SubmitSkill />
    </>
  );
}

function CreateOrg() {
  const { address } = useAccount();
  const [label, setLabel] = useState("");
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const name = label ? `${slug(label)}.${ROOT}` : `your-company.${ROOT}`;
  const ready = Boolean(slug(label) && address && ORG_REGISTRY);

  function create() {
    if (!ready) return;
    reset();
    writeContract({
      address: ORG_REGISTRY as `0x${string}`,
      abi: permissionedRegistryAbi,
      functionName: "register",
      args: [slug(label), address!, zeroAddress, PUBLIC_RESOLVER, ALL_ROLES, MAX_EXPIRY],
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#e7e5e1] bg-white p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">1 · Claim your company name</h2>
        <p className="mt-1 text-sm text-[#78716c]">
          A subname under <span className="font-mono">{ROOT}</span> that your wallet owns.
        </p>
      </div>

      <label className="block">
        <span className="text-sm text-[#57534e]">Company name</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="acme"
          className="mt-1 w-full rounded-md border border-[#d6d3ce] px-3 py-2 font-mono text-sm outline-none focus:border-ink"
        />
      </label>

      <div className="rounded-md bg-[#faf9f7] px-3 py-2 font-mono text-sm">{name}</div>

      {!ORG_REGISTRY && (
        <p className="rounded-md bg-[#fffaf0] px-3 py-2 text-xs text-[#92710a]">
          Company registry not deployed yet — attach a subregistry to{" "}
          <span className="font-mono">{ROOT}</span> and set{" "}
          <span className="font-mono">NEXT_PUBLIC_ORG_REGISTRY</span> to enable on-chain registration.
        </p>
      )}

      <button
        disabled={!ready || isPending || confirming}
        onClick={create}
        className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {isPending ? "Confirm in wallet…" : confirming ? "Registering…" : "Create company →"}
      </button>

      {isSuccess && (
        <p className="text-sm text-accent">
          ✓ Registered <span className="font-mono">{name}</span> ·{" "}
          <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            view tx
          </a>
        </p>
      )}
      {error && (
        <p className="break-words text-sm text-[#dc2626]">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </section>
  );
}

type Step = "idle" | "register" | "pin" | "done";

function SubmitSkill() {
  const { address } = useAccount();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");

  const { writeContract, data: hash, error: txError, reset } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });
  const processed = useRef<string | undefined>(undefined);

  const validUrl = /^https?:\/\//i.test(url);
  const fullName = `${slug(label) || "your-skill"}.${COMPANY}.${ROOT}`;
  const node = namehash(fullName);
  const ready = Boolean(slug(label) && pin && address && COMPANY_REGISTRY && ENS_RESOLVER);

  // Two-step publish: register the subname, then (once it confirms) write the pin.
  // Each tx hash is processed once so the second step can't fire on the first's
  // lingering "confirmed" state.
  useEffect(() => {
    if (!confirmed || !hash || hash === processed.current) return;
    processed.current = hash;
    if (step === "register") {
      setStep("pin");
      writeContract({
        address: ENS_RESOLVER,
        abi: permissionedResolverAbi,
        functionName: "setText",
        args: [node as `0x${string}`, "safeskills.pin", pin!],
      });
    } else if (step === "pin") {
      setStep("done");
    }
  }, [confirmed, hash, step, node, pin, writeContract]);

  async function computePin() {
    setBusy(true);
    setError(null);
    setPin(null);
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { pin?: string; bytes?: number; error?: string };
      if (!res.ok || !data.pin) throw new Error(data.error ?? "could not hash URL");
      setPin(data.pin);
      setBytes(data.bytes ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function publish() {
    if (!ready) return;
    reset();
    processed.current = undefined;
    setStep("register");
    writeContract({
      address: COMPANY_REGISTRY as `0x${string}`,
      abi: permissionedRegistryAbi,
      functionName: "register",
      args: [slug(label), address!, zeroAddress, ENS_RESOLVER, ALL_ROLES, MAX_EXPIRY],
    });
  }

  const pending = step === "register" || step === "pin";

  return (
    <section className="space-y-4 rounded-2xl border border-[#e7e5e1] bg-white p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">2 · Submit a skill</h2>
        <p className="mt-1 text-sm text-[#78716c]">
          Link its <span className="font-mono">SKILL.md</span> URL — we fetch and hash it, then pin
          that hash on the skill&apos;s ENS name. Chainlink CRE re-fetches the same URL, reviews it,
          and writes the verdict.
        </p>
      </div>

      <label className="block">
        <span className="text-sm text-[#57534e]">Skill name</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="weather"
          className="mt-1 w-full rounded-md border border-[#d6d3ce] px-3 py-2 font-mono text-sm outline-none focus:border-ink"
        />
        <span className="mt-1 block font-mono text-xs text-[#a8a29e]">{fullName}</span>
      </label>

      <label className="block">
        <span className="text-sm text-[#57534e]">SKILL.md URL</span>
        <div className="mt-1 flex gap-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPin(null);
            }}
            placeholder="https://raw.githubusercontent.com/acme/skills/main/weather/SKILL.md"
            className="w-full rounded-md border border-[#d6d3ce] px-3 py-2 font-mono text-sm outline-none focus:border-ink"
          />
          <button
            disabled={!validUrl || busy}
            onClick={computePin}
            className="shrink-0 rounded-md border border-[#d6d3ce] bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-[#faf9f7] disabled:opacity-50"
          >
            {busy ? "Hashing…" : "Fetch & hash"}
          </button>
        </div>
      </label>

      {pin && (
        <div className="space-y-1 rounded-md bg-[#faf9f7] px-3 py-2 font-mono text-xs">
          <div className="text-[#78716c]">content pin{bytes != null ? ` · ${bytes} bytes` : ""}</div>
          <div className="break-all">{pin}</div>
        </div>
      )}
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {!COMPANY_REGISTRY && (
        <p className="rounded-md bg-[#fffaf0] px-3 py-2 text-xs text-[#92710a]">
          Set <span className="font-mono">NEXT_PUBLIC_COMPANY_REGISTRY</span> (your company&apos;s
          subregistry) to enable on-chain publishing.
        </p>
      )}

      <button
        disabled={!ready || pending}
        onClick={publish}
        className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {step === "register"
          ? "Registering name…"
          : step === "pin"
            ? "Writing pin…"
            : "Submit skill →"}
      </button>

      {step === "done" && (
        <p className="text-sm text-accent">
          ✓ Published <span className="font-mono">{fullName}</span> ·{" "}
          <a
            href={`https://explorer.ens.dev/${fullName}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            view on ENS
          </a>
        </p>
      )}
      {txError && (
        <p className="break-words text-sm text-[#dc2626]">
          {(txError as { shortMessage?: string }).shortMessage ?? txError.message}
        </p>
      )}
    </section>
  );
}
