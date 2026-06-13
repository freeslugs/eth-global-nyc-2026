import { resolverContract } from "@aegis/core/testing";
import { MockStore } from "../MockStore";
import { MockResolver } from "./MockResolver";

resolverContract({
  make: () => new MockResolver(new MockStore()),
  knownName: "weather.acme.safeskills.eth",
  unknownName: "nope.safeskills.eth",
  nameWithVerdict: "weather.acme.safeskills.eth",
});
