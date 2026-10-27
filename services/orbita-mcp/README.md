# orbita-mcp

Small MCP server for Órbita. It is not connected to the assistant.

One tool: `ping`. It returns `{ "ok": true, "service": "orbita-mcp" }`.

`GET /health` is a plain process check for Cloud Run. It is not an MCP tool.

## Local

```bash
cd services/orbita-mcp
pnpm install
pnpm dev
```

The process listens on port 8080. Outside production it only accepts `Host: localhost` or `Host: 127.0.0.1`.

```bash
curl http://127.0.0.1:8080/health
```

MCP is `POST /mcp` (Streamable HTTP, no session). The published SDK speaks protocol `2025-11-25`. Send that value in `MCP-Protocol-Version`.

## Cloud Run

Deploy from this folder when you want it live. The service should require Google login; do not leave it public.

```bash
gcloud run deploy orbita-mcp \
  --source . \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --port 8080
```

In production the allowed hosts are `localhost`, `127.0.0.1`, any `*.run.app` host, and names listed in `MCP_ALLOWED_HOSTS` (comma-separated).
