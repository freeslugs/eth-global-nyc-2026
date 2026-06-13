import { describe, it, expect } from "vitest";
import { hashSkill } from "../hash";
import { cleanMd, poisonedMd } from "./fixtures";

describe("hashSkill", () => {
  it("produces canonical sha256:<hex> form", () => {
    expect(hashSkill(cleanMd)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashSkill(cleanMd)).toBe(hashSkill(cleanMd));
  });

  it("differs for different bytes", () => {
    expect(hashSkill(cleanMd)).not.toBe(hashSkill(poisonedMd));
  });
});
