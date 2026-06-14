import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { keccak256, toBytes } from "viem";
import { hashSkill, type AuthRequest, type InstallSigner, type SkillFetcher, type SkillRecord, type SkillResolver, type Verdict } from "@aegis/core";
import { EnsV2Resolver, HttpFetcher, LedgerSigner, LocalSigner, discoverSkillNames } from "@aegis/adapters";
import { DEFAULT_POLICY, loadConfig, saveConfig } from "./config";
import { decide } from "./decide";
import { PRESETS, thresholdPolicy, validatePolicy } from "./policy";
import { DEMO_REGISTRY, DemoFetcher, DemoResolver, isRevoked } from "./registry";
import type { RegistrySkill, ResolverKind, SafeskillConfig, SafeskillPolicy, SignerKind, SkillDecision, UseResult } from "./types";

/** What `onboard()` accepts. Everything has a sensible default. */
export interface OnboardOptions {
  /** Which signer authorizes Ledger overrides. Default "local" (demo-friendly). */
  signer?: SignerKind;
  /** Where verdicts are read from. Default "demo". */
  resolver?: ResolverKind;
  env?: NodeJS.ProcessEnv;
  // ── policy (highest precedence first) ──
  /** A full, user-authored policy object. */
  policy?: SafeskillPolicy;
  /** A named preset key (e.g. "strict", "permissive", "default"). */
  preset?: string;
  /** Convenience: build a threshold policy auto-approving passing skills ≥ this. */
  minSecurityRating?: number;
  /** Used with `minSecurityRating`. Default true. */
  requireVerdict?: boolean;
  /**
   * Require a verified signature over the policy at onboarding (default true when a
   * signer is configured). A `local` key signs silently; a `ledger` PROMPTS the user
   * to Approve on the device — selecting a Ledger means a real signature, or onboarding
   * fails. Set false only for non-interactive/programmatic onboarding.
   */
  consentToPolicy?: boolean;
}

/** What `check()` accepts. */
export interface CheckOptions {
  /**
   * Re-hash this local SKILL.md file against the ENS pin instead of fetching via
   * the record's contentUri. This is how the agent gates the *candidate* bytes it
   * actually holds — and the only way to gate in `--ens` mode, where ENS pins a
   * hash but stores no content location.
   */
  file?: string;
}

export interface UseOptions extends CheckOptions {
  /** Directory to write installed skills into. Default ".skills". */
  dir?: string;
  /**
   * Permit a Ledger signature override for `needs-override` skills. When false,
   * such skills are rejected (not installed). Default true.
   */
  allowOverride?: boolean;
  /**
   * Install into Claude Code's layout: `<dir>/<short-name>/SKILL.md` (a folder
   * per skill), so the agent auto-discovers it. Default false (flat `<name>.md`).
   */
  claude?: boolean;
  /**
   * Explicit human approval token for a `local`-signer override. A hardware Ledger
   * IS the approval (press Approve on-device), but a software `local` key would sign
   * silently — so for `local` we require the caller to pass `CONFIRM` as a deliberate
   * in-the-loop confirmation before the override proceeds. Ignored for `ledger`.
   */
  confirm?: string;
}

/** The literal a `local`-signer override must pass as `confirm` to authorize. */
export const CONFIRM_TOKEN = "CONFIRM";

/** Resolve the OnboardOptions into a concrete policy (precedence: policy > preset > threshold > default). */
function resolvePolicy(opts: OnboardOptions): SafeskillPolicy {
  if (opts.policy) return validatePolicy(opts.policy);
  if (opts.preset) {
    const p = PRESETS[opts.preset];
    if (!p) throw new Error(`unknown preset "${opts.preset}" — known: ${Object.keys(PRESETS).join(", ")}`);
    return p;
  }
  if (opts.minSecurityRating !== undefined) return thresholdPolicy(opts.minSecurityRating, opts.requireVerdict ?? true);
  return DEFAULT_POLICY;
}

