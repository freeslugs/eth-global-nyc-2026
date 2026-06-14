import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PRESETS, validatePolicy } from "./policy";
import type { SafeskillConfig, SafeskillPolicy } from "./types";

/** Default policy: the balanced preset (auto-approve passing skills at ≥70% security). */
export const DEFAULT_POLICY: SafeskillPolicy = PRESETS.default!;

/** ~/.safeskill — where onboarding state lives. Override with SAFESKILL_HOME. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.SAFESKILL_HOME ?? join(homedir(), ".safeskill");
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "config.json");
}

/** Load the saved config, or undefined if the user has not onboarded yet. */
export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<SafeskillConfig | undefined> {
  try {
    const raw = await readFile(configPath(env), "utf8");
    return JSON.parse(raw) as SafeskillConfig;
  } catch {
    return undefined;
  }
}

/** Persist the config to ~/.safeskill/config.json. */
export async function saveConfig(config: SafeskillConfig, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const dir = configDir(env);
  await mkdir(dir, { recursive: true });
  const path = configPath(env);
  await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  return path;
}

/** Read + validate a user-authored policy JSON file from disk. */
export async function loadPolicyFile(path: string): Promise<SafeskillPolicy> {
  const raw = await readFile(path, "utf8");
  return validatePolicy(JSON.parse(raw));
}
