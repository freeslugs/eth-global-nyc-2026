import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

/**
 * The pnpm store holds multiple copies of react / wagmi / viem (different peer
 * resolutions across the monorepo). When two copies get bundled, wagmi's React
 * context created by one copy can't be read by `useAccount` from another —
 * surfacing as "useConfig must be used within WagmiProvider" even though the
 * provider is present. Force every import of these to resolve to this app's
 * single copy — CLIENT bundle ONLY. Aliasing react/react-dom on the server
 * bundle clashes with Next's own server-runtime React ("Cannot read properties
 * of null (reading 'useContext')" inside Next internals); the wagmi
 * duplicate-context problem is purely client-side.
 */
const DEDUPE = ["react", "react-dom", "wagmi", "viem", "@tanstack/react-query"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as ESM; let Next compile them.
  transpilePackages: ["@aegis/core", "@aegis/adapters"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = { ...config.resolve.alias };
      for (const pkg of DEDUPE) {
        config.resolve.alias[pkg] = resolve(root, "node_modules", pkg);
      }
    }
    // Optional peer deps that wallet connectors (@metamask/sdk, walletconnect's
    // pino) reference for React Native / pretty-logging but that we don't ship.
    // Without this, Next emits noisy "Module not found" warnings for them.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    // viem's Tempo chain config pulls in ox's `tempo` module, which uses a
    // dynamic require expression webpack can't statically analyze. It's not a
    // real problem for us (we don't use Tempo), so suppress the noisy warning.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /ox\/_esm\/tempo\// },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};

export default nextConfig;