function buildSigner(kind: SignerKind, env: NodeJS.ProcessEnv): InstallSigner | undefined {
  if (kind === "none") return undefined;
  if (kind === "ledger") return new LedgerSigner();
  return new LocalSigner(env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined);
}

/**
 * Probe for a connected, unlocked Ledger with the Ethereum app open. Returns
 * its address if reachable, otherwise undefined (no device / locked / wrong
 * app / transport unavailable). Used to auto-pick the signer when the user
 * onboards without explicitly choosing --ledger or --local.
 */
export async function probeLedger(): Promise<string | undefined> {
  try {
    return await new LedgerSigner().address();
  } catch {
    return undefined;
  }
}

function buildResolver(kind: ResolverKind): SkillResolver {
  return kind === "ens" ? new EnsV2Resolver() : new DemoResolver();
}

function buildFetcher(kind: ResolverKind): SkillFetcher {
  return kind === "ens" ? new HttpFetcher() : new DemoFetcher();
}

/** A skill is revoked? Only the demo registry knows; ENS revocation isn't wired yet. */
function revokedFor(kind: ResolverKind, name: string): boolean {
  return kind === "demo" ? isRevoked(name) : false;
}

/**
 * The message the signer authorizes when a policy is generated. It commits to the
 * EXACT policy (pin = hash of the policy JSON), so approving it on the device is a
 * real, verifiable consent to *this* configuration — not just an address read.
 */
function onboardingAuthRequest(policy: SafeskillPolicy): AuthRequest {
  const pin = hashSkill(new TextEncoder().encode(JSON.stringify(policy)));
  return {
    node: keccak256(toBytes("safeskills.onboarding")),
    name: `safeskills:onboarding:${policy.name}`,
    pin,
    verdict: { status: "pass", riskScore: 0, attestationId: "safeskills:onboarding", reviewedHash: pin },
  };
}

/** Turn a signer/transport failure into an actionable message (esp. the portable-engine Ledger case). */
function signerFailureHint(signer: SignerKind, err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  if (signer === "ledger" && /MODULE_NOT_FOUND|hw-transport-node-hid|node-hid|bindings|Cannot find/.test(msg)) {
    return (
      "Ledger transport unavailable — this gate has no native USB driver. Reinstall the " +
      "gate Ledger-capable: `nvm use 22 && node packages/safeskill/dist/cli.js init --dev`, " +
      "then onboard again with the device connected + unlocked (Ethereum app open)."
    );
  }
  return msg;
}

/**
 * The thing the agent holds onto. Built from an onboarded config; exposes the
 * registry catalog plus `check`/`use` which gate every skill against ENS first.
 */
export class Safeskill {
  readonly config: SafeskillConfig;
  private readonly resolver: SkillResolver;
  private readonly fetcher: SkillFetcher;
  private readonly signer: InstallSigner | undefined;

  constructor(config: SafeskillConfig, env: NodeJS.ProcessEnv = process.env) {
    this.config = config;
    this.resolver = buildResolver(config.resolver);
    this.fetcher = buildFetcher(config.resolver);
    this.signer = buildSigner(config.signer, env);
  }

  // ── Part 1: onboarding ────────────────────────────────────────────────────

  /** Hook up a signer + set a policy, capture the signer address, and persist. */
  static async onboard(opts: OnboardOptions = {}): Promise<Safeskill> {
    const env = opts.env ?? process.env;
    const signer = opts.signer ?? "local";
    const resolver = opts.resolver ?? "demo";
    const policy = resolvePolicy(opts);

    let signerAddress: string | undefined;
    const s = buildSigner(signer, env);
    const consent = opts.consentToPolicy ?? true;
    if (s && consent) {
      // Generating a policy REQUIRES a verified signature from the chosen signer.
      // local → silent; ledger → the device shows the policy and the user presses
      // Approve. No signature, no onboarding (no silent "address not captured").
      let addr: `0x${string}`;
      try {
        addr = await s.address();
      } catch (err) {
        throw new Error(signerFailureHint(signer, err));
      }
      const req = onboardingAuthRequest(policy);
      let sig: `0x${string}`;
      try {
        sig = await s.authorize(req); // ledger: blocks until the user approves on-device
      } catch (err) {
        throw new Error(`policy signature failed (declined or device error): ${signerFailureHint(signer, err)}`);
      }
      if (s.verify(req, sig, addr) !== true) {
        throw new Error("policy signature did not verify — not onboarded");
      }
      signerAddress = addr;
    } else if (s) {
      // consent explicitly disabled — best-effort address read, no signature.
      try {
        signerAddress = await s.address();
      } catch {
        signerAddress = undefined;
      }
    }

    const config: SafeskillConfig = {
      signer,
      signerAddress,
      resolver,
      policy,
      createdAt: new Date().toISOString(),
    };
    await saveConfig(config, env);
    return new Safeskill(config, env);
  }

