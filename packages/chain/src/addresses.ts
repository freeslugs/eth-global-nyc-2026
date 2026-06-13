import type { Address } from "viem";

/**
 * Deployed contract addresses per chain id. Testnet placeholders default to the
 * zero address; fill in after deploying. No app depends on these being live in
 * mock mode.
 */
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface ContractAddresses {
  attestationRegistry: Address;
  bonding: Address;
}

export const addresses: Record<number, ContractAddresses> = {
  // Sepolia (placeholders)
  11155111: {
    attestationRegistry: ZERO_ADDRESS,
    bonding: ZERO_ADDRESS,
  },
  // Local anvil
  31337: {
    attestationRegistry: ZERO_ADDRESS,
    bonding: ZERO_ADDRESS,
  },
};

export function getAddresses(chainId: number): ContractAddresses {
  return (
    addresses[chainId] ?? {
      attestationRegistry: ZERO_ADDRESS,
      bonding: ZERO_ADDRESS,
    }
  );
}
