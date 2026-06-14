import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * wagmi config for the web app. Reads flow through @aegis/adapters; writes
 * (an org registering its name / submitting skills) are signed by the connected
 * wallet — the org pays its own gas. `injected()` covers MetaMask/Rabby/Brave.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
