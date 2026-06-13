import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

/**
 * wagmi config for the web app. The explorer is read-only today (reads flow
 * through @aegis/adapters' mock store), but the wallet stack is wired so the
 * on-chain swap is a config change, not a rewrite.
 */
export const wagmiConfig = createConfig({
  chains: [sepolia],
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
