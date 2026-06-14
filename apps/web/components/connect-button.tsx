"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

/**
 * Wallet "login" for orgs. The wagmi hooks live in an inner component that only
 * renders after mount, so they never run during SSR (there's no wallet on the
 * server) — which would otherwise throw WagmiProviderNotFound.
 */
export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="inline-block h-[34px] w-[120px] rounded-md border border-[#e7e5e1]" />;
  }
  return <ConnectButtonInner />;
}

function ConnectButtonInner() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-md border border-[#d6d3ce] bg-white px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-[#faf9f7]"
        title="Disconnect"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      }}
      disabled={isPending || connectors.length === 0}
      className="rounded-md border border-[#d6d3ce] bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-[#faf9f7] disabled:opacity-60"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
