import { describe, it, expect } from "vitest";
import { gate } from "../gate";
import {
  cleanRecord,
  poisonedRecord,
  noVerdictRecord,
  cleanPin,
  poisonedPin,
  strictPolicy,
  passVerdict,
} from "./fixtures";

describe("gate", () => {
  it("ALLOWs a clean, passing, authorized install", () => {
    const r = gate({
      record: cleanRecord,
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r.ok).toBe(true);
  });

  it("blocks hash_mismatch when fetched bytes != pin", () => {
    const r = gate({
      record: cleanRecord,
      fetchedHash: poisonedPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "hash_mismatch" });
  });

  it("blocks hash_mismatch when verdict.reviewedHash != pin", () => {
    const r = gate({
      record: { ...cleanRecord, verdict: { ...passVerdict, reviewedHash: poisonedPin } },
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "hash_mismatch" });
  });

  it("blocks no_verdict when required and absent", () => {
    const r = gate({
      record: noVerdictRecord,
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "no_verdict" });
  });

  it("blocks verdict_fail for a poisoned skill", () => {
    const r = gate({
      record: poisonedRecord,
      fetchedHash: poisonedPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "verdict_fail" });
  });

  it("blocks under_policy when riskScore exceeds max", () => {
    const r = gate({
      record: { ...cleanRecord, verdict: { ...passVerdict, riskScore: 80 } },
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: false,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "under_policy" });
  });

  it("blocks revoked skills", () => {
    const r = gate({
      record: cleanRecord,
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: true,
      authorized: true,
    });
    expect(r).toMatchObject({ ok: false, reason: "revoked" });
  });

  it("blocks unauthorized (Ledger gate) when not authorized", () => {
    const r = gate({
      record: cleanRecord,
      fetchedHash: cleanPin,
      policy: strictPolicy,
      revoked: false,
      authorized: false,
    });
    expect(r).toMatchObject({ ok: false, reason: "unauthorized" });
  });
});
