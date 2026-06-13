import pc from "picocolors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { verifyUpstream } from "./verifyUpstream";
import { connectUpstream, startProxy } from "./proxy";
import { emitEscalation } from "./escalation";

const DEFAULT_UPSTREAM = "echo-server.aegis.eth";

/** Log to stderr so we never corrupt the MCP stdio channel on stdout. */
const log = (s: string): void => {
  console.error(s);
};

/** A server that refuses to expose any upstream tools after a failed gate. */
async function startRefusalServer(name: string, reason: string, detail?: string): Promise<void> {
  const server = new Server(
    { name: "aegis-gateway", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  server.setRequestHandler(CallToolRequestSchema, async () => ({
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Aegis BLOCKED upstream "${name}": ${reason}${detail ? ` — ${detail}` : ""}`,
      },
    ],
  }));
  await server.connect(new StdioServerTransport());
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const name = argv.find((a) => !a.startsWith("--")) ?? DEFAULT_UPSTREAM;

  log(pc.bold(`Aegis gateway — verifying upstream ${pc.cyan(name)}`));

  const { result, pin, fetched } = await verifyUpstream(name);

  log(pc.dim(`  pin     bundle=${pin.bundleHash}`));
  log(pc.dim(`          manifest=${pin.manifestHash}`));
  log(pc.dim(`  fetched bundle=${fetched.bundleHash}`));
  log(pc.dim(`          manifest=${fetched.manifestHash}`));

  if (!result.ok) {
    log(pc.bold(pc.red(`\n  ✗ BLOCK  ${result.reason}`)));
    if (result.detail) log(pc.red(`    ${result.detail}`));
    log(pc.red("  refusing to expose upstream tools."));
    emitEscalation(name, result);
    if (check) {
      process.exit(1);
    }
    // Boot a server that exposes nothing and returns the block on any call.
    await startRefusalServer(name, result.reason, result.detail);
    return;
  }

  log(pc.bold(pc.green("\n  ✓ ALLOW  upstream matches its pinned release")));

  if (check) {
    // Prove we can wrap the upstream: connect, list its tools, then exit.
    const upstream = await connectUpstream(pin);
    log(pc.green(`  wrapping ${upstream.tools.length} tool(s):`));
    for (const t of upstream.tools) {
      log(pc.dim(`    • ${t.name} — ${t.description ?? ""}`));
    }
    await upstream.close();
    process.exit(0);
  }

  log(pc.green("  proxying upstream tools over stdio…"));
  await startProxy(pin);
}

main().catch((err) => {
  console.error(pc.red(`gateway error: ${(err as Error).message}`));
  process.exit(1);
});
