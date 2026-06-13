import { describe, it, expect } from "vitest";
import { digest, hashBytes } from "../hash";
import { goodArtifact, tamperedArtifact } from "./fixtures";

describe("hash", () => {
  it("produces canonical sha256:<hex> form", () => {
    const h = hashBytes(new TextEncoder().encode("abc"));
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Known SHA-256("abc")
    expect(h).toBe("sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("is deterministic", () => {
    expect(digest(goodArtifact)).toEqual(digest(goodArtifact));
  });

  it("hashes bundle and manifest separately so a manifest tweak moves only manifestHash", () => {
    const a = digest(goodArtifact);
    const b = digest(tamperedArtifact);
    expect(a.bundleHash).toBe(b.bundleHash);
    expect(a.manifestHash).not.toBe(b.manifestHash);
  });
});
