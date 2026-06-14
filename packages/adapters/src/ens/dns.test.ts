import { describe, it, expect } from "vitest";
import { packetToBytes } from "viem/ens";
import { toHex } from "viem";
import { dnsEncode } from "./dns";

describe("dnsEncode", () => {
  it("length-prefixes each label and null-terminates", () => {
    // 07 'weather' 04 'acme' 0a 'safeskills' 03 'eth' 00
    expect(dnsEncode("weather.acme.safeskills.eth")).toBe(
      "0x07776561746865720461636d650a73616665736b696c6c730365746800",
    );
  });

  it("matches viem's packetToBytes", () => {
    for (const name of ["safeskills.eth", "acme.safeskills.eth", "weather.acme.safeskills.eth"]) {
      expect(dnsEncode(name)).toBe(toHex(packetToBytes(name)));
    }
  });
});
