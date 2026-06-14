// The safeskill SDK — what an agent imports.
export { Safeskill } from "./client";
export type { OnboardOptions, UseOptions, CheckOptions } from "./client";
export { decide } from "./decide";
export { assess, evaluatePolicy, ruleMatches, thresholdPolicy, validatePolicy, PRESETS } from "./policy";
export type { PolicyOutcome } from "./policy";
export { DEFAULT_POLICY, loadConfig, saveConfig, loadPolicyFile, configPath, configDir } from "./config";
export { DEMO_REGISTRY, DemoResolver, DemoFetcher, isRevoked } from "./registry";
export type {
  Decision,
  PolicyRule,
  RegistrySkill,
  ResolverKind,
  SafeskillConfig,
  SafeskillPolicy,
  SignerKind,
  SkillAssessment,
  SkillDecision,
  UseResult,
  Verdict,
} from "./types";
