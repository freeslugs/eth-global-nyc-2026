import type { InstallSigner, AuthRequest, Hex } from "@aegis/core";
import {
  encodeAbiParameters,
  keccak256,
  encodePacked,
} from "viem";
import {
  verifyAuth,
  EIP712_DOMAIN,
  EIP712_TYPES,
  eip712Message,
} from "./auth";

const DEFAULT_PATH = "44'/60'/0'/0/0";

// ---------------------------------------------------------------------------
// EIP-712 struct hashing helpers (for signEIP712HashedMessage fallback)
// ---------------------------------------------------------------------------

// EIP712Domain(string name,string version)
const EIP712_DOMAIN_TYPEHASH = keccak256(
  encodePacked(["string"], ["EIP712Domain(string name,string version)"]),
);

const DOMAIN_SEPARATOR = keccak256(
  encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
    [
      EIP712_DOMAIN_TYPEHASH,
      keccak256(encodePacked(["string"], [EIP712_DOMAIN.name])),
      keccak256(encodePacked(["string"], [EIP712_DOMAIN.version])),
    ],
  ),
);

const VERDICT_TYPEHASH = keccak256(
  encodePacked(
    ["string"],
    ["Verdict(string status,uint8 riskScore,string attestationId,string reviewedHash)"],
  ),
);

const AUTH_REQUEST_TYPEHASH = keccak256(
  encodePacked(
    ["string"],
    [
      "AuthRequest(bytes32 node,string name,string pin,Verdict verdict)" +
        "Verdict(string status,uint8 riskScore,string attestationId,string reviewedHash)",
    ],
  ),
);

function hashVerdict(v: { status: string; riskScore: number; attestationId: string; reviewedHash: string }): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint8" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        VERDICT_TYPEHASH,
        keccak256(encodePacked(["string"], [v.status])),
        v.riskScore,
        keccak256(encodePacked(["string"], [v.attestationId])),
        keccak256(encodePacked(["string"], [v.reviewedHash])),
      ],
    ),
  );
}

function hashAuthRequestStruct(req: AuthRequest): Hex {
  const msg = eip712Message(req);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        AUTH_REQUEST_TYPEHASH,
        msg.node as Hex,
        keccak256(encodePacked(["string"], [msg.name])),
        keccak256(encodePacked(["string"], [msg.pin])),
        hashVerdict(msg.verdict),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// LedgerSigner
// ---------------------------------------------------------------------------

/**
 * Authorizes installs on a hardware Ledger: the device clear-signs the
 * EIP-712 AuthRequest (Flex/Stax show name + verdict fields), and `verify()`
 * recovers the signer from the same EIP-712 digest — synchronous, no device.
 *
 * Transport and hw-app-eth are imported dynamically so that apps/web
 * (which imports @aegis/adapters) doesn't pull in node-hid at bundle time.
 */
export class LedgerSigner implements InstallSigner {
  private readonly derivationPath: string;

  constructor(derivationPath?: string) {
    this.derivationPath = derivationPath ?? DEFAULT_PATH;
  }

  private async getEthApp() {
    const { default: TransportNodeHid } = await import(
      "@ledgerhq/hw-transport-node-hid"
    );
    const { default: Eth } = await import("@ledgerhq/hw-app-eth");
    const transport = await TransportNodeHid.create();
    return { eth: new Eth(transport), transport };
  }

  async address(): Promise<Hex> {
    const { eth, transport } = await this.getEthApp();
    try {
      const { address } = await eth.getAddress(this.derivationPath);
      return `0x${address.replace(/^0x/, "").toLowerCase()}` as Hex;
    } finally {
      await transport.close();
    }
  }

  async authorize(req: AuthRequest): Promise<Hex> {
    const { eth, transport } = await this.getEthApp();
    try {
      const msg = eip712Message(req);
      const jsonMessage = {
        domain: EIP712_DOMAIN,
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
          ],
          ...EIP712_TYPES,
        },
        primaryType: "AuthRequest" as const,
        message: msg,
      };

      let v: number;
      let r: string;
      let s: string;

      try {
        // Full EIP-712 struct — Ledger Flex/Stax show individual fields.
        const result = await eth.signEIP712Message(
          this.derivationPath,
          jsonMessage,
        );
        v = result.v;
        r = result.r;
        s = result.s;
      } catch {
        // Fallback for Nano S/X: pre-hashed domain + struct.
        const messageHash = hashAuthRequestStruct(req);

        const result = await eth.signEIP712HashedMessage(
          this.derivationPath,
          DOMAIN_SEPARATOR.slice(2),
          messageHash.slice(2),
        );
        v = result.v;
        r = result.r;
        s = result.s;
      }

      // Normalize to compact r||s||v (65 bytes) matching auth.ts format.
      const rHex = r.padStart(64, "0");
      const sHex = s.padStart(64, "0");
      const vHex = v.toString(16).padStart(2, "0");
      return `0x${rHex}${sHex}${vHex}` as Hex;
    } finally {
      await transport.close();
    }
  }

  verify(req: AuthRequest, sig: Hex, signer: Hex): boolean {
    return verifyAuth(req, sig, signer);
  }
}