  /** Load a previously onboarded config. Throws if the user hasn't onboarded. */
  static async load(env: NodeJS.ProcessEnv = process.env): Promise<Safeskill> {
    const config = await loadConfig(env);
    if (!config) throw new Error("not onboarded — run `safeskill onboard` (or Safeskill.onboard()) first");
    return new Safeskill(config, env);
  }

  // ── Part 2: skill fetching + gating ───────────────────────────────────────

  /** The hardcoded on-chain registry catalog. */
  /**
   * The catalog. In `ens` mode this is enumerated LIVE from the on-chain registry
   * via the shared `@aegis/adapters` discovery (the same code the web app uses) —
   * no hardcoded list. In `demo` mode it's the fixture registry.
   */
  async listSkills(): Promise<RegistrySkill[]> {
    if (this.config.resolver === "ens") {
      const names = await discoverSkillNames();
      return names.map((name) => {
        const dot = name.indexOf(".");
        return { name, title: name, description: "", publisher: dot === -1 ? name : name.slice(dot + 1) };
      });
    }
    return DEMO_REGISTRY;
  }

  /**
   * Resolve a name against the (ENS) registry, fetch its SKILL.md, re-hash it
   * locally, and decide per policy: auto-approve / needs-override / blocked.
   * No install, no signature — this is the read an agent does *before* loading.
   */
  async check(name: string, opts: CheckOptions = {}): Promise<SkillDecision> {
    return (await this.resolveAndGate(name, opts.file)).decision;
  }

  /**
   * Resolve the name, load the candidate bytes (from `file` or the record's
   * contentUri), re-hash, and run the policy. Returns the decision *and* the
   * exact bytes that were gated — so `use()` installs precisely what it checked.
   */
  private async resolveAndGate(
    name: string,
    file?: string,
  ): Promise<{ decision: SkillDecision; record: SkillRecord; bytes: Uint8Array }> {
    const record = await this.resolver.resolve(name);
    const bytes = await this.loadBytes(record, file);
    const fetchedHash = hashSkill(bytes);
    const decision = decide({
      record,
      fetchedHash,
      revoked: revokedFor(this.config.resolver, name),
      policy: this.config.policy,
    });
    return { decision, record, bytes };
  }

