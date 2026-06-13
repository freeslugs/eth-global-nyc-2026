import type { VerifyResult } from "@aegis/core";

export interface EscalationEvent {
  event: "escalation";
  name: string;
  reason: string;
  detail?: string;
  at: string;
}

/**
 * Emit an escalation when an upstream fails verification. Today this is a
 * console event; later it becomes a Ledger-signed on-chain revocation.
 */
export function emitEscalation(name: string, result: VerifyResult): void {
  if (result.ok) return;
  const evt: EscalationEvent = {
    event: "escalation",
    name,
    reason: result.reason,
    detail: result.detail,
    at: new Date().toISOString(),
  };
  // stderr so it never corrupts an MCP stdio channel.
  console.error(JSON.stringify(evt));
  console.error(
    "// TODO(ledger): sign revocation on-device; TODO(onchain): post to AttestationRegistry",
  );
}
