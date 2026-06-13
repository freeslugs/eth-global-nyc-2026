/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as ESM; let Next compile them.
  transpilePackages: ["@aegis/core", "@aegis/adapters"],
};

export default nextConfig;
