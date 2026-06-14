"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { decodeEventLog, encodeFunctionData, type Address, type Hex } from "viem";
import { labelhash, namehash } from "viem/ens";
import { ConnectButton } from "@/components/connect-button";
import {
  ALL_ROLES,
  companyTokenId,
  MAX_EXPIRY,
  ORG_REGISTRY,
  PERMISSIONED_RESOLVER_IMPL,
  USER_REGISTRY_IMPL,
  VERIFIABLE_FACTORY,
  permissionedRegistryAbi,
  permissionedResolverAbi,
  proxyInitializeAbi,
  verifiableFactoryAbi,
} from "@/lib/ens-contracts";

const ROOT = "safeskills.eth";
const ZERO = "0x0000000000000000000000000000000000000000";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");

type Log = { data: Hex; topics: readonly Hex[] };

/** Pull the new proxy address out of a VerifiableFactory.deployProxy receipt. */
function proxyFrom(logs: readonly Log[]): Address {
  for (const log of logs) {
    try {
      const ev = decodeEventLog({
        abi: verifiableFactoryAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (ev.eventName === "ProxyDeployed") return (ev.args as { proxyAddress: Address }).proxyAddress;
    } catch {
      /* not our event */
    }
  }
  throw new Error("ProxyDeployed event not found in receipt");
}

const initData = (owner: Address): Hex =>
  encodeFunctionData({ abi: proxyInitializeAbi, functionName: "initialize", args: [owner, ALL_ROLES] });

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <div className="text-[13px] uppercase tracking-[0.04em] text-accent">Submit a skill</div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">Publish your skills</h1>
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
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [companyLabel, setCompanyLabel] = useState("");
  const company = slug(companyLabel);

  // If this wallet already owns a company, surface it instead of an empty claim
  // form: auto-fill the label (once) so the "company exists" flow + skill
  // submission light up without the user having to type or re-claim it.
  const owned = useOwnedCompanies(address);
  const autofilled = useRef(false);
  useEffect(() => {
    if (autofilled.current || companyLabel || !owned || owned.length === 0) return;
    autofilled.current = true;
    setCompanyLabel(owned[0]!);
  }, [owned, companyLabel]);

  // Look up the company's subregistry + resolver on-chain — the single source of
  // truth for "does this company exist and where do its skills live".
  const orgArgs = { address: (ORG_REGISTRY || undefined) as Address | undefined, abi: permissionedRegistryAbi } as const;
  const enabled = Boolean(company && ORG_REGISTRY);
  const { data: subregistry, refetch: refetchSub } = useReadContract({
    ...orgArgs,
    functionName: "getSubregistry",
    args: [company],
    query: { enabled },
  });
  const { data: resolver, refetch: refetchRes } = useReadContract({
    ...orgArgs,
    functionName: "getResolver",
    args: [company],
    query: { enabled },
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#e7e5e1] bg-white p-8">
        <p className="text-[#57534e]">Connect a wallet to get started.</p>
        <ConnectButton />
      </div>
    );
  }
  if (chainId !== sepolia.id) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-8">
        <p className="text-amber-800">Aegis runs on Sepolia. Switch your wallet to continue.</p>
        <button
          onClick={() => switchChain({ chainId: sepolia.id })}
          disabled={switching}
          className="rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
        >
          {switching ? "Switching…" : "Switch to Sepolia"}
        </button>
      </div>
    );
  }

  const exists = Boolean(subregistry && subregistry !== ZERO);
  const refetch = () => {
    void refetchSub();
    void refetchRes();
  };

  return (
    <>
      <CompanyPanel
        label={companyLabel}
        setLabel={setCompanyLabel}
        company={company}
        exists={exists}
        onCreated={refetch}
      />
      <SubmitSkill
        company={company}
        exists={exists}
        registry={subregistry as Address | undefined}
        resolver={resolver as Address | undefined}
      />
    </>
  );
}

type OrgStep = "idle" | "authorizing" | "registry" | "resolver" | "register" | "done";

