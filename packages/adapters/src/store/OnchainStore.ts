import {
  NotImplementedError,
  type AttestationStore,
  type Attestation,
  type ArtifactHash,
  type Hex,
  type ResolvedRecord,
} from "@aegis/core";

/**
 * Reads/writes attestations against the on-chain AttestationRegistry via viem.
 * Reads could be live in the future; writes go through a forwarder. Stubbed.
 */
export class OnchainStore implements AttestationStore {
  async getAttestations(_subject: ArtifactHash): Promise<Attestation[]> {
    throw new NotImplementedError("TODO(onchain): read Attested events via viem getLogs");
  }

  async isRevoked(_subject: ArtifactHash): Promise<boolean> {
    throw new NotImplementedError("TODO(onchain): read revocation state via viem");
  }

  async postAttestation(_a: Attestation): Promise<void> {
    throw new NotImplementedError("TODO(onchain): writeContract postAttestation via forwarder");
  }

  async postRevocation(_subject: ArtifactHash, _by: Hex, _signature: Hex): Promise<void> {
    throw new NotImplementedError("TODO(onchain): writeContract revoke via forwarder");
  }

  async setPin(_rec: ResolvedRecord): Promise<void> {
    throw new NotImplementedError("TODO(onchain): pins live in ENS records, not this store");
  }
}
