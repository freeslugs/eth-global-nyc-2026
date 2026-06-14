import { describe, it, expect } from "vitest";
import { decodeFunctionData, namehash, type Account, type PublicClient, type WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { permissionedResolverAbi } from "@aegis/chain";
import { verdictWriterContract } from "@aegis/core/testing";
import type { Hex, Verdict } from "@aegis/core";
import { parseVerdict } from "../ens/records";
import { EnsV2VerdictWriter } from "./EnsV2VerdictWriter";

const RESOLVER = "0x5239a812ec9a62f46dbb5de8f346c8efe7553a9f"; // PublicResolverV2 (Sepolia)
const TEST_ACCOUNT = { address: "0x1111111111111111111111111111111111111111" } as unknown as Account;

/** A fake chain: setText txs land in a map keyed by node|key. */
function makeFakeChain() {
  const store = new Map<string, string>();
  const wallet = {
    chain: sepolia,
    async sendTransaction({ to, data }: { to: Hex; data: Hex }) {
      expect(to.toLowerCase()).toBe(RESOLVER.toLowerCase());
      const { functionName, args } = decodeFunctionData({ abi: permissionedResolverAbi, data });
      expect(functionName).toBe("setText");
      const [node, key, value] = args as [Hex, string, string];
      store.set(`${node}|${key}`, value);
      return "0xhash";
    },
  } as unknown as WalletClient;
  const publicClient = {
    chain: sepolia,
    async waitForTransactionReceipt() {
      return {};
    },
  } as unknown as PublicClient;
  const readBack = async (node: Hex) => parseVerdict(store.get(`${node}|safeskills.verdict`));
  return { wallet, publicClient, store, readBack };
}

const fake = makeFakeChain();
const VERDICT: Verdict = {
  status: "pass",
  riskScore: 5,
  attestationId: "att-1",
  reviewedHash: "sha256:deadbeef",
};

// Run the SAME behavioral contract the MockVerdictWriter passes.
verdictWriterContract({
  make: () =>
    new EnsV2VerdictWriter({
      walletClient: fake.wallet,
      publicClient: fake.publicClient,
      account: TEST_ACCOUNT,
      resolver: RESOLVER,
    }),
  node: namehash("weather.acme.safeskills.eth") as Hex,
  verdict: VERDICT,
  readBack: fake.readBack,
});

describe("EnsV2VerdictWriter encoding", () => {
  it("setText's the verdict JSON to the configured permissioned resolver", async () => {
    const chain = makeFakeChain();
    const node = namehash("exfil.acme.safeskills.eth") as Hex;
    await new EnsV2VerdictWriter({
      walletClient: chain.wallet,
      publicClient: chain.publicClient,
      account: TEST_ACCOUNT,
      resolver: RESOLVER,
    }).writeVerdict(node, { status: "fail", riskScore: 95, attestationId: "att-2", reviewedHash: "sha256:bad" });

    const raw = chain.store.get(`${node}|safeskills.verdict`);
    expect(raw).toBe('{"status":"fail","riskScore":95,"attestationId":"att-2","reviewedHash":"sha256:bad"}');
  });

  it("defaults the resolver to the chain's PublicResolverV2", async () => {
    const chain = makeFakeChain();
    const node = namehash("weather.acme.safeskills.eth") as Hex;
    // no resolver in opts -> derived from getEnsV2Addresses(sepolia).publicResolver (== RESOLVER)
    await new EnsV2VerdictWriter({
      walletClient: chain.wallet,
      publicClient: chain.publicClient,
      account: TEST_ACCOUNT,
    }).writeVerdict(node, VERDICT);
    expect(chain.store.get(`${node}|safeskills.verdict`)).toContain('"status":"pass"');
  });

  it("writeAttestation setText's under the provider's namespaced key", async () => {
    const chain = makeFakeChain();
    const node = namehash("weather.acme.safeskills.eth") as Hex;
    await new EnsV2VerdictWriter({
      walletClient: chain.wallet,
      publicClient: chain.publicClient,
      account: TEST_ACCOUNT,
      resolver: RESOLVER,
    }).writeAttestation(node, {
      provider: "my-local-verifier.eth",
      status: "pass",
      score: 88,
      attestationId: "lv-1",
      reviewedHash: "sha256:abc",
    });

    const raw = chain.store.get(`${node}|safeskills.attestation.my-local-verifier.eth`);
    expect(raw && JSON.parse(raw)).toMatchObject({ provider: "my-local-verifier.eth", score: 88 });
  });

  it("throws when no CRE signer is configured", async () => {
    const chain = makeFakeChain();
    const writer = new EnsV2VerdictWriter({ publicClient: chain.publicClient }); // no account, no AEGIS_PRIVATE_KEY
    delete process.env.AEGIS_PRIVATE_KEY;
    await expect(writer.writeVerdict("0x00" as Hex, VERDICT)).rejects.toThrow(/no CRE signer/);
  });
});
