import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const SERVICE = "orbita-mcp";
const port = Number(process.env.PORT ?? 8080);

function createMcpServer() {
  const server = new McpServer({ name: SERVICE, version: "0.1.0" });
  server.registerTool(
    "ping",
    {
      description: "Check that the Órbita MCP server is responding.",
      inputSchema: z.object({}),
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify({ ok: true, service: SERVICE }) }],
    }),
  );
  return server;
}

function hostName(req: IncomingMessage): string {
  return (req.headers.host ?? "").split(":")[0].toLowerCase();
}

/** Local calls stay on localhost. Cloud Run's host is *.run.app. */
function hostAllowed(req: IncomingMessage): boolean {
  const host = hostName(req);
  if (host === "localhost" || host === "127.0.0.1") return true;
  const extra = (process.env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(host)) return true;
  return process.env.NODE_ENV === "production" && host.endsWith(".run.app");
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

const httpServer = createServer(async (req, res) => {
  if (!hostAllowed(req)) {
    sendJson(res, 403, { ok: false, error: "host_rechazado" });
    return;
  }

  const path = (req.url ?? "/").split("?")[0];

  if (req.method === "GET" && path === "/health") {
    sendJson(res, 200, { ok: true, service: SERVICE });
    return;
  }

  if (req.method === "POST" && path === "/mcp") {
    const mcp = createMcpServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error("mcp request failed", err);
      if (!res.headersSent) sendJson(res, 500, { ok: false });
    } finally {
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`${SERVICE} listening on ${port}`);
});
