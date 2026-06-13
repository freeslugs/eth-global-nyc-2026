import { defineConfig } from "@wagmi/cli";
import { foundry } from "@wagmi/cli/plugins";

/**
 * Generates TS bindings (ABIs) from the Foundry project into src/generated.ts.
 * Run `pnpm --filter @aegis/chain generate` after `forge build`.
 */
export default defineConfig({
  out: "src/generated.ts",
  plugins: [
    foundry({
      project: "../contracts",
      include: ["AttestationRegistry.sol/**", "Bonding.sol/**"],
    }),
  ],
});
