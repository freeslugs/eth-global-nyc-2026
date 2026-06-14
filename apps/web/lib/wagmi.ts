import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Sepolia RPC for browser reads. We pin a CORS-friendly public node instead of
 * letting viem fall back to the chain's default (thirdweb), which the browser
 * blocks on CORS. publicnode is keyless + sends permissive CORS headers and
 * matches the server's AEGIS_RPC_URL. Override with NEXT_PUBLIC_RPC_URL to swap
 * in a keyed provider later.
 */
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

/**
 * wagmi config for the web app. Reads flow through @aegis/adapters; writes
 * (an org registering its name / submitting skills) are signed by the connected
 * wallet — the org pays its own gas. `injected()` covers MetaMask/Rabby/Brave.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
