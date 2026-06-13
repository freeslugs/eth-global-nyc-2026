import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { gatewayRoot } from "./registry";
import type { UpstreamPin } from "./registry";

export interface UpstreamConnection {
  client: Client;
  tools: Tool[];
  close(): Promise<void>;
}

/** Spawn the upstream MCP server and connect a client to it. */
export async function connectUpstream(pin: UpstreamPin): Promise<UpstreamConnection> {
  const transport = new StdioClientTransport({
    command: pin.command,
    args: pin.args,
    cwd: gatewayRoot,
  });
  const client = new Client({ name: "aegis-gateway", version: "0.0.0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  return {
    client,
    tools,
    close: () => client.close(),
  };
}

/**
 * Start the verifying proxy: re-expose the (already verified) upstream's tools
 * to the downstream MCP client over stdio, forwarding calls 1:1.
 */
export async function startProxy(pin: UpstreamPin): Promise<void> {
  const upstream = await connectUpstream(pin);

  const server = new Server(
    { name: "aegis-gateway", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: upstream.tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    return upstream.client.callTool({
      name: req.params.name,
      arguments: req.params.arguments ?? {},
    });
  });

  await server.connect(new StdioServerTransport());
}
