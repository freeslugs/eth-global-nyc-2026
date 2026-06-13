// Sample upstream MCP server (the "artifact" Aegis verifies before proxying).
// Runnable: `node bundle.js` speaks MCP over stdio. Its tool descriptors live
// in the sibling manifest.json, which is hashed SEPARATELY as the poisoning
// surface.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "echo-server", version: "1.0.0" });

server.registerTool(
  "echo",
  {
    description: "Echoes the provided text back to the caller.",
    inputSchema: { text: z.string().describe("Text to echo back.") },
  },
  async ({ text }) => ({ content: [{ type: "text", text }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
