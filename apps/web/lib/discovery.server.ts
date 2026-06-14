import { discoverSkills, type Discovered } from "@aegis/adapters";

/**
 * On-chain discovery of the live catalog — now a thin wrapper over the SHARED
 * `@aegis/adapters` discovery so the web app and the CLI run the identical ENS
 * code. The shared module derives the org registry on-chain; the env overrides
 * (NEXT_PUBLIC_ORG_REGISTRY / AEGIS_ROOT_NAME / AEGIS_DISCOVERY_FROM_BLOCK /
 * AEGIS_RPC_URL) it already reads keep this behaving exactly as before.
 *
 * The 30s in-process cache lives here (a page render shouldn't redo many getLogs).
 */
export type { Discovered, DiscoveredOrg } from "@aegis/adapters";

let cache: { at: number; value: Discovered } | undefined;
const TTL_MS = 30_000;

export async function discover(): Promise<Discovered> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await discoverSkills();
  cache = { at: Date.now(), value };
  return value;
}

/** Flat list of every skill name on-chain (convenience for the registry page). */
export async function discoverSkillNames(): Promise<string[]> {
  return (await discover()).skillNames;
}
