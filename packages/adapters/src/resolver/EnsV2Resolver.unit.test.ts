import { describe, it, expect } from "vitest";
import type { PublicClient } from "viem";
import { namehash } from "viem/ens";
import { EnsV2Resolver } from "./EnsV2Resolver";

/**
 * Offline unit test: an injected fake public client returns canned ENS records,
 * so we test EnsV2Resolver's mapping (text records -> SkillRecord) and verdict
 * parsing without any network. The live path is exercised by scripts/ens-resolve.ts.
 */
function fakeClient(records: Record<string, string | null>, address: string | null): PublicClient {
  return {
    getEnsText: async ({ key }: { name: string; key: string }) => records[key] ?? null,
    getEnsAddress: async () => address,
  } as unknown as PublicClient;
}

const PIN = "sha256:deadbeef";
const VERDICT = {
  status: "pass" as const,
  riskScore: 5,
  attestationId: "att-1",
  reviewedHash: PIN,
};

describe("EnsV2Resolver mapping", () => {
  it("maps pin, owner, node, and verdict from text records", async () => {
    const client = fakeClient(
      { "safeskills.pin": PIN, "safeskills.verdict": JSON.stringify(VERDICT) },
      "0x1111111111111111111111111111111111111111",
    );
    const rec = await new EnsV2Resolver({ client }).resolve("weather.acme.safeskills.eth");

    expect(rec.name).toBe("weather.acme.safeskills.eth");
    expect(rec.node).toBe(namehash("weather.acme.safeskills.eth"));
    expect(rec.pin).toBe(PIN);
    expect(rec.owner).toBe("0x1111111111111111111111111111111111111111");
    expect(rec.verdict).toEqual(VERDICT);
  });

  it("returns no verdict when the record is absent", async () => {
    const client = fakeClient({ "safeskills.pin": PIN }, "0x2222222222222222222222222222222222222222");
    const rec = await new EnsV2Resolver({ client }).resolve("pending.acme.safeskills.eth");
    expect(rec.verdict).toBeUndefined();
  });

  it("throws when the name has no safeskills.pin record", async () => {
    const client = fakeClient({}, null);
    await expect(new EnsV2Resolver({ client }).resolve("nope.eth")).rejects.toThrow(/no safeskills\.pin/);
  });

  it("falls back to the zero address when no addr record is set", async () => {
    const client = fakeClient({ "safeskills.pin": PIN }, null);
    const rec = await new EnsV2Resolver({ client }).resolve("x.eth");
    expect(rec.owner).toBe("0x0000000000000000000000000000000000000000");
  });

  it("throws on a malformed verdict record", async () => {
    const client = fakeClient({ "safeskills.pin": PIN, "safeskills.verdict": "{not json" }, null);
    await expect(new EnsV2Resolver({ client }).resolve("bad.eth")).rejects.toThrow(/not valid JSON/);
  });

  it("reads per-provider attestations into record.attestations", async () => {
    const chainlink = { status: "pass", score: 97, attestationId: "cl-1", reviewedHash: PIN };
    const local = { status: "fail", score: 40, attestationId: "lv-1", reviewedHash: PIN };
    const client = fakeClient(
      {
        "safeskills.pin": PIN,
        "safeskills.attestation.chainlink.eth": JSON.stringify(chainlink),
        "safeskills.attestation.my-local-verifier.eth": JSON.stringify(local),
      },
      "0x3333333333333333333333333333333333333333",
    );
    const rec = await new EnsV2Resolver({ client }).resolve("weather.acme.safeskills.eth");

    expect(rec.attestations).toHaveLength(2);
    const cl = rec.attestations!.find((a) => a.provider === "chainlink.eth");
    expect(cl).toMatchObject({ provider: "chainlink.eth", status: "pass", score: 97 });
    expect(rec.attestations!.find((a) => a.provider === "my-local-verifier.eth")?.score).toBe(40);
  });

  it("returns an empty attestations array when no provider has scored", async () => {
    const rec = await new EnsV2Resolver({ client: fakeClient({ "safeskills.pin": PIN }, null) }).resolve(
      "x.eth",
    );
    expect(rec.attestations).toEqual([]);
  });
});
