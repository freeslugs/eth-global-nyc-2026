import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { hashTypedData } from "viem";
import type { AuthRequest, Hex } from "@aegis/core";

/**
 * ⚠️  CORE-CHANGE: migrated from raw keccak256(JSON) to EIP-712 typed data.
 * This lets the Ledger Flex show structured fields (name, verdict, riskScore)
 * instead of an opaque hex blob. Coordinated with core owner — see PR description.
 *
 * Shared signing helpers for InstallSigner adapters. Both LocalSigner (dev key)
 * and LedgerSigner (device) produce/verify signatures over the SAME canonical
 * EIP-712 digest, so the signerContract behaves identically for both — `verify()`
 * stays synchronous (no async chain recover).
 */

// ---------------------------------------------------------------------------
// EIP-712 domain & types
// ---------------------------------------------------------------------------

/** Minimal domain — no verifyingContract/chainId so signatures are chain-agnostic. */
export const EIP712_DOMAIN = {
  name: "SafeSkills",
  version: "1",
} as const;

export const EIP712_TYPES = {
  Verdict: [
    { name: "status", type: "string" },
    { name: "riskScore", type: "uint8" },
    { name: "attestationId", type: "string" },
    { name: "reviewedHash", type: "string" },
  ],
  AuthRequest: [
    { name: "node", type: "bytes32" },
    { name: "name", type: "string" },
    { name: "pin", type: "string" },
    { name: "verdict", type: "Verdict" },
  ],
};

/** Build the EIP-712 message value from an AuthRequest. */
export function eip712Message(req: AuthRequest) {
  return {
    node: req.node,
    name: req.name,
    pin: req.pin,
    verdict: {
      status: req.verdict.status,
      riskScore: req.verdict.riskScore,
      attestationId: req.verdict.attestationId,
      reviewedHash: req.verdict.reviewedHash,
    },
  };
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

/** Deterministic 32-byte EIP-712 digest of an AuthRequest. */
export function authDigest(req: AuthRequest): Uint8Array {
  const hash = hashTypedData({
    domain: EIP712_DOMAIN,
    types: EIP712_TYPES,
    primaryType: "AuthRequest",
    message: eip712Message(req),
  });
  return hexToBytes(hash.slice(2));
}

// ---------------------------------------------------------------------------
// Key / sign / recover
// ---------------------------------------------------------------------------

export function addressFromPrivateKey(priv: Uint8Array): Hex {
  const pub = secp256k1.getPublicKey(priv, false).slice(1); // drop 0x04 prefix
  return `0x${bytesToHex(keccak_256(pub).slice(-20))}`;
}

/** Sign a digest, returning compact r||s||v hex. */
export function signDigest(digest: Uint8Array, priv: Uint8Array): Hex {
  const sig = secp256k1.sign(digest, priv);
  const v = sig.recovery + 27;
  return `0x${sig.toCompactHex()}${v.toString(16).padStart(2, "0")}`;
}

/** Recover the signer address from a compact r||s||v signature. */
export function recoverSigner(req: AuthRequest, sig: Hex): Hex {
  const bytes = hexToBytes(sig.slice(2));
  const rs = bytes.slice(0, 64);
  const v = bytes[64] ?? 27;
  const signature = secp256k1.Signature.fromCompact(rs).addRecoveryBit(v - 27);
  const pub = signature.recoverPublicKey(authDigest(req)).toRawBytes(false).slice(1);
  return `0x${bytesToHex(keccak_256(pub).slice(-20))}`;
}

export function verifyAuth(req: AuthRequest, sig: Hex, signer: Hex): boolean {
  try {
    return recoverSigner(req, sig).toLowerCase() === signer.toLowerCase();
  } catch {
    return false;
  }
}