  /**
   * The agent's one-call entry point: check the skill, then act on the policy.
   * FAIL-CLOSED: a skill is installed ONLY when it auto-approves, or when a
   * needs-override skill produces a *verified* signature. Anything else — a
   * blocked skill, a missing signer, a declined/failed/errored signature —
   * results in NO fetch-to-disk and NO install.
   */
  async use(name: string, opts: UseOptions = {}): Promise<UseResult> {
    const dir = opts.dir ?? ".skills";
    const allowOverride = opts.allowOverride ?? true;
    const { decision, record, bytes } = await this.resolveAndGate(name, opts.file);

    // Hard block — a signature cannot save this.
    if (decision.decision === "blocked") {
      return { decision, installed: false, overridden: false, error: "blocked by policy — a signature cannot override this" };
    }

    // Below policy — require an explicit, verified override before doing anything.
    if (decision.decision === "needs-override") {
      if (!allowOverride) {
        return { decision, installed: false, overridden: false, error: "below policy and overrides are disabled" };
      }
      if (!this.signer) {
        return { decision, installed: false, overridden: false, error: 'below policy and no signer configured (onboarded with signer: "none")' };
      }
      // A `local` (software) signer has no device prompt, so require an explicit typed
      // confirmation as the human-in-the-loop approval. A `ledger` IS the prompt.
      if (this.config.signer === "local" && opts.confirm !== CONFIRM_TOKEN) {
        return {
          decision,
          installed: false,
          overridden: false,
          error: `needs your approval — re-run with --confirm ${CONFIRM_TOKEN} to authorize the override with your local key`,
        };
      }
      let authorized: boolean;
      try {
        authorized = await this.authorizeOverride(record);
      } catch (err) {
        // Device error, user rejection on the Ledger, transport failure, etc.
        // → treat as NOT authorized. Nothing is installed.
        return { decision, installed: false, overridden: false, error: `override not authorized: ${(err as Error).message}` };
      }
      // Strict: only an exact `true` from verify() proceeds.
      if (authorized !== true) {
        return { decision, installed: false, overridden: false, error: "override signature did not verify" };
      }
      const path = await this.write(record, bytes, dir, opts.claude);
      return { decision, installed: true, overridden: true, path };
    }

    // auto-approve
    const path = await this.write(record, bytes, dir, opts.claude);
    return { decision, installed: true, overridden: false, path };
  }

  /** Address of the configured signer, if any (re-read live, not just the cached one). */
  async signerAddress(): Promise<string | undefined> {
    if (!this.signer) return undefined;
    return this.signer.address();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async fetch(record: SkillRecord): Promise<Uint8Array> {
    const uri = record.contentUri;
    if (!uri) throw new Error(`no contentUri for ${record.name}`);
    return this.fetcher.fetch(uri);
  }

  /** Candidate bytes to gate: a local file if given, else the record's contentUri. */
  private async loadBytes(record: SkillRecord, file?: string): Promise<Uint8Array> {
    if (file) return new Uint8Array(await readFile(file));
    if (record.contentUri) return this.fetch(record);
    // Pure ENS: no contentUri pinned means there's nothing to fetch and hash. We do
    // NOT fall back to any local content — the only way to gate such a name is an
    // explicit --file candidate. The publisher must pin a contentUri on-chain.
    throw new Error(
      `no contentUri pinned for ${record.name} — pin a content location on-chain, or pass --file <path> to gate a local candidate`,
    );
  }

  /** Build the message the human signs to authorize an override. */
  private authRequest(record: SkillRecord): AuthRequest {
    const verdict: Verdict =
      record.verdict ?? { status: "fail", riskScore: 100, attestationId: "override:unreviewed", reviewedHash: record.pin };
    return { node: record.node, name: record.name, pin: record.pin, verdict };
  }

  /** Returns true ONLY if the signer produced a signature that verifies. Throws on device/transport errors. */
  private async authorizeOverride(record: SkillRecord): Promise<boolean> {
    if (!this.signer) throw new Error("no signer configured");
    const req = this.authRequest(record);
    const addr = await this.signer.address();
    const sig = await this.signer.authorize(req);
    return this.signer.verify(req, sig, addr) === true;
  }

  /**
   * Write the gated bytes to disk. `claude` mode uses Claude Code's layout —
   * `<dir>/<short-name>/SKILL.md` (a folder per skill) — so the agent discovers
   * it; otherwise a flat `<dir>/<full-name>.md`. The bytes written are exactly
   * the bytes that were re-hashed and gated.
   */
  private async write(record: SkillRecord, bytes: Uint8Array, dir: string, claude?: boolean): Promise<string> {
    if (claude) {
      const short = record.name.split(".")[0] || record.name;
      const skillDir = join(dir, short);
      await mkdir(skillDir, { recursive: true });
      const out = join(skillDir, "SKILL.md");
      await writeFile(out, bytes);
      return out;
    }
    await mkdir(dir, { recursive: true });
    const out = join(dir, `${record.name}.md`);
    await writeFile(out, bytes);
    return out;
  }
}
