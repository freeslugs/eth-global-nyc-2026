import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { access, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Safeskill } from "./client";
import { loadConfig } from "./config";
import type { SafeskillPolicy } from "./types";

let home: string;
let installDir: string;
const env = () => ({ ...process.env, SAFESKILL_HOME: home });

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "safeskill-home-"));
  installDir = await mkdtemp(join(tmpdir(), "safeskill-skills-"));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
  await rm(installDir, { recursive: true, force: true });
});

async function onboard(overrides = {}) {
  return Safeskill.onboard({ env: env(), signer: "local", resolver: "demo", minSecurityRating: 70, requireVerdict: true, ...overrides });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("onboarding", () => {
  it("persists the policy + signer address to disk", async () => {
    const ss = await onboard();
    expect(ss.config.policy.name).toBe("threshold-70");
    expect(ss.config.signerAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const saved = await loadConfig(env());
    expect(saved?.policy.name).toBe("threshold-70");
    expect(saved?.signer).toBe("local");
  });

  it("can run with no signer", async () => {
    const ss = await onboard({ signer: "none" });
    expect(ss.config.signer).toBe("none");
    expect(ss.config.signerAddress).toBeUndefined();
  });

  it("accepts a named preset", async () => {
    const ss = await onboard({ preset: "strict", minSecurityRating: undefined });
    expect(ss.config.policy.name).toBe("strict");
  });
});

describe("check — the default threshold policy", () => {
  it("auto-approves a high-rating verified skill", async () => {
    const ss = await onboard();
    const d = await ss.check("weather.acme.safeskills.eth");
    expect(d.decision).toBe("auto-approve");
    expect(d.securityRating).toBe(97);
  });

  it("needs override for a clean-but-below-policy skill", async () => {
    const ss = await onboard();
    const d = await ss.check("pdf-tools.acme.safeskills.eth");
    expect(d.decision).toBe("needs-override");
    expect(d.assessment.securityRating).toBe(62);
    expect(d.assessment.verdictStatus).toBe("pass");
  });

  it("needs override for a failing (poisoned) skill", async () => {
    const ss = await onboard();
    const d = await ss.check("sync.evilcorp.safeskills.eth");
    expect(d.decision).toBe("needs-override");
    expect(d.assessment.verdictStatus).toBe("fail");
  });

  it("needs override for an unreviewed skill", async () => {
    const ss = await onboard();
    const d = await ss.check("scraper.acme.safeskills.eth");
    expect(d.decision).toBe("needs-override");
    expect(d.assessment.hasVerdict).toBe(false);
  });

  it("hard-blocks a tampered skill (hash mismatch) via the integrity floor", async () => {
    const ss = await onboard();
    const d = await ss.check("tampered.acme.safeskills.eth");
    expect(d.decision).toBe("blocked");
    expect(d.assessment.hashMatches).toBe(false);
  });

  it("hard-blocks a revoked skill", async () => {
    const ss = await onboard();
    const d = await ss.check("legacy.acme.safeskills.eth");
    expect(d.decision).toBe("blocked");
    expect(d.assessment.revoked).toBe(true);
  });
});

describe("policy is fully customizable", () => {
  it("a stricter threshold turns an auto-approve into an override", async () => {
    const ss = await onboard({ minSecurityRating: 99 });
    const d = await ss.check("weather.acme.safeskills.eth"); // security 97
    expect(d.decision).toBe("needs-override");
  });

  it('the "strict" preset blocks failing AND unreviewed skills (no override possible)', async () => {
    const ss = await onboard({ preset: "strict", minSecurityRating: undefined });
    expect((await ss.check("sync.evilcorp.safeskills.eth")).decision).toBe("blocked"); // fail
    expect((await ss.check("scraper.acme.safeskills.eth")).decision).toBe("blocked"); // unreviewed
  });

  it("a fully custom rule-based policy is honored", async () => {
    const policy: SafeskillPolicy = {
      name: "publisher-allowlist",
      rules: [
        { publisherNotIn: ["acme.safeskills.eth"], action: "blocked", label: "only trust acme" },
        { verdictStatus: "pass", action: "auto-approve" },
      ],
      default: "needs-override",
    };
    const ss = await onboard({ policy, minSecurityRating: undefined });
    // exfil is published by evil.safeskills.eth → blocked by the allowlist rule
    expect((await ss.check("sync.evilcorp.safeskills.eth")).decision).toBe("blocked");
    // pdf-tools (acme, pass) → auto-approve even at 62% (no rating rule in this policy)
    expect((await ss.check("pdf-tools.acme.safeskills.eth")).decision).toBe("auto-approve");
  });

  it("the integrity floor cannot be overridden by a permissive custom policy", async () => {
    // A reckless policy that tries to auto-approve everything…
    const policy: SafeskillPolicy = { name: "yolo", rules: [{ action: "auto-approve" }], default: "auto-approve" };
    const ss = await onboard({ policy, minSecurityRating: undefined });
    // …still cannot approve tampered content.
    const d = await ss.check("tampered.acme.safeskills.eth");
    expect(d.decision).toBe("blocked");
  });
});

describe("use — install behavior", () => {
  it("auto-installs an approved skill without a signature", async () => {
    const ss = await onboard();
    const r = await ss.use("weather.acme.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(true);
    expect(r.overridden).toBe(false);
    expect(await readFile(join(installDir, "weather.acme.safeskills.eth.md"), "utf8")).toContain("# Weather");
  });

  it("installs a below-policy skill via a verified signature override", async () => {
    const ss = await onboard();
    const r = await ss.use("pdf-tools.acme.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(true);
    expect(r.overridden).toBe(true);
  });
});

describe("FAIL-CLOSED: a failed/missing override NEVER installs", () => {
  it("rejects a below-policy skill when override is disallowed — no file written", async () => {
    const ss = await onboard();
    const r = await ss.use("pdf-tools.acme.safeskills.eth", { dir: installDir, allowOverride: false });
    expect(r.installed).toBe(false);
    expect(await exists(join(installDir, "pdf-tools.acme.safeskills.eth.md"))).toBe(false);
  });

  it("rejects a below-policy skill when NO signer is configured — no file written", async () => {
    const ss = await onboard({ signer: "none" });
    const r = await ss.use("pdf-tools.acme.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(false);
    expect(r.overridden).toBe(false);
    expect(r.error).toMatch(/no signer/i);
    expect(await exists(join(installDir, "pdf-tools.acme.safeskills.eth.md"))).toBe(false);
  });

  it("does NOT install when the signature fails to verify — no file written", async () => {
    const ss = await onboard();
    // Sabotage the signer so authorize() returns a signature that won't verify.
    const signer = (ss as unknown as { signer: { authorize: () => Promise<string> } }).signer;
    signer.authorize = async () => "0x" + "00".repeat(65);
    const r = await ss.use("sync.evilcorp.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(false);
    expect(r.error).toMatch(/did not verify/);
    expect(await exists(join(installDir, "sync.evilcorp.safeskills.eth.md"))).toBe(false);
  });

  it("does NOT install when the signer throws (device absent / user rejects) — no file written", async () => {
    const ss = await onboard();
    const signer = (ss as unknown as { signer: { authorize: () => Promise<string> } }).signer;
    signer.authorize = async () => {
      throw new Error("user rejected on device");
    };
    const r = await ss.use("sync.evilcorp.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(false);
    expect(r.error).toMatch(/override not authorized/);
    expect(await exists(join(installDir, "sync.evilcorp.safeskills.eth.md"))).toBe(false);
  });

  it("never installs a blocked (tampered) skill, even with override allowed — no file written", async () => {
    const ss = await onboard();
    const r = await ss.use("tampered.acme.safeskills.eth", { dir: installDir });
    expect(r.installed).toBe(false);
    expect(r.overridden).toBe(false);
    expect(await exists(join(installDir, "tampered.acme.safeskills.eth.md"))).toBe(false);
  });
});
