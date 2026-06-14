import {
  encodeFunctionData,
  type Account,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  getEnsV2Addresses,
  makeAccount,
  makePublicClient,
  makeWalletClient,
  permissionedResolverAbi,
} from "@aegis/chain";
import type { Attestation, Hex, Verdict, VerdictWriter } from "@aegis/core";
import { TEXT_KEYS, attestationKey, encodeAttestation, encodeVerdict } from "../ens/records";

export interface EnsV2VerdictWriterOptions {
  /** Inject clients/account for tests. */
  walletClient?: WalletClient;
  publicClient?: PublicClient;
  account?: Account;
  /**
   * The permissioned resolver holding the skill's records. Default: env
   * AEGIS_ENS_RESOLVER, else the chain's shared PublicResolverV2. In v2 each
   * account has its own resolver proxy, so point this at the org's resolver
   * (the one the setup script registered the skills with).
   */
  resolver?: Address;
  chainId?: number;
}

/**
 * The CRE write path on ENS v2: writes `safeskills.verdict` via the permissioned
 * resolver's `setText`. The org owns the skill name and delegates exactly this
 * one key to the CRE with `authorizeTextRoles(name, "safeskills.verdict", cre,
 * true)` — so this signed `setText` is all the CRE can do. Signed via the shared
 * @aegis/chain seam (local key or Ledger), so the code is identical either way.
 */
export class EnsV2VerdictWriter implements VerdictWriter {
  private readonly publicClient: PublicClient;
  private accountPromise?: Promise<Account | undefined>;

  constructor(private readonly opts: EnsV2VerdictWriterOptions = {}) {
    this.publicClient = opts.publicClient ?? makePublicClient({ timeout: 30_000 });
  }

  /** Lazily build the CRE signer (async for the Ledger path); memoized. */
  private async account(): Promise<Account> {
    if (this.opts.account) return this.opts.account;
    this.accountPromise ??= makeAccount(process.env);
    const account = await this.accountPromise;
    if (!account) {
      throw new Error(
        "EnsV2VerdictWriter: no CRE signer. Set AEGIS_PRIVATE_KEY (or AEGIS_SIGNER=ledger).",
      );
    }
    return account;
  }

  private resolverAddress(): Address {
    if (this.opts.resolver) return this.opts.resolver;
    const fromEnv = process.env.AEGIS_ENS_RESOLVER as Address | undefined;
    if (fromEnv) return fromEnv;
    const chainId = this.opts.chainId ?? this.publicClient.chain?.id ?? 11155111;
    return getEnsV2Addresses(chainId).publicResolver;
  }

  /** setText one record on the skill's resolver, signed by the provider/CRE account. */
  private async setRecord(node: Hex, key: string, value: string): Promise<void> {
    const account = await this.account();
    const resolver = this.resolverAddress();
    const wallet = this.opts.walletClient ?? makeWalletClient({ account, timeout: 30_000 });

    const data = encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: "setText",
      args: [node, key, value],
    });

    const hash: Hash = await wallet.sendTransaction({
      account,
      chain: wallet.chain,
      to: resolver,
      data,
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  /** Legacy single-verdict write (`safeskills.verdict`). */
  async writeVerdict(node: Hex, v: Verdict): Promise<void> {
    await this.setRecord(node, TEXT_KEYS.verdict, encodeVerdict(v));
  }

  /**
   * Write a provider's attestation to `safeskills.attestation.<provider>`. The
   * signer must hold the per-key role the org granted via authorizeTextRoles —
   * so a provider can write ONLY its own slot. This is the call the CRE
   * (`chainlink.eth`) and the local verifier (`my-local-verifier.eth`) make.
   */
  async writeAttestation(node: Hex, att: Attestation): Promise<void> {
    await this.setRecord(node, attestationKey(att.provider), encodeAttestation(att));
  }
}
