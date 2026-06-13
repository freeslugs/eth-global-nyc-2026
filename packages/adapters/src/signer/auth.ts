import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import type { AuthRequest, Hex } from "@aegis/core";

/**
 * Shared signing helpers for InstallSigner adapters. Both LocalSigner (dev key)
 * and LedgerSigner (device) produce/verify signatures over the SAME canonical
 * message, so the signerContract behaves identically for both — `verify()`
 * stays synchronous (no async chain recover).
 */

/** Deterministic 32-byte digest of an AuthRequest. */
export function authDigest(req: AuthRequest): Uint8Array {
  const canonical = JSON.stringify({
    node: req.node,
    name: req.name,
    pin: req.pin,
    verdict: {
      status: req.verdict.status,
      riskScore: req.verdict.riskScore,
      attestationId: req.verdict.attestationId,
      reviewedHash: req.verdict.reviewedHash,
    },
  });
  return keccak_256(new TextEncoder().encode(canonical));
}

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
