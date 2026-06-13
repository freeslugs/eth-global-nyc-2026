import { fetcherContract } from "@aegis/core/testing";
import { loadSeededSkills } from "../seed";
import { MockFetcher } from "./MockFetcher";

const weather = loadSeededSkills().find((s) => s.name === "weather.acme.safeskills.eth")!;

fetcherContract({
  make: () => new MockFetcher(),
  knownUri: weather.fetchUri,
  expectedHash: weather.pin,
  unknownUri: "does-not-exist.md",
});
