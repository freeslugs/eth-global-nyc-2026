import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashSkill, type AuthRequest, type InstallSigner, type SkillFetcher, type SkillRecord, type SkillResolver, type Verdict } from "@aegis/core";
import { EnsV2Resolver, IpfsFetcher, LedgerSigner, LocalSigner } from "@aegis/adapters";
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
}

export interface UseOptions {
  /** Directory to write installed skills into. Default ".skills". */
  dir?: string;
  /**
   * Permit a Ledger signature override for `needs-override` skills. When false,
   * such skills are rejected (not installed). Default true.
   */
  allowOverride?: boolean;
}

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

function buildResolver(kind: ResolverKind): SkillResolver {
  return kind === "ens" ? new EnsV2Resolver() : new DemoResolver();
}

function buildFetcher(kind: ResolverKind): SkillFetcher {
  return kind === "ens" ? new IpfsFetcher() : new DemoFetcher();
}

/** A skill is revoked? Only the demo registry knows; ENS revocation isn't wired yet. */
function revokedFor(kind: ResolverKind, name: string): boolean {
  return kind === "demo" ? isRevoked(name) : false;
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
    if (s) {
      try {
        signerAddress = await s.address();
      } catch {
        // Device not connected (e.g. real Ledger absent). Save anyway; overrides
        // will surface the error when actually attempted.
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
  listSkills(): RegistrySkill[] {
    return DEMO_REGISTRY;
  }

  /**
   * Resolve a name against the (ENS) registry, fetch its SKILL.md, re-hash it
   * locally, and decide per policy: auto-approve / needs-override / blocked.
   * No install, no signature — this is the read an agent does *before* loading.
   */
  async check(name: string): Promise<SkillDecision> {
    const record = await this.resolver.resolve(name);
    const bytes = await this.fetch(record);
    const fetchedHash = hashSkill(bytes);
    return decide({
      record,
      fetchedHash,
      revoked: revokedFor(this.config.resolver, name),
      policy: this.config.policy,
    });
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
    const decision = await this.check(name);

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
      let authorized: boolean;
      try {
        authorized = await this.authorizeOverride(decision.record);
      } catch (err) {
        // Device error, user rejection on the Ledger, transport failure, etc.
        // → treat as NOT authorized. Nothing is installed.
        return { decision, installed: false, overridden: false, error: `override not authorized: ${(err as Error).message}` };
      }
      // Strict: only an exact `true` from verify() proceeds.
      if (authorized !== true) {
        return { decision, installed: false, overridden: false, error: "override signature did not verify" };
      }
      const path = await this.install(decision.record, dir);
      return { decision, installed: true, overridden: true, path };
    }

    // auto-approve
    const path = await this.install(decision.record, dir);
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

  private async install(record: SkillRecord, dir: string): Promise<string> {
    const bytes = await this.fetch(record);
    await mkdir(dir, { recursive: true });
    const out = join(dir, `${record.name}.md`);
    await writeFile(out, bytes);
    return out;
  }
}
