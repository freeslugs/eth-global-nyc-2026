import { signerContract } from "@aegis/core/testing";
import type { AuthRequest } from "@aegis/core";
import { loadSeededSkills } from "../seed";
import { LocalSigner } from "./LocalSigner";

const weather = loadSeededSkills().find((s) => s.name === "weather.acme.safeskills.eth")!;

const request: AuthRequest = {
  node: weather.node,
  name: weather.name,
  pin: weather.pin,
  verdict: weather.verdict!,
};

signerContract({ make: () => new LocalSigner(), request });