/**
 * The company labels this wallet actually owns on-chain. We can't enumerate the
 * registry, so we take the candidate labels the app knows about (the orgs in
 * /api/registry) and confirm ownership against ORG_REGISTRY.ownerOf — the real
 * source of truth, not the mock owner in the registry payload. Returns labels
 * like `["acme"]`; `null` while loading so callers don't act prematurely.
 */
function useOwnedCompanies(address?: string) {
  const client = usePublicClient({ chainId: sepolia.id });
  const [labels, setLabels] = useState<string[] | null>(null);
  useEffect(() => {
    if (!address || !client || !ORG_REGISTRY) {
      setLabels(address ? [] : null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/registry");
        const data = (await res.json()) as { skills?: { name: string }[] };
        // The org label sits just below the root: weather.acme.safeskills.eth → "acme".
        const candidates = new Set<string>();
        for (const s of data.skills ?? []) {
          const parts = s.name.split(".");
          if (parts.length >= 3) candidates.add(parts[parts.length - 3]!);
        }
        const owned: string[] = [];
        await Promise.all(
          [...candidates].map(async (label) => {
            try {
              const owner = await client.readContract({
                address: ORG_REGISTRY as Address,
                abi: permissionedRegistryAbi,
                functionName: "ownerOf",
                args: [companyTokenId(label)],
              });
              if (String(owner).toLowerCase() === address.toLowerCase()) owned.push(label);
            } catch {
              /* unregistered label → ownerOf reverts; not owned */
            }
          }),
        );
        if (!cancelled) setLabels(owned.sort());
      } catch {
        if (!cancelled) setLabels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, client]);
  return labels;
}

function CompanyPanel({
  label,
  setLabel,
  company,
  exists,
  onCreated,
}: {
  label: string;
  setLabel: (v: string) => void;
  company: string;
  exists: boolean;
  onCreated: () => void;
}) {
  const { address } = useAccount();
  const { writeContract, data: hash, error, reset } = useWriteContract();
  const { data: receipt, isSuccess } = useWaitForTransactionReceipt({ hash });
  const processed = useRef<string | undefined>(undefined);
  const registryRef = useRef<Address | undefined>(undefined);
  const resolverRef = useRef<Address | undefined>(undefined);
  const [step, setStep] = useState<OrgStep>("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  const fullName = `${company || "your-company"}.${ROOT}`;
  const ready = Boolean(company && address && ORG_REGISTRY && !exists);

  // 3-tx flow: deploy the company's subregistry → its resolver → register it.
  useEffect(() => {
    if (!isSuccess || !receipt || hash === processed.current) return;
    processed.current = hash;
    if (step === "registry") {
      registryRef.current = proxyFrom(receipt.logs);
      setStep("resolver");
      writeContract({
        address: VERIFIABLE_FACTORY,
        abi: verifiableFactoryAbi,
        functionName: "deployProxy",
        args: [PERMISSIONED_RESOLVER_IMPL, BigInt(labelhash(`${company}:resolver`)), initData(address!)],
      });
    } else if (step === "resolver") {
      resolverRef.current = proxyFrom(receipt.logs);
      setStep("register");
      writeContract({
        address: ORG_REGISTRY as Address,
        abi: permissionedRegistryAbi,
        functionName: "register",
        args: [company, address!, registryRef.current!, resolverRef.current!, ALL_ROLES, MAX_EXPIRY],
      });
    } else if (step === "register") {
      setStep("done");
      onCreated();
    }
  }, [isSuccess, receipt, hash, step, company, address, writeContract, onCreated]);

  async function create() {
    if (!ready) return;
    setAuthError(null);
    // Authorize this wallet to register under safeskills.eth (server grants
    // ROLE_REGISTRAR with the admin key) BEFORE the user's own register tx.
    setStep("authorizing");
    try {
      const res = await fetch("/api/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "authorization failed");
    } catch (e) {
      setAuthError((e as Error).message);
      setStep("idle");
      return;
    }

    reset();
    processed.current = undefined;
    registryRef.current = undefined;
    resolverRef.current = undefined;
    setStep("registry");
    writeContract({
      address: VERIFIABLE_FACTORY,
      abi: verifiableFactoryAbi,
      functionName: "deployProxy",
      args: [USER_REGISTRY_IMPL, BigInt(labelhash(`${company}:registry`)), initData(address!)],
    });
  }

  const busy = step !== "idle" && step !== "done";
  const label3 =
    step === "authorizing"
      ? "Authorizing…"
      : step === "registry"
        ? "Deploying registry…"
        : step === "resolver"
          ? "Deploying resolver…"
          : step === "register"
            ? "Registering company…"
            : "Create company →";

  return (
    <section className="space-y-4 rounded-2xl border border-[#e7e5e1] bg-white p-6">
      <div>
        <h2 className="font-display text-xl font-semibold">1 · Claim your company name</h2>
        <p className="mt-1 text-sm text-[#78716c]">
          A subname under <span className="font-mono">{ROOT}</span>, with its own subregistry +
          resolver that your wallet owns.
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

      <div className="rounded-md bg-[#faf9f7] px-3 py-2 font-mono text-sm">{fullName}</div>

      {!ORG_REGISTRY && (
        <p className="rounded-md bg-[#fffaf0] px-3 py-2 text-xs text-[#92710a]">
          Set <span className="font-mono">NEXT_PUBLIC_ORG_REGISTRY</span> to enable on-chain
          registration.
        </p>
      )}

      {exists ? (
        <p className="text-sm text-accent">
          ✓ <span className="font-mono">{fullName}</span> exists — submit skills under it below.
        </p>
      ) : (
        <button
          disabled={!ready || busy}
          onClick={create}
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? label3 : "Create company →"}
        </button>
      )}

      {authError && <p className="break-words text-sm text-[#dc2626]">{authError}</p>}
      {error && (
        <p className="break-words text-sm text-[#dc2626]">
          {(error as { shortMessage?: string }).shortMessage ?? error.message}
        </p>
      )}
    </section>
  );
}

type SkillStep = "idle" | "register" | "pin" | "done";

function SubmitSkill({
  company,
  exists,
  registry,
  resolver,
}: {
  company: string;
  exists: boolean;
  registry: Address | undefined;
  resolver: Address | undefined;
}) {
  const { address } = useAccount();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SkillStep>("idle");

  const { writeContract, data: hash, error: txError, reset } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });
  const processed = useRef<string | undefined>(undefined);

  const validUrl = /^https?:\/\//i.test(url);
  const fullName = `${slug(label) || "your-skill"}.${company || "your-company"}.${ROOT}`;
  const node = namehash(fullName);
  const ready = Boolean(slug(label) && pin && address && exists && registry && resolver);

  useEffect(() => {
    if (!confirmed || !hash || hash === processed.current || !resolver) return;
    processed.current = hash;
    if (step === "register") {
      setStep("pin");
      writeContract({
        address: resolver,
        abi: permissionedResolverAbi,
        functionName: "setText",
        args: [node as Hex, "safeskills.pin", pin!],
      });
    } else if (step === "pin") {
      setStep("done");
    }
  }, [confirmed, hash, step, node, pin, resolver, writeContract]);

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
    if (!ready || !registry || !resolver) return;
    reset();
    processed.current = undefined;
    setStep("register");
    writeContract({
      address: registry,
      abi: permissionedRegistryAbi,
      functionName: "register",
      args: [slug(label), address!, ZERO as Address, resolver, ALL_ROLES, MAX_EXPIRY],
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

      {!exists && (
        <p className="rounded-md bg-[#faf9f7] px-3 py-2 text-xs text-[#78716c]">
          Enter (and create) your company above first — skills publish under it.
        </p>
      )}

      <button
        disabled={!ready || pending}
        onClick={publish}
        className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {step === "register" ? "Registering name…" : step === "pin" ? "Writing pin…" : "Submit skill →"}
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
